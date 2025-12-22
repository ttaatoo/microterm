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
use tauri::{Emitter, Listener, Manager, WebviewWindow};

#[cfg(target_os = "macos")]
pub mod macos {
    use block2::RcBlock;
    use objc2::rc::Retained;
    use objc2::runtime::AnyObject;
    use objc2_app_kit::{NSEvent, NSEventMask, NSWindow, NSWindowCollectionBehavior};
    use objc2_foundation::NSPoint;
    use parking_lot::RwLock;
    use std::ptr::NonNull;
    use std::sync::atomic::{AtomicBool, Ordering};

    /// Global flag to track if window is open
    static WINDOW_VISIBLE: AtomicBool = AtomicBool::new(false);

    /// Window state protected by RwLock for thread safety
    /// Uses Retained<NSWindow> for proper memory management instead of raw pointer
    static WINDOW_STATE: RwLock<WindowState> = RwLock::new(WindowState::new());

    struct WindowState {
        /// Retained reference to the NSWindow - properly reference counted
        /// This ensures the window is not deallocated while we hold a reference
        window: Option<Retained<NSWindow>>,
        event_monitor: Option<Retained<AnyObject>>,
    }

    impl WindowState {
        const fn new() -> Self {
            Self {
                window: None,
                event_monitor: None,
            }
        }
    }

    // SAFETY: NSWindow is designed to be used from main thread only,
    // but our RwLock ensures we don't have concurrent mutable access.
    // The Retained<NSWindow> properly manages reference counting.
    unsafe impl Send for WindowState {}
    unsafe impl Sync for WindowState {}

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
    pub unsafe fn configure_panel_behavior(ns_window: *mut AnyObject) {
        // Convert raw pointer to Retained<NSWindow> for proper memory management
        // SAFETY: ns_window is a valid NSWindow pointer provided by Tauri
        let window: Retained<NSWindow> = unsafe {
            let window_ref: &NSWindow = &*(ns_window as *const NSWindow);
            // Retain the window to ensure it's not deallocated
            Retained::retain(window_ref as *const NSWindow as *mut NSWindow)
                .expect("Failed to retain NSWindow")
        };

        // Set window level to floating (like menubar panels)
        // NSFloatingWindowLevel = 3
        window.setLevel(3);

        // Set collection behavior for proper spaces handling
        let behavior = NSWindowCollectionBehavior::CanJoinAllSpaces
            | NSWindowCollectionBehavior::Stationary
            | NSWindowCollectionBehavior::IgnoresCycle;
        window.setCollectionBehavior(behavior);

        // Make window not hide on deactivate
        window.setHidesOnDeactivate(false);

        // Store retained window reference (thread-safe)
        {
            let mut state = WINDOW_STATE.write();
            state.window = Some(window);
        }

        // Setup global event monitor for clicks outside the window
        setup_global_click_monitor();
    }

    /// Setup a global event monitor to detect clicks outside the window.
    fn setup_global_click_monitor() {
        // Remove existing monitor if any (thread-safe access)
        {
            let mut state = WINDOW_STATE.write();
            if let Some(monitor) = state.event_monitor.take() {
                // SAFETY: monitor is a valid event monitor object
                unsafe {
                    NSEvent::removeMonitor(&monitor);
                }
            }
        }

        // NSEventMaskLeftMouseDown | NSEventMaskRightMouseDown
        let event_mask = NSEventMask::LeftMouseDown | NSEventMask::RightMouseDown;

        // Create the handler block
        let handler = RcBlock::new(move |_event: NonNull<NSEvent>| {
            handle_global_click();
        });

        // Add global monitor
        let monitor = NSEvent::addGlobalMonitorForEventsMatchingMask_handler(event_mask, &handler);

        // Store monitor (thread-safe)
        if let Some(monitor) = monitor {
            let mut state = WINDOW_STATE.write();
            state.event_monitor = Some(monitor);
        }
    }

    /// Handle a global mouse click event
    fn handle_global_click() {
        // Quick check using our flag first (optimization)
        if !is_window_visible_flag() {
            return;
        }

        // Access the window through the retained reference
        let state = WINDOW_STATE.read();
        let window = match &state.window {
            Some(w) => w,
            None => return,
        };

        // Check actual window visibility from macOS, not just our flag
        // This syncs our state if macOS hid the window externally (Mission Control, etc.)
        if !window.isVisible() {
            // Release the read lock before setting visibility
            drop(state);
            set_window_visible(false);
            return;
        }

        // Get the mouse location in screen coordinates
        let mouse_location: NSPoint = NSEvent::mouseLocation();

        // Get window frame in screen coordinates
        let frame = window.frame();

        // Check if click is inside window
        let inside = mouse_location.x >= frame.origin.x
            && mouse_location.x <= frame.origin.x + frame.size.width
            && mouse_location.y >= frame.origin.y
            && mouse_location.y <= frame.origin.y + frame.size.height;

        if !inside {
            // Hide window
            window.orderOut(None);
            // Release the read lock before setting visibility
            drop(state);
            set_window_visible(false);
        }
    }

    /// Show the window without activating the app.
    ///
    /// # Safety
    /// Caller must ensure `ns_window` is a valid NSWindow pointer.
    pub unsafe fn show_window(ns_window: *mut AnyObject) {
        let window: &NSWindow = unsafe { &*(ns_window as *const NSWindow) };

        // Show window without activating the app
        window.orderFrontRegardless();

        // Make the window key so it can receive input
        window.makeKeyWindow();

        set_window_visible(true);
    }

    /// Hide the window.
    ///
    /// # Safety
    /// Caller must ensure `ns_window` is a valid NSWindow pointer.
    pub unsafe fn hide_window(ns_window: *mut AnyObject) {
        let window: &NSWindow = unsafe { &*(ns_window as *const NSWindow) };
        window.orderOut(None);
        set_window_visible(false);
    }

    /// Check if the window is visible.
    ///
    /// # Safety
    /// Caller must ensure `ns_window` is a valid NSWindow pointer.
    pub unsafe fn is_ns_window_visible(ns_window: *mut AnyObject) -> bool {
        let window: &NSWindow = unsafe { &*(ns_window as *const NSWindow) };
        window.isVisible()
    }

    /// Clean up resources when the application is shutting down.
    /// Call this before the window is destroyed to prevent dangling references.
    pub fn cleanup() {
        let mut state = WINDOW_STATE.write();

        // Remove event monitor
        if let Some(monitor) = state.event_monitor.take() {
            unsafe {
                NSEvent::removeMonitor(&monitor);
            }
        }

        // Release window reference
        state.window = None;
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
            // Position window directly below menubar with small gap
            // macOS menubar is typically 24-25 logical pixels, but screen_position.y
            // already accounts for the menubar on the primary display
            let gap = 4; // Small gap between menubar and window
            let y = screen_position.y + gap;

            let _ = window.set_position(Position::Physical(PhysicalPosition { x, y }));
        }
    }
}

/// Toggle window visibility - used by both tray icon and global shortcut
fn toggle_window(window: &WebviewWindow) {
    #[cfg(target_os = "macos")]
    {
        let ns_window = window.ns_window().unwrap() as *mut objc2::runtime::AnyObject;

        unsafe {
            if macos::is_ns_window_visible(ns_window) {
                macos::hide_window(ns_window);
            } else {
                // Position window before showing
                position_window(window);
                macos::show_window(ns_window);
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(Arc::new(pty::PtyManager::new()))
        .invoke_handler(tauri::generate_handler![
            commands::execute_command,
            commands::execute_command_stream,
            commands::complete_command,
            commands::hide_window,
            pty_commands::create_pty_session,
            pty_commands::write_to_pty,
            pty_commands::resize_pty,
            pty_commands::close_pty_session,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            let window_for_tray = window.clone();
            let window_for_shortcut = window.clone();

            // Configure macOS-specific panel behavior
            #[cfg(target_os = "macos")]
            {
                // Get the NSWindow handle
                let ns_window = window.ns_window().unwrap() as *mut objc2::runtime::AnyObject;

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
                        toggle_window(&window_for_tray);
                    }
                })
                .build(app)?;

            // Listen for toggle-window event from frontend (triggered by global shortcut)
            // IMPORTANT: Window operations must run on main thread
            let app_handle = app.handle().clone();
            app.listen("toggle-window", move |_event| {
                let app_handle_clone = app_handle.clone();
                // Use run_on_main_thread to ensure NSWindow operations happen on main thread
                let _ = app_handle.run_on_main_thread(move || {
                    if let Some(window) = app_handle_clone.get_webview_window("main") {
                        toggle_window(&window);
                    }
                });
            });

            // Also emit an event when window is toggled so frontend can track state
            let _ = app.emit("window-ready", ());

            // Hide window initially
            #[cfg(target_os = "macos")]
            {
                let ns_window = window_for_shortcut.ns_window().unwrap() as *mut objc2::runtime::AnyObject;
                unsafe {
                    macos::hide_window(ns_window);
                }
            }

            #[cfg(not(target_os = "macos"))]
            {
                window_for_shortcut.hide().unwrap();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
