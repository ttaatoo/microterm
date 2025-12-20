use parking_lot::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, PtyPair, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Arc;
use std::thread;
use tauri::{AppHandle, Emitter};

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
    pair: PtyPair,
    writer: Box<dyn Write + Send>,
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

        let mut cmd = CommandBuilder::new(&shell);
        cmd.cwd(std::env::var("HOME").unwrap_or_else(|_| "/".to_string()));

        // Set up environment variables for proper terminal behavior
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");

        // Spawn the shell process
        let mut child = pair
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

        let session = PtySession { pair, writer };
        let session_arc = Arc::new(Mutex::new(session));

        // Store the session
        {
            let mut sessions = self.sessions.lock();
            sessions.insert(session_id.clone(), session_arc);
        }

        // Spawn a thread to read output from PTY and emit events
        let session_id_clone = session_id.clone();
        let app_clone = app.clone();
        let sessions_clone = self.sessions.clone();

        thread::spawn(move || {
            let mut buffer = [0u8; 4096];
            loop {
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
                        eprintln!("PTY read error: {}", e);
                        break;
                    }
                }
            }

            // Wait for the child process to exit
            let exit_code = child.wait().ok().and_then(|status| {
                if status.success() {
                    Some(0)
                } else {
                    // portable-pty ExitStatus doesn't expose exit code directly
                    Some(1)
                }
            });

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
        let mut sessions = self.sessions.lock();
        sessions.remove(session_id);
        Ok(())
    }
}

impl Default for PtyManager {
    fn default() -> Self {
        Self::new()
    }
}
