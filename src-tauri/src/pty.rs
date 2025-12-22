use parking_lot::Mutex;
use portable_pty::{native_pty_system, Child, CommandBuilder, PtyPair, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use tauri::{AppHandle, Emitter};

/// Minimum allowed PTY columns
const MIN_PTY_COLS: u16 = 20;
/// Minimum allowed PTY rows
const MIN_PTY_ROWS: u16 = 5;
/// Maximum allowed PTY columns
const MAX_PTY_COLS: u16 = 500;
/// Maximum allowed PTY rows
const MAX_PTY_ROWS: u16 = 200;

/// Validate PTY dimensions
fn validate_pty_size(cols: u16, rows: u16) -> Result<(), String> {
    if !(MIN_PTY_COLS..=MAX_PTY_COLS).contains(&cols) {
        return Err(format!(
            "Invalid cols: {}. Must be between {} and {}",
            cols, MIN_PTY_COLS, MAX_PTY_COLS
        ));
    }
    if !(MIN_PTY_ROWS..=MAX_PTY_ROWS).contains(&rows) {
        return Err(format!(
            "Invalid rows: {}. Must be between {} and {}",
            rows, MIN_PTY_ROWS, MAX_PTY_ROWS
        ));
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtyOutput {
    pub session_id: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtyExit {
    pub session_id: String,
    pub exit_code: Option<i32>,
}

struct PtySession {
    #[allow(dead_code)]
    pair: PtyPair,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
    reader_thread: Option<JoinHandle<()>>,
    shutdown_flag: Arc<AtomicBool>,
}

pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, Arc<Mutex<PtySession>>>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn create_session(
        &self,
        app: AppHandle,
        cols: u16,
        rows: u16,
    ) -> Result<String, String> {
        // Validate PTY dimensions before creating session
        validate_pty_size(cols, rows)?;

        let session_id = uuid::Uuid::new_v4().to_string();

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to open PTY: {}", e))?;

        // Get the user's default shell
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        let home = std::env::var("HOME").unwrap_or_else(|_| "/".to_string());

        let mut cmd = CommandBuilder::new(&shell);
        cmd.cwd(&home);

        // Set up environment variables for proper terminal behavior
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");

        // Inherit important environment variables for shell compatibility
        cmd.env("HOME", &home);
        cmd.env("SHELL", &shell);
        if let Ok(user) = std::env::var("USER") {
            cmd.env("USER", user);
        }
        if let Ok(lang) = std::env::var("LANG") {
            cmd.env("LANG", lang);
        } else {
            cmd.env("LANG", "en_US.UTF-8");
        }
        if let Ok(path) = std::env::var("PATH") {
            cmd.env("PATH", path);
        }
        // LC_ALL for proper locale handling
        if let Ok(lc_all) = std::env::var("LC_ALL") {
            cmd.env("LC_ALL", lc_all);
        }

        // Spawn the shell process
        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn shell: {}", e))?;

        // Get the writer for sending input to the PTY
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to get PTY writer: {}", e))?;

        // Get the reader for receiving output from the PTY
        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to get PTY reader: {}", e))?;

        // Create shutdown flag for clean thread termination
        let shutdown_flag = Arc::new(AtomicBool::new(false));
        let shutdown_flag_clone = shutdown_flag.clone();

        let session = PtySession {
            pair,
            writer,
            child,
            reader_thread: None,
            shutdown_flag,
        };
        let session_arc = Arc::new(Mutex::new(session));
        let session_arc_for_thread = session_arc.clone();

        // Store the session
        {
            let mut sessions = self.sessions.lock();
            sessions.insert(session_id.clone(), session_arc.clone());
        }

        // Spawn a thread to read output from PTY and emit events
        let session_id_clone = session_id.clone();
        let app_clone = app.clone();
        let sessions_clone = self.sessions.clone();

        let reader_thread = thread::spawn(move || {
            let mut buffer = [0u8; 4096];
            loop {
                // Check if shutdown was requested
                if shutdown_flag_clone.load(Ordering::SeqCst) {
                    break;
                }

                match reader.read(&mut buffer) {
                    Ok(0) => {
                        // EOF - PTY closed
                        break;
                    }
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buffer[..n]).to_string();
                        let _ = app_clone.emit(
                            "pty-output",
                            PtyOutput {
                                session_id: session_id_clone.clone(),
                                data,
                            },
                        );
                    }
                    Err(e) => {
                        // Don't log error if shutdown was requested
                        if !shutdown_flag_clone.load(Ordering::SeqCst) {
                            eprintln!("PTY read error: {}", e);
                        }
                        break;
                    }
                }
            }

            // Wait for the child process to exit (only if not shutdown)
            let exit_code = if !shutdown_flag_clone.load(Ordering::SeqCst) {
                let mut session_guard = session_arc_for_thread.lock();
                session_guard.child.wait().ok().map(|status| {
                    if status.success() {
                        0
                    } else {
                        // portable-pty ExitStatus doesn't expose exit code directly
                        1
                    }
                })
            } else {
                None
            };

            // Emit exit event
            let _ = app_clone.emit(
                "pty-exit",
                PtyExit {
                    session_id: session_id_clone.clone(),
                    exit_code,
                },
            );

            // Remove session from map
            let mut sessions = sessions_clone.lock();
            sessions.remove(&session_id_clone);
        });

        // Store the thread handle
        {
            let mut session_guard = session_arc.lock();
            session_guard.reader_thread = Some(reader_thread);
        }

        Ok(session_id)
    }

    pub fn write_to_session(&self, session_id: &str, data: &str) -> Result<(), String> {
        let sessions = self.sessions.lock();
        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;

        let mut session_guard = session.lock();
        session_guard
            .writer
            .write_all(data.as_bytes())
            .map_err(|e| format!("Failed to write to PTY: {}", e))?;
        session_guard
            .writer
            .flush()
            .map_err(|e| format!("Failed to flush PTY: {}", e))?;

        Ok(())
    }

    pub fn resize_session(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        // Validate PTY dimensions before resizing
        validate_pty_size(cols, rows)?;

        let sessions = self.sessions.lock();
        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;

        let session_guard = session.lock();
        session_guard
            .pair
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to resize PTY: {}", e))?;

        Ok(())
    }

    pub fn close_session(&self, session_id: &str) -> Result<(), String> {
        let session = {
            let mut sessions = self.sessions.lock();
            sessions.remove(session_id)
        };

        if let Some(session_arc) = session {
            // Signal the reader thread to stop
            let (reader_thread, child_to_kill) = {
                let mut session_guard = session_arc.lock();
                session_guard.shutdown_flag.store(true, Ordering::SeqCst);

                // Take ownership of thread handle and prepare to kill child
                (session_guard.reader_thread.take(), true)
            };

            // Kill the child process to unblock the reader thread
            if child_to_kill {
                let mut session_guard = session_arc.lock();
                // Try to kill the child process - this will cause reader to get EOF
                let _ = session_guard.child.kill();
            }

            // Wait for the reader thread to finish (with timeout behavior)
            if let Some(handle) = reader_thread {
                // Join the thread - it should exit quickly after child is killed
                let _ = handle.join();
            }
        }

        Ok(())
    }
}

impl Default for PtyManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_pty_size_valid() {
        assert!(validate_pty_size(80, 24).is_ok());
        assert!(validate_pty_size(MIN_PTY_COLS, MIN_PTY_ROWS).is_ok());
        assert!(validate_pty_size(MAX_PTY_COLS, MAX_PTY_ROWS).is_ok());
        assert!(validate_pty_size(120, 40).is_ok());
    }

    #[test]
    fn test_validate_pty_size_invalid_cols() {
        // Too small
        assert!(validate_pty_size(MIN_PTY_COLS - 1, 24).is_err());
        assert!(validate_pty_size(0, 24).is_err());

        // Too large
        assert!(validate_pty_size(MAX_PTY_COLS + 1, 24).is_err());
        assert!(validate_pty_size(1000, 24).is_err());
    }

    #[test]
    fn test_validate_pty_size_invalid_rows() {
        // Too small
        assert!(validate_pty_size(80, MIN_PTY_ROWS - 1).is_err());
        assert!(validate_pty_size(80, 0).is_err());

        // Too large
        assert!(validate_pty_size(80, MAX_PTY_ROWS + 1).is_err());
        assert!(validate_pty_size(80, 500).is_err());
    }

    #[test]
    fn test_validate_pty_size_error_message() {
        let result = validate_pty_size(10, 24);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("cols"));
        assert!(err.contains("10"));

        let result = validate_pty_size(80, 2);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("rows"));
        assert!(err.contains("2"));
    }

    #[test]
    fn test_pty_manager_new() {
        let manager = PtyManager::new();
        let sessions = manager.sessions.lock();
        assert!(sessions.is_empty());
    }

    #[test]
    fn test_pty_manager_default() {
        let manager = PtyManager::default();
        let sessions = manager.sessions.lock();
        assert!(sessions.is_empty());
    }

    #[test]
    fn test_write_to_nonexistent_session() {
        let manager = PtyManager::new();
        let result = manager.write_to_session("nonexistent-session-id", "test");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Session not found"));
    }

    #[test]
    fn test_resize_nonexistent_session() {
        let manager = PtyManager::new();
        let result = manager.resize_session("nonexistent-session-id", 80, 24);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Session not found"));
    }

    #[test]
    fn test_close_nonexistent_session() {
        let manager = PtyManager::new();
        // Closing a non-existent session should succeed (no-op)
        let result = manager.close_session("nonexistent-session-id");
        assert!(result.is_ok());
    }

    #[test]
    fn test_resize_with_invalid_dimensions() {
        let manager = PtyManager::new();
        // Even with a non-existent session, validation should fail first
        let result = manager.resize_session("any-session", 0, 24);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid cols"));

        let result = manager.resize_session("any-session", 80, 0);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid rows"));
    }

    #[test]
    fn test_pty_output_serialization() {
        let output = PtyOutput {
            session_id: "test-session".to_string(),
            data: "Hello, World!".to_string(),
        };

        let json = serde_json::to_string(&output).unwrap();
        assert!(json.contains("test-session"));
        assert!(json.contains("Hello, World!"));

        let deserialized: PtyOutput = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.session_id, "test-session");
        assert_eq!(deserialized.data, "Hello, World!");
    }

    #[test]
    fn test_pty_exit_serialization() {
        let exit_with_code = PtyExit {
            session_id: "test-session".to_string(),
            exit_code: Some(0),
        };

        let json = serde_json::to_string(&exit_with_code).unwrap();
        let deserialized: PtyExit = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.session_id, "test-session");
        assert_eq!(deserialized.exit_code, Some(0));

        let exit_without_code = PtyExit {
            session_id: "test-session".to_string(),
            exit_code: None,
        };

        let json = serde_json::to_string(&exit_without_code).unwrap();
        let deserialized: PtyExit = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.exit_code, None);
    }

    #[test]
    fn test_pty_constants() {
        // Ensure constants are sensible
        assert!(MIN_PTY_COLS > 0);
        assert!(MIN_PTY_ROWS > 0);
        assert!(MAX_PTY_COLS > MIN_PTY_COLS);
        assert!(MAX_PTY_ROWS > MIN_PTY_ROWS);

        // Standard terminal size should be valid
        assert!(validate_pty_size(80, 24).is_ok());
        assert!(validate_pty_size(132, 43).is_ok()); // Wide terminal
    }
}
