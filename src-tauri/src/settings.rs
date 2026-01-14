//! Application settings management
//!
//! Provides centralized settings storage with type-safe validation.
//! Settings are persisted to app data directory and survive app updates.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tracing::{debug, error};

// Note: WindowSize struct removed - window sizing now managed by screen_config.rs

/// Application settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    /// Window opacity (0.3 - 1.0)
    #[serde(default = "default_opacity")]
    pub opacity: f64,

    /// Font size in pixels (10 - 24)
    #[serde(default = "default_font_size")]
    pub font_size: u8,

    // Note: window_size field removed - now managed per-screen by screen_config.rs
    /// Global shortcut for toggling window
    #[serde(default = "default_shortcut")]
    pub global_shortcut: String,

    /// Whether global shortcut is enabled
    #[serde(default = "default_true")]
    pub shortcut_enabled: bool,

    /// Pin shortcut
    #[serde(default = "default_pin_shortcut")]
    pub pin_shortcut: String,

    /// Whether onboarding has been completed
    #[serde(default)]
    pub onboarding_complete: bool,

    /// Whether window is pinned (prevents auto-hide)
    #[serde(default)]
    pub pinned: bool,
}

// Default value functions
fn default_opacity() -> f64 {
    0.9
}
fn default_font_size() -> u8 {
    13
}
fn default_shortcut() -> String {
    "CommandOrControl+Shift+T".to_string()
}
fn default_pin_shortcut() -> String {
    "CommandOrControl+Backquote".to_string()
}
fn default_true() -> bool {
    true
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            opacity: default_opacity(),
            font_size: default_font_size(),
            // window_size removed - now managed per-screen by screen_config.rs
            global_shortcut: default_shortcut(),
            shortcut_enabled: true,
            pin_shortcut: default_pin_shortcut(),
            onboarding_complete: false,
            pinned: false,
        }
    }
}

impl AppSettings {
    /// Validate and clamp settings to allowed ranges
    pub fn validate(&mut self) {
        // Clamp opacity to 0.3 - 1.0
        self.opacity = self.opacity.clamp(0.3, 1.0);

        // Clamp font size to 10 - 24
        self.font_size = self.font_size.clamp(10, 24);

        // Note: Window size validation removed - now managed per-screen by screen_config.rs
    }
}

/// Settings manager with thread-safe access
pub struct SettingsManager {
    settings: Mutex<AppSettings>,
    settings_path: PathBuf,
}

impl SettingsManager {
    /// Create a new settings manager with the given file path
    pub fn new(settings_path: PathBuf) -> Self {
        let settings = Self::load_settings(&settings_path);
        Self {
            settings: Mutex::new(settings),
            settings_path,
        }
    }

    /// Load settings from disk
    fn load_settings(path: &PathBuf) -> AppSettings {
        match fs::read_to_string(path) {
            Ok(content) => match serde_json::from_str::<AppSettings>(&content) {
                Ok(mut settings) => {
                    settings.validate();
                    debug!("Loaded settings from disk");
                    settings
                }
                Err(e) => {
                    error!("Failed to parse settings: {}, using defaults", e);
                    AppSettings::default()
                }
            },
            Err(_) => {
                debug!("No existing settings file, using defaults");
                AppSettings::default()
            }
        }
    }

    /// Save settings to disk
    fn save_settings(&self) {
        let settings = match self.settings.lock() {
            Ok(s) => s,
            Err(poisoned) => {
                error!("Settings mutex poisoned during save, recovering");
                poisoned.into_inner()
            }
        };
        match serde_json::to_string_pretty(&*settings) {
            Ok(json) => {
                if let Some(parent) = self.settings_path.parent() {
                    let _ = fs::create_dir_all(parent);
                }
                match fs::write(&self.settings_path, json) {
                    Ok(_) => debug!("Saved settings to disk"),
                    Err(e) => error!("Failed to write settings: {}", e),
                }
            }
            Err(e) => error!("Failed to serialize settings: {}", e),
        }
    }

    /// Get current settings
    pub fn get(&self) -> AppSettings {
        self.settings
            .lock()
            .unwrap_or_else(|poisoned| {
                error!("Settings mutex poisoned, recovering with last known state");
                poisoned.into_inner()
            })
            .clone()
    }

    /// Update settings
    pub fn update(&self, mut new_settings: AppSettings) {
        new_settings.validate();
        if let Ok(mut settings) = self.settings.lock() {
            *settings = new_settings;
        } else {
            error!("Failed to update settings: mutex poisoned");
        }
        self.save_settings();
    }

    /// Update a single field (convenience methods)
    pub fn set_opacity(&self, opacity: f64) {
        if let Ok(mut settings) = self.settings.lock() {
            settings.opacity = opacity.clamp(0.3, 1.0);
        } else {
            error!("Failed to set opacity: mutex poisoned");
        }
        self.save_settings();
    }

    pub fn set_font_size(&self, font_size: u8) {
        if let Ok(mut settings) = self.settings.lock() {
            settings.font_size = font_size.clamp(10, 24);
        } else {
            error!("Failed to set font size: mutex poisoned");
        }
        self.save_settings();
    }

    pub fn set_pinned(&self, pinned: bool) {
        if let Ok(mut settings) = self.settings.lock() {
            settings.pinned = pinned;
        } else {
            error!("Failed to set pinned: mutex poisoned");
        }
        self.save_settings();
    }

    pub fn set_onboarding_complete(&self, complete: bool) {
        if let Ok(mut settings) = self.settings.lock() {
            settings.onboarding_complete = complete;
        } else {
            error!("Failed to set onboarding complete: mutex poisoned");
        }
        self.save_settings();
    }

    pub fn get_pinned(&self) -> bool {
        self.settings
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .pinned
    }

    pub fn get_global_shortcut(&self) -> String {
        self.settings
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .global_shortcut
            .clone()
    }

    pub fn get_pin_shortcut(&self) -> String {
        self.settings
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .pin_shortcut
            .clone()
    }

    pub fn is_shortcut_enabled(&self) -> bool {
        self.settings
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .shortcut_enabled
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    // ============== AppSettings tests ==============

    #[test]
    fn test_app_settings_default() {
        let settings = AppSettings::default();
        assert_eq!(settings.opacity, 0.9);
        assert_eq!(settings.font_size, 13);
        assert_eq!(settings.global_shortcut, "CommandOrControl+Shift+T");
        assert!(settings.shortcut_enabled);
        assert_eq!(settings.pin_shortcut, "CommandOrControl+Backquote");
        assert!(!settings.onboarding_complete);
        assert!(!settings.pinned);
    }

    #[test]
    fn test_app_settings_validate_opacity() {
        let mut settings = AppSettings::default();

        // Test clamping below minimum
        settings.opacity = 0.1;
        settings.validate();
        assert_eq!(settings.opacity, 0.3);

        // Test clamping above maximum
        settings.opacity = 1.5;
        settings.validate();
        assert_eq!(settings.opacity, 1.0);

        // Test valid values
        settings.opacity = 0.5;
        settings.validate();
        assert_eq!(settings.opacity, 0.5);

        settings.opacity = 0.3;
        settings.validate();
        assert_eq!(settings.opacity, 0.3);

        settings.opacity = 1.0;
        settings.validate();
        assert_eq!(settings.opacity, 1.0);
    }

    #[test]
    fn test_app_settings_validate_font_size() {
        let mut settings = AppSettings::default();

        // Test clamping below minimum
        settings.font_size = 5;
        settings.validate();
        assert_eq!(settings.font_size, 10);

        // Test clamping above maximum
        settings.font_size = 30;
        settings.validate();
        assert_eq!(settings.font_size, 24);

        // Test valid values
        settings.font_size = 15;
        settings.validate();
        assert_eq!(settings.font_size, 15);

        settings.font_size = 10;
        settings.validate();
        assert_eq!(settings.font_size, 10);

        settings.font_size = 24;
        settings.validate();
        assert_eq!(settings.font_size, 24);
    }

    #[test]
    fn test_app_settings_serialization() {
        let settings = AppSettings {
            opacity: 0.8,
            font_size: 14,
            global_shortcut: "CommandOrControl+T".to_string(),
            shortcut_enabled: false,
            pin_shortcut: "CommandOrControl+P".to_string(),
            onboarding_complete: true,
            pinned: true,
        };

        let json = serde_json::to_string(&settings).unwrap();
        let deserialized: AppSettings = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.opacity, settings.opacity);
        assert_eq!(deserialized.font_size, settings.font_size);
        assert_eq!(deserialized.global_shortcut, settings.global_shortcut);
        assert_eq!(deserialized.shortcut_enabled, settings.shortcut_enabled);
        assert_eq!(deserialized.pin_shortcut, settings.pin_shortcut);
        assert_eq!(
            deserialized.onboarding_complete,
            settings.onboarding_complete
        );
        assert_eq!(deserialized.pinned, settings.pinned);
    }

    #[test]
    fn test_app_settings_deserialization_with_defaults() {
        // Test that missing fields use defaults
        let json = r#"{"opacity": 0.7}"#;
        let settings: AppSettings = serde_json::from_str(json).unwrap();
        assert_eq!(settings.opacity, 0.7);
        assert_eq!(settings.font_size, 13); // default
        assert_eq!(settings.global_shortcut, "CommandOrControl+Shift+T"); // default
        assert!(settings.shortcut_enabled); // default
    }

    // ============== SettingsManager tests ==============

    fn create_temp_manager() -> (SettingsManager, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let settings_path = temp_dir.path().join("settings.json");
        let manager = SettingsManager::new(settings_path);
        (manager, temp_dir)
    }

    #[test]
    fn test_manager_new_uses_defaults() {
        let (manager, _temp_dir) = create_temp_manager();
        let settings = manager.get();
        assert_eq!(settings.opacity, 0.9);
        assert_eq!(settings.font_size, 13);
    }

    #[test]
    fn test_manager_get() {
        let (manager, _temp_dir) = create_temp_manager();
        let settings = manager.get();
        assert_eq!(settings.opacity, 0.9);
        assert_eq!(settings.font_size, 13);
    }

    #[test]
    fn test_manager_update() {
        let (manager, _temp_dir) = create_temp_manager();
        let mut new_settings = AppSettings::default();
        new_settings.opacity = 0.7;
        new_settings.font_size = 15;
        new_settings.pinned = true;

        manager.update(new_settings.clone());
        let retrieved = manager.get();

        assert_eq!(retrieved.opacity, 0.7);
        assert_eq!(retrieved.font_size, 15);
        assert!(retrieved.pinned);
    }

    #[test]
    fn test_manager_update_validates() {
        let (manager, _temp_dir) = create_temp_manager();
        let mut new_settings = AppSettings::default();
        new_settings.opacity = 2.0; // Invalid, should be clamped
        new_settings.font_size = 5; // Invalid, should be clamped

        manager.update(new_settings);
        let retrieved = manager.get();

        assert_eq!(retrieved.opacity, 1.0); // Clamped
        assert_eq!(retrieved.font_size, 10); // Clamped
    }

    #[test]
    fn test_manager_set_opacity() {
        let (manager, _temp_dir) = create_temp_manager();

        manager.set_opacity(0.7);
        assert_eq!(manager.get().opacity, 0.7);

        // Test clamping
        manager.set_opacity(0.1);
        assert_eq!(manager.get().opacity, 0.3);

        manager.set_opacity(1.5);
        assert_eq!(manager.get().opacity, 1.0);
    }

    #[test]
    fn test_manager_set_font_size() {
        let (manager, _temp_dir) = create_temp_manager();

        manager.set_font_size(15);
        assert_eq!(manager.get().font_size, 15);

        // Test clamping
        manager.set_font_size(5);
        assert_eq!(manager.get().font_size, 10);

        manager.set_font_size(30);
        assert_eq!(manager.get().font_size, 24);
    }

    #[test]
    fn test_manager_set_pinned() {
        let (manager, _temp_dir) = create_temp_manager();

        assert!(!manager.get_pinned());
        manager.set_pinned(true);
        assert!(manager.get_pinned());

        manager.set_pinned(false);
        assert!(!manager.get_pinned());
    }

    #[test]
    fn test_manager_get_pinned() {
        let (manager, _temp_dir) = create_temp_manager();

        assert!(!manager.get_pinned());
        manager.set_pinned(true);
        assert!(manager.get_pinned());
    }

    #[test]
    fn test_manager_set_onboarding_complete() {
        let (manager, _temp_dir) = create_temp_manager();

        let settings = manager.get();
        assert!(!settings.onboarding_complete);

        manager.set_onboarding_complete(true);
        let settings = manager.get();
        assert!(settings.onboarding_complete);

        manager.set_onboarding_complete(false);
        let settings = manager.get();
        assert!(!settings.onboarding_complete);
    }

    #[test]
    fn test_manager_get_global_shortcut() {
        let (manager, _temp_dir) = create_temp_manager();

        let shortcut = manager.get_global_shortcut();
        assert_eq!(shortcut, "CommandOrControl+Shift+T");

        // Update and verify
        let mut settings = manager.get();
        settings.global_shortcut = "CommandOrControl+T".to_string();
        manager.update(settings);

        let shortcut = manager.get_global_shortcut();
        assert_eq!(shortcut, "CommandOrControl+T");
    }

    #[test]
    fn test_manager_get_pin_shortcut() {
        let (manager, _temp_dir) = create_temp_manager();

        let shortcut = manager.get_pin_shortcut();
        assert_eq!(shortcut, "CommandOrControl+Backquote");

        // Update and verify
        let mut settings = manager.get();
        settings.pin_shortcut = "CommandOrControl+P".to_string();
        manager.update(settings);

        let shortcut = manager.get_pin_shortcut();
        assert_eq!(shortcut, "CommandOrControl+P");
    }

    #[test]
    fn test_manager_is_shortcut_enabled() {
        let (manager, _temp_dir) = create_temp_manager();

        assert!(manager.is_shortcut_enabled());

        // Update and verify
        let mut settings = manager.get();
        settings.shortcut_enabled = false;
        manager.update(settings);

        assert!(!manager.is_shortcut_enabled());
    }

    #[test]
    fn test_manager_persistence() {
        let temp_dir = TempDir::new().unwrap();
        let settings_path = temp_dir.path().join("settings.json");

        // Create manager and update settings
        {
            let manager = SettingsManager::new(settings_path.clone());
            manager.set_opacity(0.7);
            manager.set_font_size(15);
            manager.set_pinned(true);
        }

        // Create new manager and verify it loads the settings
        {
            let manager = SettingsManager::new(settings_path);
            let settings = manager.get();
            assert_eq!(settings.opacity, 0.7);
            assert_eq!(settings.font_size, 15);
            assert!(settings.pinned);
        }
    }

    #[test]
    fn test_manager_load_invalid_json() {
        let temp_dir = TempDir::new().unwrap();
        let settings_path = temp_dir.path().join("settings.json");

        // Write invalid JSON
        fs::write(&settings_path, "invalid json").unwrap();

        // Manager should handle invalid JSON gracefully and use defaults
        let manager = SettingsManager::new(settings_path);
        let settings = manager.get();
        assert_eq!(settings.opacity, 0.9); // default
        assert_eq!(settings.font_size, 13); // default
    }

    #[test]
    fn test_manager_load_settings_with_invalid_values() {
        let temp_dir = TempDir::new().unwrap();
        let settings_path = temp_dir.path().join("settings.json");

        // Write settings with invalid values (should be clamped)
        let json = r#"{"opacity": 2.0, "font_size": 5}"#;
        fs::write(&settings_path, json).unwrap();

        // Manager should validate and clamp values
        let manager = SettingsManager::new(settings_path);
        let settings = manager.get();
        assert_eq!(settings.opacity, 1.0); // Clamped
        assert_eq!(settings.font_size, 10); // Clamped
    }

    #[test]
    fn test_manager_multiple_operations() {
        let (manager, _temp_dir) = create_temp_manager();

        // Perform multiple operations
        manager.set_opacity(0.8);
        manager.set_font_size(14);
        manager.set_pinned(true);
        manager.set_onboarding_complete(true);

        let settings = manager.get();
        assert_eq!(settings.opacity, 0.8);
        assert_eq!(settings.font_size, 14);
        assert!(settings.pinned);
        assert!(settings.onboarding_complete);

        // Update all at once
        let mut new_settings = AppSettings::default();
        new_settings.opacity = 0.6;
        new_settings.font_size = 16;
        new_settings.pinned = false;
        manager.update(new_settings);

        let settings = manager.get();
        assert_eq!(settings.opacity, 0.6);
        assert_eq!(settings.font_size, 16);
        assert!(!settings.pinned);
    }
}
