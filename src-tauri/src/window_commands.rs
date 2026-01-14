//! Window management commands for screen size adaptation
//!
//! Provides commands to query screen dimensions and adjust window size
//! to ensure the window fits on small screens.

use tauri::{command, AppHandle, PhysicalSize, Runtime, WebviewWindow};
use tracing::debug;

/// Screen size information in logical pixels
#[derive(Debug, Clone, serde::Serialize)]
pub struct ScreenInfo {
    /// Screen width in logical pixels
    pub width: f64,
    /// Screen height in logical pixels
    pub height: f64,
    /// Scale factor (e.g., 2.0 for Retina displays)
    pub scale_factor: f64,
    /// Available width (excluding dock/sidebar)
    pub available_width: f64,
    /// Available height (excluding menubar/dock)
    pub available_height: f64,
}

/// Get the screen information for the screen where the window is located
#[command]
pub fn get_screen_info<R: Runtime>(
    _app: AppHandle<R>,
    window: WebviewWindow<R>,
) -> Result<ScreenInfo, String> {
    // Get current monitor via Tauri API
    let current_monitor = window
        .current_monitor()
        .map_err(|e| format!("Failed to get current monitor: {}", e))?
        .ok_or("No monitor found")?;

    let scale = current_monitor.scale_factor();
    let size = current_monitor.size();
    let position = current_monitor.position();

    // Calculate logical dimensions
    let width = size.width as f64 / scale;
    let height = size.height as f64 / scale;

    #[cfg(target_os = "macos")]
    {
        // On macOS, account for menubar and dock
        // Menubar is typically 25px, dock can be 50-100px depending on size
        // Use conservative estimate: remove 25px from height for menubar
        let available_width = width;
        let available_height = (height - 25.0).max(height * 0.9);

        debug!(
            "Screen info: {}x{} (available: {}x{}) at ({}, {}), scale: {}",
            width, height, available_width, available_height, position.x, position.y, scale
        );

        Ok(ScreenInfo {
            width,
            height,
            scale_factor: scale,
            available_width,
            available_height,
        })
    }

    #[cfg(not(target_os = "macos"))]
    {
        let current_monitor = window
            .current_monitor()
            .map_err(|e| format!("Failed to get current monitor: {}", e))?
            .ok_or("No monitor found")?;

        let scale = current_monitor.scale_factor();
        let size = current_monitor.size();

        // On other platforms, assume full screen is available
        Ok(ScreenInfo {
            width: size.width as f64 / scale,
            height: size.height as f64 / scale,
            scale_factor: scale,
            available_width: size.width as f64 / scale,
            available_height: size.height as f64 / scale,
        })
    }
}

/// Adjust window size to fit within screen bounds
/// Returns the new window size that was set
#[command]
pub fn adjust_window_size<R: Runtime>(
    _app: AppHandle<R>,
    window: WebviewWindow<R>,
    max_width: f64,
    max_height: f64,
) -> Result<(u32, u32), String> {
    let screen_info = get_screen_info(_app.clone(), window.clone())?;

    // Calculate safe window size
    // Leave some margin for window decorations and safety
    let margin_ratio = 0.95;
    let safe_max_width = screen_info.available_width * margin_ratio;
    let safe_max_height = screen_info.available_height * margin_ratio;

    // Clamp to smaller of requested size or screen size
    let new_width = max_width.min(safe_max_width);
    let new_height = max_height.min(safe_max_height);

    // Convert to physical pixels
    let physical_width = (new_width * screen_info.scale_factor) as u32;
    let physical_height = (new_height * screen_info.scale_factor) as u32;

    debug!(
        "Adjusting window size: logical={}x{}, physical={}x{}",
        new_width, new_height, physical_width, physical_height
    );

    // Set window size
    window
        .set_size(PhysicalSize::new(physical_width, physical_height))
        .map_err(|e| format!("Failed to set window size: {}", e))?;

    Ok((physical_width, physical_height))
}

/// Ensure window is positioned within visible screen bounds
#[command]
pub fn ensure_window_visible<R: Runtime>(
    _app: AppHandle<R>,
    window: WebviewWindow<R>,
) -> Result<(), String> {
    let screen_info = get_screen_info(_app.clone(), window.clone())?;
    let outer_position = window
        .outer_position()
        .map_err(|e| format!("Failed to get window position: {}", e))?;
    let outer_size = window
        .outer_size()
        .map_err(|e| format!("Failed to get window size: {}", e))?;

    let scale = screen_info.scale_factor;

    // Convert to logical coordinates
    let x = outer_position.x as f64 / scale;
    let y = outer_position.y as f64 / scale;
    let width = outer_size.width as f64 / scale;
    let height = outer_size.height as f64 / scale;

    // Check if window is outside visible bounds
    let mut new_x = x;
    let mut new_y = y;
    let mut adjusted = false;

    // Ensure window doesn't go off right edge
    if x + width > screen_info.available_width {
        new_x = screen_info.available_width - width;
        adjusted = true;
    }

    // Ensure window doesn't go off left edge
    if new_x < 0.0 {
        new_x = 0.0;
        adjusted = true;
    }

    // Ensure window doesn't go off bottom edge
    if y + height > screen_info.available_height {
        new_y = screen_info.available_height - height;
        adjusted = true;
    }

    // Ensure window doesn't go off top edge (account for menubar)
    if new_y < 0.0 {
        new_y = 0.0;
        adjusted = true;
    }

    if adjusted {
        debug!(
            "Adjusting window position: from ({}, {}) to ({}, {})",
            x, y, new_x, new_y
        );
        let physical_x = (new_x * scale) as i32;
        let physical_y = (new_y * scale) as i32;
        window
            .set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                x: physical_x,
                y: physical_y,
            }))
            .map_err(|e| format!("Failed to set window position: {}", e))?;
    }

    Ok(())
}
