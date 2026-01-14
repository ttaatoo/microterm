//! µTerm - A micro terminal for macOS menubar
//!
//! This module provides the core functionality for a lightweight terminal
//! application that lives in the macOS menubar.

// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

pub mod commands;
pub mod pty;
pub mod pty_commands;
pub mod screen_config;
pub mod settings;
pub mod settings_commands;
pub mod window_commands;

use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconEvent,
    Emitter, Listener, Manager, Monitor, WebviewWindow,
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
                // Save current window size and position before hiding
                if let Err(e) = save_window_config(window) {
                    error!("Failed to save window config: {}", e);
                }
                macos::hide_window(ns_window);
            } else {
                // Apply window size and position BEFORE showing (atomic operation)
                if let Err(e) = apply_window_config(window) {
                    error!("Failed to apply window config: {}", e);
                    // Fall back to old behavior
                    let position = calculate_window_position(window);
                    macos::show_window_at(ns_window, position);
                    return;
                }

                // Now show window with correct size and position already applied (no flash!)
                // Pass None to show_window_at since position was already set by apply_window_config
                macos::show_window_at(ns_window, None);
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

/// Apply window configuration for current screen (size and position)
fn apply_window_config(window: &WebviewWindow) -> Result<(), String> {
    use tauri::Manager;

    // Get screen config manager
    let config_manager = window
        .app_handle()
        .state::<Arc<screen_config::ScreenConfigManager>>();

    // Detect which screen the cursor is on
    let monitor = detect_cursor_monitor(window)?;

    let scale = monitor.scale_factor();
    let size = monitor.size();

    // Calculate logical dimensions
    let screen_width = size.width as f64 / scale;
    let screen_height = size.height as f64 / scale;

    // Available space (account for menubar on macOS)
    let available_height = (screen_height - 25.0).max(screen_height * 0.9);
    let available_width = screen_width;

    // Generate screen ID
    let screen_id = screen_config::ScreenId::from_dimensions(screen_width, screen_height);

    // Get or create config for this screen
    let (mut config, is_new) = config_manager.get_or_create_config(
        &screen_id,
        screen_width,
        screen_height,
        available_width,
        available_height,
    );

    // VALIDATION: Detect corrupted config (window size larger than screen)
    // This can happen if configs were saved with wrong screen ID
    if config.width > available_width * 1.1 || config.height > available_height * 1.1 {
        error!(
            "⚠️  Corrupted config detected for screen {}: window size ({}x{}) exceeds screen size ({}x{})",
            screen_id.as_str(),
            config.width,
            config.height,
            available_width,
            available_height
        );
        error!("   Resetting to default size to fix corruption");

        // Reset to default size for this screen
        config.width = (available_width * 0.8).min(1200.0);
        config.height = (available_height * 0.8).min(800.0);

        // Save the corrected config
        config_manager.set_config(screen_id.clone(), config.clone());
    }

    if is_new {
        debug!(
            "New screen {}: applying default {}x{}",
            screen_id.as_str(),
            config.width,
            config.height
        );
    } else {
        debug!(
            "Known screen {}: restoring saved {}x{} at ({:?}, {:?})",
            screen_id.as_str(),
            config.width,
            config.height,
            config.x,
            config.y
        );
    }

    // CRITICAL: Use NSWindow API directly for SYNCHRONOUS size/position setting
    // Tauri's set_size() and set_position() are async and may not complete before show_window_at()
    // This causes visual flashing: window shows at old size, then jumps to new size
    #[cfg(target_os = "macos")]
    {
        use objc2_app_kit::{NSEvent, NSScreen, NSWindow};
        use objc2_foundation::{MainThreadMarker, NSPoint, NSRect, NSSize};

        let ns_window = window
            .ns_window()
            .map_err(|e| format!("Failed to get NSWindow: {}", e))?
            as *mut objc2::runtime::AnyObject;

        // SAFETY: Validate pointer before dereferencing
        // This prevents crashes if window is being closed or deallocated
        if ns_window.is_null() {
            return Err("NSWindow pointer is null".to_string());
        }

        unsafe {
            // Use NonNull to ensure pointer validity
            let ns_window_nn = match std::ptr::NonNull::new(ns_window as *mut NSWindow) {
                Some(nn) => nn,
                None => return Err("Failed to create NonNull from NSWindow pointer".to_string()),
            };
            let ns_window_ref: &NSWindow = ns_window_nn.as_ref();

            // IMPORTANT: We must use NSScreen coordinates, not Tauri monitor coordinates
            // NSScreen uses bottom-left origin, Tauri uses top-left origin
            // Mixing them causes windows to appear off-screen!

            // Get the NSScreen for the detected monitor
            if let Some(mtm) = MainThreadMarker::new() {
                // Get mouse position to find the correct NSScreen
                let mouse_location = NSEvent::mouseLocation();
                let screens = NSScreen::screens(mtm);

                let mut target_screen_frame: Option<objc2_foundation::NSRect> = None;

                // Find NSScreen containing the cursor
                for i in 0..screens.count() {
                    let ns_screen = screens.objectAtIndex(i);
                    let frame = ns_screen.frame();

                    if mouse_location.x >= frame.origin.x
                        && mouse_location.x < frame.origin.x + frame.size.width
                        && mouse_location.y >= frame.origin.y
                        && mouse_location.y < frame.origin.y + frame.size.height
                    {
                        target_screen_frame = Some(frame);
                        break;
                    }
                }

                if let Some(screen_frame) = target_screen_frame {
                    // Use saved position if available, otherwise center the window
                    let (ns_x, ns_y) = if let (Some(saved_x), Some(saved_y)) = (config.x, config.y)
                    {
                        // Convert saved logical Tauri coordinates to NSWindow coordinates
                        // Tauri uses top-left origin, NSWindow uses bottom-left origin
                        // saved_y is from top of screen, need to convert to bottom
                        let screen_top = screen_frame.origin.y + screen_frame.size.height;
                        let ns_x = screen_frame.origin.x + saved_x;
                        let ns_y = screen_top - saved_y - config.height;

                        debug!(
                            "Using saved position: Tauri({}, {}) -> NSWindow({:.1}, {:.1})",
                            saved_x, saved_y, ns_x, ns_y
                        );
                        (ns_x, ns_y)
                    } else {
                        // No saved position, center the window
                        let center_offset = (screen_frame.size.width - config.width) / 2.0;
                        let ns_x = screen_frame.origin.x + center_offset;

                        // Calculate y position: 4px from top in NSWindow coordinates
                        let screen_top = screen_frame.origin.y + screen_frame.size.height;
                        let ns_y = screen_top - 4.0 - config.height;

                        debug!("No saved position, centering window");
                        (ns_x, ns_y)
                    };

                    let frame = NSRect::new(
                        NSPoint::new(ns_x, ns_y),
                        NSSize::new(config.width, config.height),
                    );

                    debug!(
                        "Setting window frame SYNCHRONOUSLY: origin=({:.1}, {:.1}) size=({:.1}x{:.1}) on screen frame=({:.1}, {:.1})",
                        ns_x, ns_y, config.width, config.height,
                        screen_frame.origin.x, screen_frame.origin.y
                    );
                    debug!(
                        "Window height breakdown: total={:.1}, TabBar=40, terminal_area={:.1}",
                        config.height,
                        config.height - 40.0
                    );

                    // setFrame:display: is synchronous - window immediately has new size/position
                    // Use false to defer display update, preventing double render when orderFrontRegardless() is called
                    ns_window_ref.setFrame_display(frame, false);
                } else {
                    return Err("Could not find NSScreen for cursor position".to_string());
                }
            } else {
                return Err("MainThreadMarker not available".to_string());
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        // Fallback for non-macOS (async is acceptable there)
        let physical_width = (config.width * scale) as u32;
        let physical_height = (config.height * scale) as u32;
        window
            .set_size(PhysicalSize::new(physical_width, physical_height))
            .map_err(|e| format!("Failed to set window size: {}", e))?;

        let center_offset = (screen_width - config.width) / 2.0;
        let window_x = position.x + (center_offset * scale) as i32;
        let window_y = position.y + (4.0 * scale) as i32;

        window
            .set_position(Position::Physical(PhysicalPosition {
                x: window_x,
                y: window_y,
            }))
            .map_err(|e| format!("Failed to set window position: {}", e))?;
    }

    Ok(())
}

/// Save current window configuration for the screen it's on
fn save_window_config(window: &WebviewWindow) -> Result<(), String> {
    use tauri::Manager;

    let config_manager = window
        .app_handle()
        .state::<Arc<screen_config::ScreenConfigManager>>();

    // IMPORTANT: Use the screen where the WINDOW currently is, not where the cursor is
    // This prevents config corruption when user moves mouse to another screen before hiding
    let monitor = window
        .current_monitor()
        .map_err(|e| format!("Failed to get monitor: {}", e))?
        .or_else(|| {
            // Fallback: if current_monitor returns None (window hidden), detect by cursor
            // This is less accurate but better than failing completely
            detect_cursor_monitor(window).ok()
        })
        .ok_or("No monitor found")?;

    let scale = monitor.scale_factor();
    let size = monitor.size();

    let screen_width = size.width as f64 / scale;
    let screen_height = size.height as f64 / scale;
    let screen_id = screen_config::ScreenId::from_dimensions(screen_width, screen_height);

    // Get current window size and position
    let outer_size = window
        .outer_size()
        .map_err(|e| format!("Failed to get window size: {}", e))?;

    let outer_position = window
        .outer_position()
        .map_err(|e| format!("Failed to get window position: {}", e))?;

    // Convert to logical pixels
    let logical_width = outer_size.width as f64 / scale;
    let logical_height = outer_size.height as f64 / scale;
    let logical_x = outer_position.x as f64 / scale;
    let logical_y = outer_position.y as f64 / scale;

    debug!(
        "Saving window config for screen {}: {}x{} at ({}, {}) (logical pixels)",
        screen_id.as_str(),
        logical_width,
        logical_height,
        logical_x,
        logical_y
    );

    // Save both size and position to remember user's window placement
    let config = screen_config::WindowConfig {
        width: logical_width,
        height: logical_height,
        x: Some(logical_x),
        y: Some(logical_y),
    };

    config_manager.set_config(screen_id, config);
    Ok(())
}

/// Detect which monitor the cursor is currently on
fn detect_cursor_monitor(window: &WebviewWindow) -> Result<Monitor, String> {
    // Detect the screen where the mouse cursor is located
    let monitors = window
        .available_monitors()
        .map_err(|e| format!("Failed to get monitors: {}", e))?;

    // Use AppKit to get mouse cursor position
    #[cfg(target_os = "macos")]
    {
        use objc2_app_kit::{NSEvent, NSScreen};
        use objc2_foundation::MainThreadMarker;

        if let Some(mtm) = MainThreadMarker::new() {
            // Get mouse location in global screen coordinates
            let mouse_location = NSEvent::mouseLocation();
            let cursor_x = mouse_location.x;
            let cursor_y = mouse_location.y;

            debug!(
                "Mouse cursor at: ({:.1}, {:.1}) in screen coordinates",
                cursor_x, cursor_y
            );

            // Get all screens to understand the coordinate system
            let screens = NSScreen::screens(mtm);
            let screen_count = screens.count();

            debug!("Available screens: {}", screen_count);

            // First, log ALL screens to understand the layout
            for i in 0..screen_count {
                let ns_screen = screens.objectAtIndex(i);
                let frame = ns_screen.frame();
                debug!(
                    "NSScreen {}: frame=({:.1}, {:.1}) size=({:.1}x{:.1})",
                    i, frame.origin.x, frame.origin.y, frame.size.width, frame.size.height
                );
            }

            // Try to match cursor position with NSScreen, then find corresponding Tauri monitor
            for i in 0..screen_count {
                let ns_screen = screens.objectAtIndex(i);
                let frame = ns_screen.frame();
                let screen_x = frame.origin.x;
                let screen_y = frame.origin.y;
                let screen_w = frame.size.width;
                let screen_h = frame.size.height;

                // Check if cursor is within this screen's bounds
                if cursor_x >= screen_x
                    && cursor_x < screen_x + screen_w
                    && cursor_y >= screen_y
                    && cursor_y < screen_y + screen_h
                {
                    debug!("Cursor is on NSScreen {}", i);

                    // Find matching Tauri monitor by size and position
                    for monitor in &monitors {
                        let mon_pos = monitor.position();
                        let mon_size = monitor.size();
                        let scale = monitor.scale_factor();

                        // Convert to logical coordinates
                        let mon_x = mon_pos.x as f64 / scale;
                        let mon_y = mon_pos.y as f64 / scale;
                        let mon_w = mon_size.width as f64 / scale;
                        let mon_h = mon_size.height as f64 / scale;

                        debug!(
                            "Tauri monitor: pos=({:.1}, {:.1}) size=({:.1}x{:.1})",
                            mon_x, mon_y, mon_w, mon_h
                        );

                        // Match by size (position might differ between coordinate systems)
                        let tolerance = 10.0;
                        let width_diff = (screen_w - mon_w).abs();
                        let height_diff = (screen_h - mon_h).abs();

                        debug!(
                            "Size comparison: NSScreen=({:.1}x{:.1}) vs Tauri=({:.1}x{:.1}), diff=({:.1}, {:.1})",
                            screen_w, screen_h, mon_w, mon_h, width_diff, height_diff
                        );

                        if width_diff < tolerance && height_diff < tolerance {
                            debug!("✅ Matched screen by size: NSScreen {} -> Tauri monitor", i);
                            return Ok(monitor.clone());
                        } else {
                            debug!(
                                "❌ No match: width_diff={:.1} height_diff={:.1} (tolerance={:.1})",
                                width_diff, height_diff, tolerance
                            );
                        }
                    }

                    debug!("No Tauri monitor matched NSScreen {}", i);
                } else {
                    debug!(
                        "Cursor NOT on NSScreen {}: cursor=({:.1}, {:.1}) is outside frame=({:.1}, {:.1}) + size=({:.1}x{:.1})",
                        i, cursor_x, cursor_y, screen_x, screen_y, screen_w, screen_h
                    );
                }
            }

            debug!(
                "⚠️  Cursor position ({:.1}, {:.1}) not found on any NSScreen",
                cursor_x, cursor_y
            );
        } else {
            debug!("⚠️  MainThreadMarker not available");
        }
    }

    // Fallback to primary monitor
    debug!("Could not detect cursor screen, falling back to primary monitor");
    window
        .primary_monitor()
        .map_err(|e| format!("Failed to get primary monitor: {}", e))?
        .ok_or_else(|| "No primary monitor found".to_string())
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
            window_commands::get_screen_info,
            window_commands::adjust_window_size,
            window_commands::ensure_window_visible,
            settings_commands::get_settings,
            settings_commands::update_settings,
            settings_commands::set_opacity,
            settings_commands::set_font_size,
            settings_commands::set_pinned,
            settings_commands::get_pinned,
            settings_commands::set_onboarding_complete,
        ])
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .ok_or_else(|| tauri::Error::WindowNotFound)?;
            let window_for_tray = window.clone();
            let window_for_shortcut = window.clone();

            // Initialize screen config manager
            let config_path = app
                .path()
                .app_data_dir()
                .map_err(|e| tauri::Error::Anyhow(e.into()))?
                .join("screen-configs.json");
            let screen_config_manager =
                Arc::new(screen_config::ScreenConfigManager::new(config_path));
            app.manage(screen_config_manager.clone());

            // Initialize settings manager
            let settings_path = app
                .path()
                .app_data_dir()
                .map_err(|e| tauri::Error::Anyhow(e.into()))?
                .join("settings.json");
            let settings_manager = Arc::new(settings::SettingsManager::new(settings_path));
            app.manage(settings_manager.clone());

            // Note: Window size is now managed by screen_config.rs per-screen
            // It will be applied in apply_window_config() when window is first shown
            // This eliminates duplicate size adjustments and visual flashing

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

            let settings_manager_for_pin = settings_manager.clone();
            app.listen(
                "pin-state-changed",
                move |event| match serde_json::from_str::<PinStatePayload>(event.payload()) {
                    Ok(payload) => {
                        // Save to settings
                        settings_manager_for_pin.set_pinned(payload.pinned);

                        #[cfg(target_os = "macos")]
                        {
                            macos::set_window_pinned(payload.pinned);
                            info!("Window pin state changed: {}", payload.pinned);
                        }
                    }
                    Err(e) => {
                        error!("Failed to parse pin-state-changed payload: {}", e);
                    }
                },
            );

            // Listen for window resize events to auto-save configuration
            {
                let window_for_resize = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::Resized(_) = event {
                        // Save window config when user manually resizes
                        // Only save if window is visible (don't save during toggle_window size application)
                        // SAFETY: Check window is still valid before accessing it to prevent race conditions
                        // during window closure. Errors are expected during shutdown, so only log in debug mode.
                        match window_for_resize.is_visible() {
                            Ok(true) => {
                                // Verify window is still accessible before saving
                                if window_for_resize.is_closable().unwrap_or(false) {
                                    debug!("Window resized, auto-saving configuration");
                                    if let Err(e) = save_window_config(&window_for_resize) {
                                        // Only log if window is still visible (not being closed)
                                        if window_for_resize.is_visible().unwrap_or(false) {
                                            error!(
                                                "Failed to auto-save window config on resize: {}",
                                                e
                                            );
                                        }
                                    }
                                }
                            }
                            Ok(false) => {
                                // Window not visible, skip save
                            }
                            Err(_) => {
                                // Window invalid/closing, skip save (expected during shutdown)
                            }
                        }
                    }
                });
            }

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
