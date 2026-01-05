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
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconEvent,
    Emitter, Listener, Manager, WebviewWindow,
};
use tracing::{debug, error, info};
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

#[cfg(target_os = "macos")]
pub mod macos {
    use block2::RcBlock;
    use objc2::rc::Retained;
    use objc2::runtime::AnyObject;
    use objc2_app_kit::{
        NSApplication, NSEvent, NSEventMask, NSWindow, NSWindowCollectionBehavior,
    };
    use objc2_foundation::{MainThreadMarker, NSPoint};
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
        pinned: bool, // Pin state: if true, window won't auto-hide
    }

    impl WindowState {
        const fn new() -> Self {
            Self {
                window: None,
                event_monitor: None,
                pinned: false,
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

    pub fn is_window_pinned() -> bool {
        WINDOW_STATE.read().pinned
    }

    pub fn set_window_pinned(pinned: bool) {
        WINDOW_STATE.write().pinned = pinned;
    }

    /// Configure the window to behave like a menubar panel.
    ///
    /// This sets up the window with floating level, proper space behavior,
    /// and installs a global click monitor to hide the window when clicking outside.
    ///
    /// # Safety
    ///
    /// This function is unsafe because it dereferences a raw pointer and calls
    /// Objective-C methods that require main thread execution.
    ///
    /// Caller must ensure:
    /// 1. `ns_window` points to a valid, live NSWindow object obtained from Tauri
    /// 2. The NSWindow will remain valid for the duration of this call
    /// 3. This function is called from the main thread
    /// 4. No other threads are mutating the window concurrently
    ///
    /// # Panics
    ///
    /// Panics if unable to retain the NSWindow (indicates memory corruption or invalid pointer).
    pub unsafe fn configure_panel_behavior(ns_window: *mut AnyObject) {
        // Convert raw pointer to Retained<NSWindow> for proper memory management
        // SAFETY: Caller guarantees ns_window is a valid NSWindow pointer from Tauri
        let window: Retained<NSWindow> = unsafe {
            let window_ref: &NSWindow = &*(ns_window as *const NSWindow);
            // Retain the window to ensure it's not deallocated while we use it
            Retained::retain(window_ref as *const NSWindow as *mut NSWindow).expect(
                "Failed to retain NSWindow - this indicates memory corruption or invalid pointer",
            )
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

        // Check pin state: if pinned, don't handle external clicks
        if is_window_pinned() {
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
            // Hide window (only if not pinned)
            window.orderOut(None);
            // Release the read lock before setting visibility
            drop(state);
            set_window_visible(false);
        }
    }

    /// Show the window and activate the app to receive keyboard input.
    ///
    /// This makes the window visible, activates the application (so it can receive
    /// keyboard input), and makes it the key window.
    ///
    /// If `position` is provided, the window is moved to that position BEFORE
    /// being shown, which prevents flicker when switching screens.
    ///
    /// # Safety
    ///
    /// This function is unsafe because it dereferences a raw pointer.
    ///
    /// Caller must ensure:
    /// 1. `ns_window` points to a valid, live NSWindow object
    /// 2. This function is called from the main thread (required for NSApp.activate)
    ///
    /// # Panics
    ///
    /// Panics if not called from the main thread (MainThreadMarker::new() fails).
    pub unsafe fn show_window_at(ns_window: *mut AnyObject, position: Option<NSPoint>) {
        // SAFETY: Caller guarantees ns_window is valid
        let window: &NSWindow = unsafe { &*(ns_window as *const NSWindow) };

        // Position window BEFORE showing to prevent flicker
        if let Some(pos) = position {
            window.setFrameOrigin(pos);
        }

        // Show window
        window.orderFrontRegardless();

        // Activate the application so it can receive keyboard input
        // This is critical - without activation, the window shows but can't receive focus
        // SAFETY: show_window is always called from the main thread (via run_on_main_thread or setup)
        let mtm = MainThreadMarker::new().expect("show_window must be called from main thread");
        let app = NSApplication::sharedApplication(mtm);
        #[allow(deprecated)]
        app.activateIgnoringOtherApps(true);

        // Make the window key so it receives keyboard events
        window.makeKeyWindow();

        set_window_visible(true);
    }

    /// Show the window at its current position.
    /// For showing at a specific position without flicker, use `show_window_at`.
    ///
    /// # Safety
    ///
    /// Same requirements as `show_window_at`.
    pub unsafe fn show_window(ns_window: *mut AnyObject) {
        show_window_at(ns_window, None);
    }

    /// Hide the window by ordering it out.
    ///
    /// # Safety
    ///
    /// This function is unsafe because it dereferences a raw pointer.
    ///
    /// Caller must ensure `ns_window` points to a valid, live NSWindow object.
    pub unsafe fn hide_window(ns_window: *mut AnyObject) {
        // SAFETY: Caller guarantees ns_window is valid
        let window: &NSWindow = unsafe { &*(ns_window as *const NSWindow) };
        window.orderOut(None);
        set_window_visible(false);
    }

    /// Check if the window is visible.
    ///
    /// # Safety
    ///
    /// This function is unsafe because it dereferences a raw pointer.
    ///
    /// Caller must ensure `ns_window` points to a valid, live NSWindow object.
    pub unsafe fn is_ns_window_visible(ns_window: *mut AnyObject) -> bool {
        // SAFETY: Caller guarantees ns_window is valid
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

/// Calculate the window position for the screen where the mouse cursor is located.
/// Returns the position in NSWindow coordinates (origin at bottom-left).
#[cfg(target_os = "macos")]
fn calculate_window_position<R: tauri::Runtime>(
    window: &WebviewWindow<R>,
) -> Option<objc2_foundation::NSPoint> {
    use objc2_app_kit::NSScreen;
    use objc2_foundation::{MainThreadMarker, NSPoint};

    let mtm = MainThreadMarker::new()?;

    // Get mouse location (in screen coordinates, origin at bottom-left)
    let mouse_location = objc2_app_kit::NSEvent::mouseLocation();
    debug!(
        "Mouse location: ({}, {})",
        mouse_location.x, mouse_location.y
    );

    // Find the screen containing the mouse cursor
    let screens = NSScreen::screens(mtm);
    let mut target_screen_frame: Option<objc2_foundation::NSRect> = None;

    for screen in screens.iter() {
        let frame = screen.frame();
        debug!(
            "NSScreen frame: origin=({}, {}), size=({}, {})",
            frame.origin.x, frame.origin.y, frame.size.width, frame.size.height
        );
        // Check if mouse is within this screen's bounds
        if mouse_location.x >= frame.origin.x
            && mouse_location.x < frame.origin.x + frame.size.width
            && mouse_location.y >= frame.origin.y
            && mouse_location.y < frame.origin.y + frame.size.height
        {
            debug!("Mouse is on this screen!");
            target_screen_frame = Some(frame);
            break;
        }
    }

    // Fall back to main screen if mouse screen not found
    let screen_frame =
        target_screen_frame.or_else(|| NSScreen::mainScreen(mtm).map(|s| s.frame()))?;

    // Get visible frame (excludes menubar and dock)
    // We need to find the screen again to get its visibleFrame
    let visible_frame = {
        let mut vf = screen_frame;
        for screen in screens.iter() {
            let frame = screen.frame();
            if (frame.origin.x - screen_frame.origin.x).abs() < 1.0
                && (frame.origin.y - screen_frame.origin.y).abs() < 1.0
            {
                vf = screen.visibleFrame();
                break;
            }
        }
        vf
    };

    // Get window size (we need the current window size for centering)
    let window_width = if let Ok(size) = window.outer_size() {
        size.width as f64 / window.scale_factor().unwrap_or(1.0)
    } else {
        800.0 // fallback
    };

    // Calculate centered x position
    let x = screen_frame.origin.x + (screen_frame.size.width - window_width) / 2.0;

    // Calculate y position: top of visible area (just below menubar)
    // In NSWindow coordinates, y increases upward, so the top of visible frame is:
    // visible_frame.origin.y + visible_frame.size.height
    // We want the window's top edge there, so subtract a small gap
    let gap = 4.0;
    let window_height = if let Ok(size) = window.outer_size() {
        size.height as f64 / window.scale_factor().unwrap_or(1.0)
    } else {
        600.0 // fallback
    };

    // Window origin is at bottom-left, so:
    // window_top = y + window_height
    // We want window_top = visible_frame_top - gap
    // So: y = visible_frame_top - gap - window_height
    let visible_frame_top = visible_frame.origin.y + visible_frame.size.height;
    let y = visible_frame_top - gap - window_height;

    debug!("Calculated window position: ({}, {})", x, y);
    Some(NSPoint::new(x, y))
}

/// Position the window on the screen where the mouse cursor is located.
/// This version uses Tauri's API (may cause flicker if window is visible).
#[allow(dead_code)]
fn position_window<R: tauri::Runtime>(window: &WebviewWindow<R>) {
    #[cfg(target_os = "macos")]
    {
        use objc2_app_kit::NSScreen;
        use objc2_foundation::MainThreadMarker;
        use tauri::{PhysicalPosition, Position};

        // Get the screen where the mouse cursor is located
        // This ensures the window appears on the currently active screen
        let monitor = if let Some(mtm) = MainThreadMarker::new() {
            // Get mouse location
            let mouse_location = objc2_app_kit::NSEvent::mouseLocation();
            debug!(
                "Mouse location: ({}, {})",
                mouse_location.x, mouse_location.y
            );

            // Find the screen containing the mouse cursor
            let screens = NSScreen::screens(mtm);
            let mut target_screen: Option<tauri::Monitor> = None;
            let mut found_ns_screen_frame: Option<objc2_foundation::NSRect> = None;

            for screen in screens.iter() {
                let frame = screen.frame();
                debug!(
                    "NSScreen frame: origin=({}, {}), size=({}, {})",
                    frame.origin.x, frame.origin.y, frame.size.width, frame.size.height
                );
                // Check if mouse is within this screen's bounds
                if mouse_location.x >= frame.origin.x
                    && mouse_location.x < frame.origin.x + frame.size.width
                    && mouse_location.y >= frame.origin.y
                    && mouse_location.y < frame.origin.y + frame.size.height
                {
                    debug!("Mouse is on this screen!");
                    found_ns_screen_frame = Some(frame);
                    break;
                }
            }

            // Now find matching Tauri monitor
            if let Some(ns_frame) = found_ns_screen_frame {
                if let Ok(monitors) = window.available_monitors() {
                    for monitor in monitors {
                        let mon_pos = monitor.position();
                        let mon_size = monitor.size();
                        let scale = monitor.scale_factor();
                        debug!(
                            "Tauri monitor: pos=({}, {}), size=({}, {}), scale={}",
                            mon_pos.x, mon_pos.y, mon_size.width, mon_size.height, scale
                        );

                        // NSScreen uses points (logical), Tauri uses physical pixels
                        // Also, NSScreen y=0 is at bottom, Tauri y=0 is at top
                        let ns_width_physical = ns_frame.size.width * scale;
                        let ns_height_physical = ns_frame.size.height * scale;

                        // Match by size (more reliable than position due to coordinate differences)
                        if (mon_size.width as f64 - ns_width_physical).abs() < 2.0
                            && (mon_size.height as f64 - ns_height_physical).abs() < 2.0
                        {
                            debug!("Found matching Tauri monitor!");
                            target_screen = Some(monitor);
                            break;
                        }
                    }
                }
            }
            target_screen
        } else {
            None
        };

        // Fall back to primary monitor if we couldn't find the cursor's screen
        let monitor = monitor.or_else(|| window.primary_monitor().ok().flatten());

        if let Some(monitor) = monitor {
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
        let ns_window = match window.ns_window() {
            Ok(w) => w as *mut objc2::runtime::AnyObject,
            Err(e) => {
                error!("Failed to get NSWindow handle: {}", e);
                return;
            }
        };

        unsafe {
            if macos::is_ns_window_visible(ns_window) {
                macos::hide_window(ns_window);
            } else {
                // Calculate position and show window atomically to prevent flicker
                let position = calculate_window_position(window);
                macos::show_window_at(ns_window, position);
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

/// Initialize the tracing subscriber for structured logging.
///
/// In debug mode, logs at DEBUG level. In release mode, logs at INFO level.
/// The log level can be overridden via the `RUST_LOG` environment variable.
fn init_logging() {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| {
        if cfg!(debug_assertions) {
            EnvFilter::new("microterm=debug,warn")
        } else {
            EnvFilter::new("microterm=info,warn")
        }
    });

    tracing_subscriber::registry()
        .with(fmt::layer().with_target(true).with_thread_ids(false))
        .with(filter)
        .init();
}

pub fn run() {
    // Initialize logging before anything else
    init_logging();
    info!("Starting µTerm v{}", env!("CARGO_PKG_VERSION"));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
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
            pty_commands::get_pty_cwd,
        ])
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .ok_or_else(|| tauri::Error::WindowNotFound)?;
            let window_for_tray = window.clone();
            let window_for_shortcut = window.clone();

            // Configure macOS-specific panel behavior
            #[cfg(target_os = "macos")]
            {
                // Get the NSWindow handle
                let ns_window = window
                    .ns_window()
                    .map_err(|e| tauri::Error::Anyhow(e.into()))?
                    as *mut objc2::runtime::AnyObject;

                unsafe {
                    macos::configure_panel_behavior(ns_window);
                }
            }

            // Create quit menu for tray icon (shown on right-click)
            let quit_item = MenuItem::with_id(app, "quit", "Quit µTerm", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&quit_item])?;

            // Create system tray
            // IMPORTANT: Use MouseButtonState::Up to trigger on mouse release, not press
            // This matches the behavior of native macOS menubar apps
            let tray_icon = app
                .default_window_icon()
                .ok_or_else(|| tauri::Error::AssetNotFound("default window icon".to_string()))?
                .clone();
            let _tray = tauri::tray::TrayIconBuilder::new()
                .icon(tray_icon)
                .tooltip("µTerm")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(move |_tray, event| {
                    // Left click: toggle window
                    // Right click: menu is shown automatically by Tauri
                    if let TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_window(&window_for_tray);
                    }
                })
                .on_menu_event(|app, event| {
                    if event.id.as_ref() == "quit" {
                        // Clean up before quitting
                        #[cfg(target_os = "macos")]
                        macos::cleanup();
                        app.exit(0);
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

            // Listen for pin-state-changed event from frontend
            // Define payload struct for type-safe deserialization
            #[derive(serde::Deserialize)]
            struct PinStatePayload {
                pinned: bool,
            }

            app.listen("pin-state-changed", move |event| {
                match serde_json::from_str::<PinStatePayload>(event.payload()) {
                    Ok(payload) => {
                        #[cfg(target_os = "macos")]
                        {
                            macos::set_window_pinned(payload.pinned);
                            info!("Window pin state changed: {}", payload.pinned);
                        }
                    }
                    Err(e) => {
                        error!("Failed to parse pin-state-changed payload: {}", e);
                    }
                }
            });

            // Also emit an event when window is toggled so frontend can track state
            let _ = app.emit("window-ready", ());

            // Hide window initially
            #[cfg(target_os = "macos")]
            {
                if let Ok(ns_window) = window_for_shortcut.ns_window() {
                    let ns_window = ns_window as *mut objc2::runtime::AnyObject;
                    unsafe {
                        macos::hide_window(ns_window);
                    }
                }
            }

            #[cfg(not(target_os = "macos"))]
            {
                let _ = window_for_shortcut.hide();
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // Handle Dock icon click (Reopen event)
            if let tauri::RunEvent::Reopen { .. } = event {
                if let Some(window) = app_handle.get_webview_window("main") {
                    // Show window when Dock icon is clicked
                    #[cfg(target_os = "macos")]
                    {
                        if let Ok(ns_window) = window.ns_window() {
                            let ns_window = ns_window as *mut objc2::runtime::AnyObject;
                            unsafe {
                                // Calculate position and show atomically to prevent flicker
                                let position = calculate_window_position(&window);
                                macos::show_window_at(ns_window, position);
                            }
                        }
                    }
                    #[cfg(not(target_os = "macos"))]
                    {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        });
}
