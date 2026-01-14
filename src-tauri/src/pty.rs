use parking_lot::Mutex;
use portable_pty::{native_pty_system, Child, CommandBuilder, PtyPair, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use tauri::{AppHandle, Emitter};
use tracing::{debug, error, info, trace, warn};

/// Minimum allowed PTY columns
const MIN_PTY_COLS: u16 = 20;
/// Minimum allowed PTY rows
const MIN_PTY_ROWS: u16 = 5;
/// Maximum allowed PTY columns
const MAX_PTY_COLS: u16 = 500;
/// Maximum allowed PTY rows
const MAX_PTY_ROWS: u16 = 200;
/// PTY read buffer size (8KB for better throughput)
const PTY_READ_BUFFER_SIZE: usize = 8192;

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
    child_pid: Option<u32>,
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

    pub fn create_session(&self, app: AppHandle, cols: u16, rows: u16) -> Result<String, String> {
        // Validate PTY dimensions before creating session
        validate_pty_size(cols, rows)?;

        let session_id = uuid::Uuid::new_v4().to_string();
        debug!(session_id = %session_id, cols, rows, "Creating PTY session");

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

        info!(session_id = %session_id, "Setting PTY environment: TERM=xterm-256color, COLORTERM=truecolor");

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

        // Build PATH with common tool locations
        // macOS GUI apps don't inherit shell PATH, so we need to include common paths
        let mut path_dirs: Vec<String> = Vec::new();

        // Add user's local bin directories first (highest priority)
        if !home.is_empty() {
            path_dirs.push(format!("{}/bin", home));
            path_dirs.push(format!("{}/.local/bin", home));
        }

        // Add common system paths
        path_dirs.extend([
            "/opt/homebrew/bin".to_string(), // Homebrew on Apple Silicon
            "/opt/homebrew/sbin".to_string(),
            "/usr/local/bin".to_string(), // Homebrew on Intel Mac
            "/usr/local/sbin".to_string(),
            "/usr/bin".to_string(),
            "/bin".to_string(),
            "/usr/sbin".to_string(),
            "/sbin".to_string(),
        ]);

        // Append any existing PATH from the environment
        let base_path = path_dirs.join(":");
        let full_path = if let Ok(existing_path) = std::env::var("PATH") {
            format!("{}:{}", base_path, existing_path)
        } else {
            base_path
        };
        cmd.env("PATH", full_path);
        // LC_ALL for proper locale handling
        if let Ok(lc_all) = std::env::var("LC_ALL") {
            cmd.env("LC_ALL", lc_all);
        }

        // Spawn the shell process
        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn shell: {}", e))?;

        // Get the child process ID for CWD tracking
        let child_pid = child.process_id();

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
            child_pid,
            reader_thread: None,
            shutdown_flag,
        };
        let session_arc = Arc::new(Mutex::new(session));
        let session_arc_for_thread = session_arc.clone();

        // Spawn a thread to read output from PTY and emit events
        // NOTE: We spawn the thread BEFORE inserting into HashMap to avoid leaking
        // orphaned sessions if thread spawn fails
        // Use Arc<str> to avoid cloning session_id on every emit
        let session_id_arc: Arc<str> = session_id.clone().into();
        let session_id_for_thread = session_id_arc.clone();
        let session_id_for_cleanup = session_id.clone();
        let app_clone = app.clone();
        let sessions_clone = self.sessions.clone();

        let reader_thread = thread::spawn(move || {
            // Use larger buffer for better throughput
            let mut buffer = [0u8; PTY_READ_BUFFER_SIZE];
            // Buffer for incomplete UTF-8 sequences at boundary
            let mut utf8_buffer: Vec<u8> = Vec::new();

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
                        // Combine any previous incomplete UTF-8 bytes with new data
                        let mut full_buffer = utf8_buffer.clone();
                        full_buffer.extend_from_slice(&buffer[..n]);
                        utf8_buffer.clear();

                        // Try to convert to UTF-8
                        let data = match std::str::from_utf8(&full_buffer) {
                            Ok(s) => s.to_string(),
                            Err(e) => {
                                // UTF-8 error - likely incomplete sequence at end
                                let valid_up_to = e.valid_up_to();

                                // Save incomplete bytes for next iteration
                                // SAFETY: UTF-8 sequences are at most 4 bytes. If buffer exceeds this,
                                // discard it to prevent memory leaks from malformed data
                                if valid_up_to < full_buffer.len() {
                                    let incomplete_len = full_buffer.len() - valid_up_to;
                                    if incomplete_len <= 4 {
                                        utf8_buffer.extend_from_slice(&full_buffer[valid_up_to..]);
                                    } else {
                                        // Malformed data exceeds max UTF-8 sequence length
                                        warn!(
                                            session_id = %session_id_for_thread,
                                            incomplete_len = incomplete_len,
                                            "Discarding malformed UTF-8 data exceeding 4 bytes"
                                        );
                                        utf8_buffer.clear();
                                    }
                                }

                                // Convert valid portion
                                String::from_utf8_lossy(&full_buffer[..valid_up_to]).to_string()
                            }
                        };

                        // Trace: Check for potential escape sequence fragmentation
                        // This helps identify if PTY buffer boundaries split multi-byte sequences
                        // NOTE: This is expected and xterm.js handles it gracefully
                        if cfg!(debug_assertions)
                            && (data.ends_with('\x1b') || data.ends_with("\x1b["))
                        {
                            // Safely get last few chars (respecting UTF-8 boundaries)
                            let tail_preview: String = data
                                .chars()
                                .rev()
                                .take(5)
                                .collect::<Vec<_>>()
                                .into_iter()
                                .rev()
                                .collect();
                            trace!(
                                session_id = %session_id_for_thread,
                                chunk_size = n,
                                ends_with = format!("{:?}", tail_preview),
                                "Escape sequence fragmentation at buffer boundary (expected, handled by xterm.js)"
                            );
                        }

                        let _ = app_clone.emit(
                            "pty-output",
                            PtyOutput {
                                session_id: session_id_for_thread.to_string(),
                                data,
                            },
                        );
                    }
                    Err(e) => {
                        // Don't log error if shutdown was requested
                        if !shutdown_flag_clone.load(Ordering::SeqCst) {
                            error!(session_id = %session_id_for_thread, error = %e, "PTY read error");
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
                    session_id: session_id_for_thread.to_string(),
                    exit_code,
                },
            );

            // Remove session from map
            let mut sessions = sessions_clone.lock();
            sessions.remove(&session_id_for_cleanup);
        });

        // Store the thread handle FIRST (before inserting into HashMap)
        {
            let mut session_guard = session_arc.lock();
            session_guard.reader_thread = Some(reader_thread);
        }

        // NOW insert into HashMap - thread is already running and properly attached
        // This ensures we never have orphaned sessions in the HashMap
        {
            let mut sessions = self.sessions.lock();
            sessions.insert(session_id.clone(), session_arc);
        }

        info!(session_id = %session_id, "PTY session created successfully");
        Ok(session_id)
    }

    pub fn write_to_session(&self, session_id: &str, data: &str) -> Result<(), String> {
        // Get the Arc<Mutex<PtySession>> under lock, then release immediately
        // This prevents blocking all sessions during I/O on one session
        let session_arc = {
            let sessions = self.sessions.lock();
            sessions
                .get(session_id)
                .cloned() // Clone the Arc (cheap - just incrementing ref count)
                .ok_or_else(|| format!("Session not found: {}", session_id))?
        }; // sessions lock released here

        // Now only hold the individual session lock during I/O
        let mut session_guard = session_arc.lock();
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

        // Get the Arc<Mutex<PtySession>> under lock, then release immediately
        let session_arc = {
            let sessions = self.sessions.lock();
            sessions
                .get(session_id)
                .cloned() // Clone the Arc (cheap - just incrementing ref count)
                .ok_or_else(|| format!("Session not found: {}", session_id))?
        }; // sessions lock released here

        // Now only hold the individual session lock during resize
        let session_guard = session_arc.lock();
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

    /// Get the current working directory of a PTY session's shell process
    #[cfg(target_os = "macos")]
    pub fn get_session_cwd(&self, session_id: &str) -> Result<Option<String>, String> {
        let sessions = self.sessions.lock();
        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;

        let session_guard = session.lock();
        let pid = match session_guard.child_pid {
            Some(pid) => pid,
            None => return Ok(None),
        };

        // Use libproc to get the current working directory
        use std::ffi::CStr;
        use std::mem::MaybeUninit;
        use std::os::raw::{c_char, c_int};

        // Constants from sys/proc_info.h
        const PROC_PIDVNODEPATHINFO: c_int = 9;

        #[repr(C)]
        struct vnode_info_path {
            _vip_vi: [u8; 152],       // vnode_info structure (we don't need its contents)
            vip_path: [c_char; 1024], // MAXPATHLEN
        }

        #[repr(C)]
        struct proc_vnodepathinfo {
            pvi_cdir: vnode_info_path,
            pvi_rdir: vnode_info_path,
        }

        extern "C" {
            fn proc_pidinfo(
                pid: c_int,
                flavor: c_int,
                arg: u64,
                buffer: *mut std::ffi::c_void,
                buffersize: c_int,
            ) -> c_int;
        }

        let mut info: MaybeUninit<proc_vnodepathinfo> = MaybeUninit::uninit();
        let info_size = std::mem::size_of::<proc_vnodepathinfo>() as c_int;

        let ret = unsafe {
            proc_pidinfo(
                pid as c_int,
                PROC_PIDVNODEPATHINFO,
                0,
                info.as_mut_ptr() as *mut std::ffi::c_void,
                info_size,
            )
        };

        if ret <= 0 {
            return Ok(None);
        }

        let info = unsafe { info.assume_init() };
        let cwd = unsafe { CStr::from_ptr(info.pvi_cdir.vip_path.as_ptr()) };

        match cwd.to_str() {
            Ok(s) if !s.is_empty() => Ok(Some(s.to_string())),
            _ => Ok(None),
        }
    }

    #[cfg(not(target_os = "macos"))]
    pub fn get_session_cwd(&self, session_id: &str) -> Result<Option<String>, String> {
        // On non-macOS platforms, try to read /proc/<pid>/cwd
        let sessions = self.sessions.lock();
        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;

        let session_guard = session.lock();
        let pid = match session_guard.child_pid {
            Some(pid) => pid,
            None => return Ok(None),
        };

        let cwd_path = format!("/proc/{}/cwd", pid);
        match std::fs::read_link(&cwd_path) {
            Ok(path) => Ok(Some(path.to_string_lossy().to_string())),
            Err(_) => Ok(None),
        }
    }

    pub fn close_session(&self, session_id: &str) -> Result<(), String> {
        debug!(session_id = %session_id, "Closing PTY session");
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
            info!(session_id = %session_id, "PTY session closed");
        } else {
            debug!(session_id = %session_id, "PTY session not found (already closed)");
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
