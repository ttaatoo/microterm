//! Multi-screen window configuration management
//!
//! Manages window size and position per screen. Both are persisted to disk
//! so windows remember their placement when toggled or moved between screens.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tracing::{debug, error};

/// Window configuration for a specific screen
/// Both size and position are persisted to disk to remember window placement
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowConfig {
    /// Window width in logical pixels (persisted)
    pub width: f64,
    /// Window height in logical pixels (persisted)
    pub height: f64,
    /// X position in logical pixels (persisted, optional for backward compatibility)
    #[serde(default)]
    pub x: Option<f64>,
    /// Y position in logical pixels (persisted, optional for backward compatibility)
    #[serde(default)]
    pub y: Option<f64>,
}

/// Unique identifier for a screen based on its dimensions
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ScreenId(String);

impl ScreenId {
    /// Create a screen ID from dimensions (rounded to nearest pixel)
    pub fn from_dimensions(width: f64, height: f64) -> Self {
        Self(format!(
            "{}x{}",
            width.round() as i32,
            height.round() as i32
        ))
    }

    #[cfg(target_os = "macos")]
    pub fn from_display_id(display_id: objc2_core_graphics::CGDirectDisplayID) -> Self {
        Self(format!("display-{}", display_id))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// Multi-screen configuration manager
pub struct ScreenConfigManager {
    configs: Mutex<HashMap<ScreenId, WindowConfig>>,
    config_path: PathBuf,
}

impl ScreenConfigManager {
    /// Create a new manager with the given config file path
    pub fn new(config_path: PathBuf) -> Self {
        let configs = Self::load_configs(&config_path);
        Self {
            configs: Mutex::new(configs),
            config_path,
        }
    }

    /// Load configurations from disk
    fn load_configs(path: &PathBuf) -> HashMap<ScreenId, WindowConfig> {
        match fs::read_to_string(path) {
            Ok(content) => {
                match serde_json::from_str::<HashMap<ScreenId, WindowConfig>>(&content) {
                    Ok(configs) => {
                        debug!("Loaded {} screen configurations", configs.len());
                        configs
                    }
                    Err(e) => {
                        error!("Failed to parse screen config: {}", e);
                        HashMap::new()
                    }
                }
            }
            Err(_) => {
                debug!("No existing screen config file, starting fresh");
                HashMap::new()
            }
        }
    }

    /// Save configurations to disk
    fn save_configs(&self) {
        let configs = self.configs.lock().unwrap();
        match serde_json::to_string_pretty(&*configs) {
            Ok(json) => {
                if let Some(parent) = self.config_path.parent() {
                    let _ = fs::create_dir_all(parent);
                }
                match fs::write(&self.config_path, json) {
                    Ok(_) => debug!("Saved {} screen configurations", configs.len()),
                    Err(e) => error!("Failed to write screen config: {}", e),
                }
            }
            Err(e) => error!("Failed to serialize screen config: {}", e),
        }
    }

    /// Get the configuration for a specific screen
    pub fn get_config(&self, screen_id: &ScreenId) -> Option<WindowConfig> {
        self.configs.lock().unwrap().get(screen_id).cloned()
    }

    /// Save a configuration for a specific screen
    /// Both size and position are persisted to remember window placement
    pub fn set_config(&self, screen_id: ScreenId, config: WindowConfig) {
        let pos_str = match (&config.x, &config.y) {
            (Some(x), Some(y)) => format!(" at ({:.0}, {:.0})", x, y),
            _ => String::from(" (no position)"),
        };
        debug!(
            "Saving config for screen {}: {}x{}{}",
            screen_id.as_str(),
            config.width,
            config.height,
            pos_str
        );
        self.configs.lock().unwrap().insert(screen_id, config);
        self.save_configs();
    }

    /// Calculate default window size for a screen
    pub fn calculate_default_config(
        _screen_width: f64,
        _screen_height: f64,
        available_width: f64,
        available_height: f64,
    ) -> WindowConfig {
        // Use 95% of available screen space (leave margin for visual comfort)
        // No maximum limit - allow full screen if user wants
        const MARGIN_RATIO: f64 = 0.95;

        let width = available_width * MARGIN_RATIO;
        let height = available_height * MARGIN_RATIO;

        WindowConfig {
            width,
            height,
            x: None, // Will be calculated when positioning
            y: None,
        }
    }

    /// Get existing configuration or create a new one for a screen
    /// Returns (config, is_new) where is_new indicates if a new config was created
    pub fn get_or_create_config(
        &self,
        screen_id: &ScreenId,
        screen_width: f64,
        screen_height: f64,
        available_width: f64,
        available_height: f64,
    ) -> (WindowConfig, bool) {
        if let Some(config) = self.get_config(screen_id) {
            debug!("Using saved config for screen {}", screen_id.as_str());
            (config, false)
        } else {
            debug!("Creating new config for screen {}", screen_id.as_str());
            let config = Self::calculate_default_config(
                screen_width,
                screen_height,
                available_width,
                available_height,
            );
            (config, true)
        }
    }

    /// Clear configuration for a specific screen
    /// Returns true if config was removed, false if it didn't exist
    pub fn clear_config(&self, screen_id: &ScreenId) -> bool {
        let removed = self.configs.lock().unwrap().remove(screen_id).is_some();
        if removed {
            debug!("Cleared config for screen {}", screen_id.as_str());
            self.save_configs();
        }
        removed
    }

    /// Clear all screen configurations
    pub fn clear_all_configs(&self) {
        let count = {
            let mut configs = self.configs.lock().unwrap();
            let count = configs.len();
            configs.clear();
            count
        };
        debug!("Cleared all {} screen configurations", count);
        self.save_configs();
    }

    /// Get all screen IDs with saved configurations
    pub fn get_all_screen_ids(&self) -> Vec<String> {
        self.configs
            .lock()
            .unwrap()
            .keys()
            .map(|id| id.as_str().to_string())
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    // ============== ScreenId tests ==============

    #[test]
    fn test_screen_id_from_dimensions() {
        let id = ScreenId::from_dimensions(1920.0, 1080.0);
        assert_eq!(id.as_str(), "1920x1080");

        let id = ScreenId::from_dimensions(2560.5, 1440.7);
        assert_eq!(id.as_str(), "2561x1441"); // Rounded

        let id = ScreenId::from_dimensions(0.0, 0.0);
        assert_eq!(id.as_str(), "0x0");
    }

    #[test]
    fn test_screen_id_equality() {
        let id1 = ScreenId::from_dimensions(1920.0, 1080.0);
        let id2 = ScreenId::from_dimensions(1920.0, 1080.0);
        let id3 = ScreenId::from_dimensions(1920.1, 1080.1);
        let id4 = ScreenId::from_dimensions(2560.0, 1440.0);

        assert_eq!(id1, id2);
        assert_eq!(id1, id3); // Rounded to same value
        assert_ne!(id1, id4);
    }

    #[test]
    fn test_screen_id_hash() {
        use std::collections::HashSet;

        let id1 = ScreenId::from_dimensions(1920.0, 1080.0);
        let id2 = ScreenId::from_dimensions(1920.0, 1080.0);
        let id3 = ScreenId::from_dimensions(2560.0, 1440.0);

        let mut set = HashSet::new();
        set.insert(id1.clone());
        set.insert(id2.clone());
        set.insert(id3.clone());

        // id1 and id2 should be considered the same
        assert_eq!(set.len(), 2);
        assert!(set.contains(&ScreenId::from_dimensions(1920.0, 1080.0)));
    }

    #[test]
    fn test_screen_id_serialization() {
        let id = ScreenId::from_dimensions(1920.0, 1080.0);
        let json = serde_json::to_string(&id).unwrap();
        let deserialized: ScreenId = serde_json::from_str(&json).unwrap();
        assert_eq!(id, deserialized);
    }

    // ============== WindowConfig tests ==============

    #[test]
    fn test_window_config_creation() {
        let config = WindowConfig {
            width: 800.0,
            height: 600.0,
            x: Some(100.0),
            y: Some(200.0),
        };

        assert_eq!(config.width, 800.0);
        assert_eq!(config.height, 600.0);
        assert_eq!(config.x, Some(100.0));
        assert_eq!(config.y, Some(200.0));
    }

    #[test]
    fn test_window_config_without_position() {
        let config = WindowConfig {
            width: 800.0,
            height: 600.0,
            x: None,
            y: None,
        };

        assert_eq!(config.width, 800.0);
        assert_eq!(config.height, 600.0);
        assert_eq!(config.x, None);
        assert_eq!(config.y, None);
    }

    #[test]
    fn test_window_config_serialization() {
        let config = WindowConfig {
            width: 800.0,
            height: 600.0,
            x: Some(100.0),
            y: Some(200.0),
        };

        let json = serde_json::to_string(&config).unwrap();
        let deserialized: WindowConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(config.width, deserialized.width);
        assert_eq!(config.height, deserialized.height);
        assert_eq!(config.x, deserialized.x);
        assert_eq!(config.y, deserialized.y);
    }

    #[test]
    fn test_window_config_serialization_without_position() {
        let config = WindowConfig {
            width: 800.0,
            height: 600.0,
            x: None,
            y: None,
        };

        let json = serde_json::to_string(&config).unwrap();
        let deserialized: WindowConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(config.width, deserialized.width);
        assert_eq!(config.height, deserialized.height);
        assert_eq!(deserialized.x, None);
        assert_eq!(deserialized.y, None);
    }

    #[test]
    fn test_window_config_backward_compatibility() {
        // Test that missing x/y fields default to None
        let json = r#"{"width": 800.0, "height": 600.0}"#;
        let config: WindowConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.width, 800.0);
        assert_eq!(config.height, 600.0);
        assert_eq!(config.x, None);
        assert_eq!(config.y, None);
    }

    // ============== ScreenConfigManager tests ==============

    fn create_temp_manager() -> (ScreenConfigManager, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("screen_config.json");
        let manager = ScreenConfigManager::new(config_path);
        (manager, temp_dir)
    }

    #[test]
    fn test_manager_new_creates_empty() {
        let (manager, _temp_dir) = create_temp_manager();
        let screen_ids = manager.get_all_screen_ids();
        assert!(screen_ids.is_empty());
    }

    #[test]
    fn test_manager_get_config_nonexistent() {
        let (manager, _temp_dir) = create_temp_manager();
        let screen_id = ScreenId::from_dimensions(1920.0, 1080.0);
        assert!(manager.get_config(&screen_id).is_none());
    }

    #[test]
    fn test_manager_set_and_get_config() {
        let (manager, _temp_dir) = create_temp_manager();
        let screen_id = ScreenId::from_dimensions(1920.0, 1080.0);
        let config = WindowConfig {
            width: 800.0,
            height: 600.0,
            x: Some(100.0),
            y: Some(200.0),
        };

        manager.set_config(screen_id.clone(), config.clone());
        let retrieved = manager.get_config(&screen_id);

        assert!(retrieved.is_some());
        let retrieved = retrieved.unwrap();
        assert_eq!(retrieved.width, config.width);
        assert_eq!(retrieved.height, config.height);
        assert_eq!(retrieved.x, config.x);
        assert_eq!(retrieved.y, config.y);
    }

    #[test]
    fn test_manager_set_config_overwrites() {
        let (manager, _temp_dir) = create_temp_manager();
        let screen_id = ScreenId::from_dimensions(1920.0, 1080.0);

        let config1 = WindowConfig {
            width: 800.0,
            height: 600.0,
            x: Some(100.0),
            y: Some(200.0),
        };
        manager.set_config(screen_id.clone(), config1);

        let config2 = WindowConfig {
            width: 1000.0,
            height: 700.0,
            x: Some(50.0),
            y: Some(150.0),
        };
        manager.set_config(screen_id.clone(), config2.clone());

        let retrieved = manager.get_config(&screen_id).unwrap();
        assert_eq!(retrieved.width, 1000.0);
        assert_eq!(retrieved.height, 700.0);
    }

    #[test]
    fn test_manager_calculate_default_config() {
        let config = ScreenConfigManager::calculate_default_config(
            1920.0, // screen_width
            1080.0, // screen_height
            1900.0, // available_width
            1050.0, // available_height
        );

        // Should be 95% of available space
        assert_eq!(config.width, 1900.0 * 0.95);
        assert_eq!(config.height, 1050.0 * 0.95);
        assert_eq!(config.x, None);
        assert_eq!(config.y, None);
    }

    #[test]
    fn test_manager_get_or_create_config_existing() {
        let (manager, _temp_dir) = create_temp_manager();
        let screen_id = ScreenId::from_dimensions(1920.0, 1080.0);
        let saved_config = WindowConfig {
            width: 800.0,
            height: 600.0,
            x: Some(100.0),
            y: Some(200.0),
        };

        manager.set_config(screen_id.clone(), saved_config.clone());
        let (config, is_new) =
            manager.get_or_create_config(&screen_id, 1920.0, 1080.0, 1900.0, 1050.0);

        assert!(!is_new);
        assert_eq!(config.width, saved_config.width);
        assert_eq!(config.height, saved_config.height);
    }

    #[test]
    fn test_manager_get_or_create_config_new() {
        let (manager, _temp_dir) = create_temp_manager();
        let screen_id = ScreenId::from_dimensions(1920.0, 1080.0);

        let (config, is_new) =
            manager.get_or_create_config(&screen_id, 1920.0, 1080.0, 1900.0, 1050.0);

        assert!(is_new);
        assert_eq!(config.width, 1900.0 * 0.95);
        assert_eq!(config.height, 1050.0 * 0.95);
    }

    #[test]
    fn test_manager_clear_config_existing() {
        let (manager, _temp_dir) = create_temp_manager();
        let screen_id = ScreenId::from_dimensions(1920.0, 1080.0);
        let config = WindowConfig {
            width: 800.0,
            height: 600.0,
            x: None,
            y: None,
        };

        manager.set_config(screen_id.clone(), config);
        assert!(manager.get_config(&screen_id).is_some());

        let removed = manager.clear_config(&screen_id);
        assert!(removed);
        assert!(manager.get_config(&screen_id).is_none());
    }

    #[test]
    fn test_manager_clear_config_nonexistent() {
        let (manager, _temp_dir) = create_temp_manager();
        let screen_id = ScreenId::from_dimensions(1920.0, 1080.0);

        let removed = manager.clear_config(&screen_id);
        assert!(!removed);
    }

    #[test]
    fn test_manager_clear_all_configs() {
        let (manager, _temp_dir) = create_temp_manager();
        let screen_id1 = ScreenId::from_dimensions(1920.0, 1080.0);
        let screen_id2 = ScreenId::from_dimensions(2560.0, 1440.0);

        manager.set_config(
            screen_id1.clone(),
            WindowConfig {
                width: 800.0,
                height: 600.0,
                x: None,
                y: None,
            },
        );
        manager.set_config(
            screen_id2.clone(),
            WindowConfig {
                width: 1000.0,
                height: 700.0,
                x: None,
                y: None,
            },
        );

        assert_eq!(manager.get_all_screen_ids().len(), 2);
        manager.clear_all_configs();
        assert_eq!(manager.get_all_screen_ids().len(), 0);
        assert!(manager.get_config(&screen_id1).is_none());
        assert!(manager.get_config(&screen_id2).is_none());
    }

    #[test]
    fn test_manager_get_all_screen_ids() {
        let (manager, _temp_dir) = create_temp_manager();
        let screen_id1 = ScreenId::from_dimensions(1920.0, 1080.0);
        let screen_id2 = ScreenId::from_dimensions(2560.0, 1440.0);

        manager.set_config(
            screen_id1.clone(),
            WindowConfig {
                width: 800.0,
                height: 600.0,
                x: None,
                y: None,
            },
        );
        manager.set_config(
            screen_id2.clone(),
            WindowConfig {
                width: 1000.0,
                height: 700.0,
                x: None,
                y: None,
            },
        );

        let ids = manager.get_all_screen_ids();
        assert_eq!(ids.len(), 2);
        assert!(ids.contains(&"1920x1080".to_string()));
        assert!(ids.contains(&"2560x1440".to_string()));
    }

    #[test]
    fn test_manager_persistence() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("screen_config.json");

        // Create manager and save config
        {
            let manager = ScreenConfigManager::new(config_path.clone());
            let screen_id = ScreenId::from_dimensions(1920.0, 1080.0);
            let config = WindowConfig {
                width: 800.0,
                height: 600.0,
                x: Some(100.0),
                y: Some(200.0),
            };
            manager.set_config(screen_id.clone(), config);
        }

        // Create new manager and verify it loads the config
        {
            let manager = ScreenConfigManager::new(config_path);
            let screen_id = ScreenId::from_dimensions(1920.0, 1080.0);
            let retrieved = manager.get_config(&screen_id);

            assert!(retrieved.is_some());
            let retrieved = retrieved.unwrap();
            assert_eq!(retrieved.width, 800.0);
            assert_eq!(retrieved.height, 600.0);
            assert_eq!(retrieved.x, Some(100.0));
            assert_eq!(retrieved.y, Some(200.0));
        }
    }

    #[test]
    fn test_manager_load_invalid_json() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("screen_config.json");

        // Write invalid JSON
        fs::write(&config_path, "invalid json").unwrap();

        // Manager should handle invalid JSON gracefully
        let manager = ScreenConfigManager::new(config_path);
        let screen_ids = manager.get_all_screen_ids();
        assert!(screen_ids.is_empty());
    }

    #[test]
    fn test_manager_multiple_screens() {
        let (manager, _temp_dir) = create_temp_manager();
        let screen_id1 = ScreenId::from_dimensions(1920.0, 1080.0);
        let screen_id2 = ScreenId::from_dimensions(2560.0, 1440.0);
        let screen_id3 = ScreenId::from_dimensions(3840.0, 2160.0);

        manager.set_config(
            screen_id1.clone(),
            WindowConfig {
                width: 800.0,
                height: 600.0,
                x: Some(100.0),
                y: Some(200.0),
            },
        );
        manager.set_config(
            screen_id2.clone(),
            WindowConfig {
                width: 1200.0,
                height: 800.0,
                x: Some(50.0),
                y: Some(100.0),
            },
        );
        manager.set_config(
            screen_id3.clone(),
            WindowConfig {
                width: 1600.0,
                height: 1000.0,
                x: Some(200.0),
                y: Some(300.0),
            },
        );

        assert_eq!(manager.get_all_screen_ids().len(), 3);
        assert!(manager.get_config(&screen_id1).is_some());
        assert!(manager.get_config(&screen_id2).is_some());
        assert!(manager.get_config(&screen_id3).is_some());

        // Clear one screen
        manager.clear_config(&screen_id2);
        assert_eq!(manager.get_all_screen_ids().len(), 2);
        assert!(manager.get_config(&screen_id1).is_some());
        assert!(manager.get_config(&screen_id2).is_none());
        assert!(manager.get_config(&screen_id3).is_some());
    }
}
