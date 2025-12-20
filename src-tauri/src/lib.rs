//! µTerm - A micro terminal for macOS menubar
//!
//! This module provides the core functionality for a lightweight terminal
//! application that lives in the macOS menubar.

// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

pub mod commands;
pub mod pty;
pub mod pty_commands;

use std::sync::Arc;
use tauri::{Manager, WebviewWindow};

#[cfg(target_os = "macos")]
mod macos {
    use cocoa::appkit::{NSWindow, NSWindowCollectionBehavior};
    use cocoa::base::{id, nil, BOOL, NO, YES};
    use objc::runtime::Class;
    use objc::{msg_send, sel, sel_impl};
    use parking_lot::RwLock;
    use std::sync::atomic::{AtomicBool, Ordering};

    /// Global flag to track if window is open
    static WINDOW_VISIBLE: AtomicBool = AtomicBool::new(false);

    /// Window state protected by RwLock for thread safety
    /// Note: We still need unsafe for the actual Objective-C calls, but the state
    /// management is now safe.
    static WINDOW_STATE: RwLock<WindowState> = RwLock::new(WindowState::new());

    struct WindowState {
        window_ptr: Option<id>,
        event_monitor: id,
    }

    impl WindowState {
        const fn new() -> Self {
            Self {
                window_ptr: None,
                event_monitor: nil,
            }
        }
    }

    // SAFETY: id (Objective-C pointer) is Send+Sync when properly managed
    unsafe impl Send for WindowState {}
    unsafe impl Sync for WindowState {}

    fn get_class(name: &str) -> *const Class {
        Class::get(name).unwrap_or_else(|| panic!("Class {} not found", name))
    }

    pub fn set_window_visible(visible: bool) {
        WINDOW_VISIBLE.store(visible, Ordering::SeqCst);
    }

    pub fn is_window_visible_flag() -> bool {
        WINDOW_VISIBLE.load(Ordering::SeqCst)
    }

    /// Configure the window to behave like a menubar panel.
    ///
    /// # Safety
    /// Caller must ensure `ns_window` is a valid NSWindow pointer.
    pub unsafe fn configure_panel_behavior(ns_window: id) {
        // Store window pointer for event monitor (thread-safe)
        {
            let mut state = WINDOW_STATE.write();
            state.window_ptr = Some(ns_window);
        }

        // Set window level to floating (like menubar panels)
        // NSFloatingWindowLevel = 3
        const NS_FLOATING_WINDOW_LEVEL: i64 = 3;
        let _: () = msg_send![ns_window, setLevel: NS_FLOATING_WINDOW_LEVEL];

        // Set collection behavior for proper spaces handling
        let behavior = NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
            | NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary
            | NSWindowCollectionBehavior::NSWindowCollectionBehaviorIgnoresCycle;
        ns_window.setCollectionBehavior_(behavior);

        // Make window not hide on deactivate
        let _: () = msg_send![ns_window, setHidesOnDeactivate: NO];

        // Setup global event monitor for clicks outside the window
        setup_global_click_monitor();
    }

    /// Setup a global event monitor to detect clicks outside the window.
    ///
    /// # Safety
    /// This function is called from configure_panel_behavior which ensures
    /// proper initialization order.
    unsafe fn setup_global_click_monitor() {
        let nsevent_class = get_class("NSEvent") as id;

        // Remove existing monitor if any (thread-safe access)
        {
            let mut state = WINDOW_STATE.write();
            if state.event_monitor != nil {
                let _: () = msg_send![nsevent_class, removeMonitor: state.event_monitor];
                state.event_monitor = nil;
            }
        }

        // NSEventMaskLeftMouseDown | NSEventMaskRightMouseDown
        const NS_EVENT_MASK_LEFT_MOUSE_DOWN: u64 = 1 << 1;
        const NS_EVENT_MASK_RIGHT_MOUSE_DOWN: u64 = 1 << 3;
        let event_mask: u64 = NS_EVENT_MASK_LEFT_MOUSE_DOWN | NS_EVENT_MASK_RIGHT_MOUSE_DOWN;

        // Create the handler block using the block crate
        let handler = block::ConcreteBlock::new(move |_event: id| {
            handle_global_click();
        });
        let handler = handler.copy();

        // Add global monitor
        let monitor: id = msg_send![nsevent_class,
            addGlobalMonitorForEventsMatchingMask: event_mask
            handler: &*handler
        ];

        // Keep the block alive by leaking it (it needs to live for the lifetime of the app)
        // This is intentional - the event monitor needs the block to persist for the app's lifetime
        std::mem::forget(handler);

        // Store monitor (thread-safe)
        {
            let mut state = WINDOW_STATE.write();
            state.event_monitor = monitor;
        }
    }

    /// Handle a global mouse click event
    unsafe fn handle_global_click() {
        if !is_window_visible_flag() {
            return;
        }

        let window = {
            let state = WINDOW_STATE.read();
            match state.window_ptr {
                Some(w) => w,
                None => return,
            }
        };

        // Get the mouse location in screen coordinates
        let nsevent_class = get_class("NSEvent") as id;
        let mouse_location: cocoa::foundation::NSPoint = msg_send![nsevent_class, mouseLocation];

        // Get window frame in screen coordinates
        let frame: cocoa::foundation::NSRect = msg_send![window, frame];

        // Check if click is inside window
        let inside = mouse_location.x >= frame.origin.x
            && mouse_location.x <= frame.origin.x + frame.size.width
            && mouse_location.y >= frame.origin.y
            && mouse_location.y <= frame.origin.y + frame.size.height;

        if !inside {
            // Hide window
            let _: () = msg_send![window, orderOut: nil];
            set_window_visible(false);
        }
    }

    pub unsafe fn show_window(ns_window: id) {
        // Show window without activating the app
        let _: () = msg_send![ns_window, orderFrontRegardless];

        // Make the window key so it can receive input
        let _: () = msg_send![ns_window, makeKeyWindow];

        set_window_visible(true);
    }

    pub unsafe fn hide_window(ns_window: id) {
        let _: () = msg_send![ns_window, orderOut: nil];
        set_window_visible(false);
    }

    pub unsafe fn is_ns_window_visible(ns_window: id) -> bool {
        let visible: BOOL = msg_send![ns_window, isVisible];
        visible == YES
    }
}

fn position_window<R: tauri::Runtime>(window: &WebviewWindow<R>) {
    #[cfg(target_os = "macos")]
    {
        use tauri::{Position, PhysicalPosition};
        if let Some(monitor) = window.primary_monitor().ok().flatten() {
            let screen_size = *monitor.size();
            let screen_position = monitor.position();
            let screen_width = screen_size.width as f64;
            let window_width = 800.0;

            let x = screen_position.x + ((screen_width - window_width) / 2.0) as i32;
            let menubar_height = 25;
            let y = screen_position.y + menubar_height;

            let _ = window.set_position(Position::Physical(PhysicalPosition { x, y }));
        }
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(Arc::new(pty::PtyManager::new()))
        .invoke_handler(tauri::generate_handler![
            commands::execute_command,
            commands::execute_command_stream,
            commands::complete_command,
            pty_commands::create_pty_session,
            pty_commands::write_to_pty,
            pty_commands::resize_pty,
            pty_commands::close_pty_session,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            let window_for_tray = window.clone();

            // Configure macOS-specific panel behavior
            #[cfg(target_os = "macos")]
            {
                // Get the NSWindow handle
                let ns_window = window.ns_window().unwrap() as cocoa::base::id;

                unsafe {
                    macos::configure_panel_behavior(ns_window);
                }
            }

            // Create system tray
            // IMPORTANT: Use MouseButtonState::Up to trigger on mouse release, not press
            // This matches the behavior of native macOS menubar apps
            let _tray = tauri::tray::TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("µTerm")
                .on_tray_icon_event(move |_tray, event| {
                    // Only handle left click with button UP (released)
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        #[cfg(target_os = "macos")]
                        {
                            let ns_window = window_for_tray.ns_window().unwrap() as cocoa::base::id;

                            unsafe {
                                if macos::is_ns_window_visible(ns_window) {
                                    macos::hide_window(ns_window);
                                } else {
                                    // Position window before showing
                                    position_window(&window_for_tray);
                                    macos::show_window(ns_window);
                                }
                            }
                        }

                        #[cfg(not(target_os = "macos"))]
                        {
                            if window_for_tray.is_visible().unwrap_or(false) {
                                let _ = window_for_tray.hide();
                            } else {
                                let _ = window_for_tray.show();
                                let _ = window_for_tray.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            // Hide window initially
            #[cfg(target_os = "macos")]
            {
                let ns_window = window.ns_window().unwrap() as cocoa::base::id;
                unsafe {
                    macos::hide_window(ns_window);
                }
            }

            #[cfg(not(target_os = "macos"))]
            {
                window.hide().unwrap();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
