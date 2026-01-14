//! Settings management commands

use crate::settings::{AppSettings, SettingsManager};
use std::sync::Arc;
use tauri::{command, AppHandle, Emitter, State};

/// Get current settings
#[command]
pub fn get_settings(settings_manager: State<Arc<SettingsManager>>) -> Result<AppSettings, String> {
    Ok(settings_manager.get())
}

/// Update all settings
#[command]
pub fn update_settings(
    settings_manager: State<Arc<SettingsManager>>,
    settings: AppSettings,
) -> Result<(), String> {
    settings_manager.update(settings);
    Ok(())
}

/// Update opacity setting
#[command]
pub fn set_opacity(
    settings_manager: State<Arc<SettingsManager>>,
    opacity: f64,
) -> Result<(), String> {
    // Validate opacity range
    if !(0.3..=1.0).contains(&opacity) {
        return Err(format!(
            "Opacity must be between 0.3 and 1.0, got {}",
            opacity
        ));
    }
    settings_manager.set_opacity(opacity);
    Ok(())
}

/// Update font size setting
#[command]
pub fn set_font_size(
    settings_manager: State<Arc<SettingsManager>>,
    font_size: u8,
) -> Result<(), String> {
    // Validate font size range
    if !(10..=24).contains(&font_size) {
        return Err(format!(
            "Font size must be between 10 and 24, got {}",
            font_size
        ));
    }
    settings_manager.set_font_size(font_size);
    Ok(())
}

/// Update pinned state
#[command]
pub fn set_pinned(
    app: AppHandle,
    settings_manager: State<Arc<SettingsManager>>,
    pinned: bool,
) -> Result<(), String> {
    settings_manager.set_pinned(pinned);

    // Update macOS window pin state
    #[cfg(target_os = "macos")]
    {
        crate::macos::set_window_pinned(pinned);
        tracing::info!("Window pin state changed: {}", pinned);
    }

    // Emit event to frontend for UI update
    app.emit("pin-state-updated", serde_json::json!({ "pinned": pinned }))
        .map_err(|e| format!("Failed to emit pin-state-updated: {}", e))?;

    Ok(())
}

/// Get pinned state
#[command]
pub fn get_pinned(settings_manager: State<Arc<SettingsManager>>) -> Result<bool, String> {
    Ok(settings_manager.get_pinned())
}

/// Mark onboarding as complete
#[command]
pub fn set_onboarding_complete(
    settings_manager: State<Arc<SettingsManager>>,
    complete: bool,
) -> Result<(), String> {
    settings_manager.set_onboarding_complete(complete);
    Ok(())
}

// Validation helper functions for testing
#[cfg(test)]
mod validation {
    /// Validate opacity range (0.3 - 1.0)
    pub fn validate_opacity(opacity: f64) -> Result<(), String> {
        if !(0.3..=1.0).contains(&opacity) {
            return Err(format!(
                "Opacity must be between 0.3 and 1.0, got {}",
                opacity
            ));
        }
        Ok(())
    }

    /// Validate font size range (10 - 24)
    pub fn validate_font_size(font_size: u8) -> Result<(), String> {
        if !(10..=24).contains(&font_size) {
            return Err(format!(
                "Font size must be between 10 and 24, got {}",
                font_size
            ));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::validation::*;
    use crate::settings::SettingsManager;
    use std::sync::Arc;
    use tempfile::TempDir;

    // ============== Validation tests ==============

    #[test]
    fn test_validate_opacity_valid() {
        assert!(validate_opacity(0.3).is_ok());
        assert!(validate_opacity(0.5).is_ok());
        assert!(validate_opacity(0.9).is_ok());
        assert!(validate_opacity(1.0).is_ok());
    }

    #[test]
    fn test_validate_opacity_invalid_below_min() {
        let result = validate_opacity(0.2);
        assert!(result.is_err());
        let err_msg = result.unwrap_err();
        assert!(err_msg.contains("Opacity must be between 0.3 and 1.0"));
        assert!(err_msg.contains("0.2"));

        assert!(validate_opacity(0.0).is_err());
        assert!(validate_opacity(-1.0).is_err());
    }

    #[test]
    fn test_validate_opacity_invalid_above_max() {
        let result = validate_opacity(1.1);
        assert!(result.is_err());
        let err_msg = result.unwrap_err();
        assert!(err_msg.contains("Opacity must be between 0.3 and 1.0"));
        assert!(err_msg.contains("1.1"));

        assert!(validate_opacity(2.0).is_err());
        assert!(validate_opacity(10.0).is_err());
    }

    #[test]
    fn test_validate_font_size_valid() {
        assert!(validate_font_size(10).is_ok());
        assert!(validate_font_size(13).is_ok());
        assert!(validate_font_size(20).is_ok());
        assert!(validate_font_size(24).is_ok());
    }

    #[test]
    fn test_validate_font_size_invalid_below_min() {
        let result = validate_font_size(9);
        assert!(result.is_err());
        let err_msg = result.unwrap_err();
        assert!(err_msg.contains("Font size must be between 10 and 24"));
        assert!(err_msg.contains("9"));

        assert!(validate_font_size(0).is_err());
        assert!(validate_font_size(5).is_err());
    }

    #[test]
    fn test_validate_font_size_invalid_above_max() {
        let result = validate_font_size(25);
        assert!(result.is_err());
        let err_msg = result.unwrap_err();
        assert!(err_msg.contains("Font size must be between 10 and 24"));
        assert!(err_msg.contains("25"));

        assert!(validate_font_size(30).is_err());
        assert!(validate_font_size(100).is_err());
    }

    // ============== Integration tests with SettingsManager ==============

    fn create_temp_manager() -> (Arc<SettingsManager>, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let settings_path = temp_dir.path().join("settings.json");
        let manager = Arc::new(SettingsManager::new(settings_path));
        (manager, temp_dir)
    }

    #[test]
    fn test_set_opacity_validation_integration() {
        let (manager, _temp_dir) = create_temp_manager();

        // Valid opacity should work (though we can't call the command directly,
        // we can verify the manager's set_opacity clamps values)
        manager.set_opacity(0.7);
        assert_eq!(manager.get().opacity, 0.7);

        // Invalid values should be clamped by the manager
        manager.set_opacity(0.1);
        assert_eq!(manager.get().opacity, 0.3); // Clamped to minimum

        manager.set_opacity(2.0);
        assert_eq!(manager.get().opacity, 1.0); // Clamped to maximum
    }

    #[test]
    fn test_set_font_size_validation_integration() {
        let (manager, _temp_dir) = create_temp_manager();

        // Valid font size should work
        manager.set_font_size(15);
        assert_eq!(manager.get().font_size, 15);

        // Invalid values should be clamped by the manager
        manager.set_font_size(5);
        assert_eq!(manager.get().font_size, 10); // Clamped to minimum

        manager.set_font_size(30);
        assert_eq!(manager.get().font_size, 24); // Clamped to maximum
    }

    #[test]
    fn test_validation_error_messages() {
        // Test that error messages are descriptive
        let opacity_err = validate_opacity(0.2).unwrap_err();
        assert!(opacity_err.contains("Opacity"));
        assert!(opacity_err.contains("0.3"));
        assert!(opacity_err.contains("1.0"));
        assert!(opacity_err.contains("0.2"));

        let font_err = validate_font_size(5).unwrap_err();
        assert!(font_err.contains("Font size"));
        assert!(font_err.contains("10"));
        assert!(font_err.contains("24"));
        assert!(font_err.contains("5"));
    }

    #[test]
    fn test_validation_boundary_values() {
        // Test exact boundary values
        assert!(validate_opacity(0.3).is_ok());
        assert!(validate_opacity(1.0).is_ok());
        assert!(validate_opacity(0.299999).is_err());
        assert!(validate_opacity(1.000001).is_err());

        assert!(validate_font_size(10).is_ok());
        assert!(validate_font_size(24).is_ok());
        assert!(validate_font_size(9).is_err());
        assert!(validate_font_size(25).is_err());
    }
}
