//! Command execution module for µTerm
//!
//! Provides synchronous and streaming command execution capabilities.

use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tauri::{command, AppHandle, Emitter, Manager};
use tokio::io::AsyncReadExt;
use tokio::io::BufReader as TokioBufReader;
use tokio::process::Command as TokioCommand;

/// Buffer size for reading command output streams
const STREAM_BUFFER_SIZE: usize = 1024;

/// Maximum length for command strings to prevent DoS
const MAX_COMMAND_LENGTH: usize = 4096;

/// Maximum length for individual arguments
const MAX_ARG_LENGTH: usize = 4096;

/// Maximum number of arguments allowed
const MAX_ARGS_COUNT: usize = 100;

/// Common shell built-in commands for tab completion
const BUILTIN_COMMANDS: &[&str] = &[
    "alias", "cat", "cd", "clear", "cp", "echo", "exit", "export", "find", "grep", "help",
    "history", "ls", "mkdir", "mv", "pwd", "quit", "rm", "type", "unalias", "unset", "where",
    "which",
];

/// Characters that are not allowed in command names for security
/// These could be used for shell injection if passed to a shell
const FORBIDDEN_COMMAND_CHARS: &[char] = &[
    ';', '&', '|', '$', '`', '(', ')', '{', '}', '[', ']', '<', '>', '\n', '\r', '\0', '\'', '"',
    '\\',
];

/// Validate a command string for security
fn validate_command(cmd: &str) -> Result<(), String> {
    // Check for empty command
    if cmd.is_empty() {
        return Err("Command cannot be empty".to_string());
    }

    // Check command length
    if cmd.len() > MAX_COMMAND_LENGTH {
        return Err(format!(
            "Command too long: {} chars (max {})",
            cmd.len(),
            MAX_COMMAND_LENGTH
        ));
    }

    // Check for forbidden characters that could enable shell injection
    for c in FORBIDDEN_COMMAND_CHARS {
        if cmd.contains(*c) {
            let char_display = match *c {
                '\n' => "\\n".to_string(),
                '\r' => "\\r".to_string(),
                '\0' => "\\0".to_string(),
                other => other.to_string(),
            };
            return Err(format!(
                "Command contains forbidden character '{}'. Use proper arguments instead of shell syntax.",
                char_display
            ));
        }
    }

    // Check that command doesn't start with a dash (option injection)
    if cmd.starts_with('-') {
        return Err("Command cannot start with '-'".to_string());
    }

    // Check for path traversal attempts in command name
    if cmd.contains("..") {
        return Err("Command cannot contain '..' path traversal".to_string());
    }

    Ok(())
}

/// Validate arguments for security
fn validate_args(args: &[String]) -> Result<(), String> {
    // Check argument count
    if args.len() > MAX_ARGS_COUNT {
        return Err(format!(
            "Too many arguments: {} (max {})",
            args.len(),
            MAX_ARGS_COUNT
        ));
    }

    // Validate each argument
    for (i, arg) in args.iter().enumerate() {
        if arg.len() > MAX_ARG_LENGTH {
            return Err(format!(
                "Argument {} too long: {} chars (max {})",
                i,
                arg.len(),
                MAX_ARG_LENGTH
            ));
        }

        // Check for null bytes which could cause truncation
        if arg.contains('\0') {
            return Err(format!("Argument {} contains null byte", i));
        }
    }

    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CommandResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamChunk {
    pub chunk: String,
    pub is_stderr: bool,
}

#[command]
pub async fn execute_command(cmd: String, args: Vec<String>) -> Result<CommandResult, String> {
    use std::process::Command;

    // Validate command and arguments for security
    validate_command(&cmd)?;
    validate_args(&args)?;

    // Execute command with proper error handling
    let output = Command::new(&cmd)
        .args(&args)
        .output()
        .map_err(|e| {
            // Provide more specific error messages
            match e.kind() {
                std::io::ErrorKind::NotFound => {
                    format!("Command not found: '{}'. Make sure the command is installed and in your PATH.", cmd)
                }
                std::io::ErrorKind::PermissionDenied => {
                    format!("Permission denied: '{}'. You may need to run this command with elevated privileges.", cmd)
                }
                _ => format!("Failed to execute '{}': {}", cmd, e),
            }
        })?;

    Ok(CommandResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(0),
    })
}

#[command]
pub async fn execute_command_stream(
    app: AppHandle,
    cmd: String,
    args: Vec<String>,
) -> Result<i32, String> {
    // Validate command and arguments for security
    validate_command(&cmd)?;
    validate_args(&args)?;

    let mut child = TokioCommand::new(&cmd)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            match e.kind() {
                std::io::ErrorKind::NotFound => {
                    format!("Command not found: '{}'. Make sure the command is installed and in your PATH.", cmd)
                }
                std::io::ErrorKind::PermissionDenied => {
                    format!("Permission denied: '{}'. You may need to run this command with elevated privileges.", cmd)
                }
                _ => format!("Failed to execute '{}': {}", cmd, e),
            }
        })?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let app_stdout = app.clone();
    let app_stderr = app.clone();

    // Handle stdout - read in chunks for real-time streaming with error logging
    tokio::spawn(async move {
        let mut reader = TokioBufReader::new(stdout);
        let mut buffer = vec![0u8; STREAM_BUFFER_SIZE];

        loop {
            match reader.read(&mut buffer).await {
                Ok(0) => break, // EOF
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buffer[..n]).to_string();
                    if let Err(e) = app_stdout.emit(
                        "command-stdout",
                        StreamChunk {
                            chunk,
                            is_stderr: false,
                        },
                    ) {
                        eprintln!("Failed to emit stdout event: {}", e);
                        break;
                    }
                }
                Err(e) => {
                    eprintln!("Error reading stdout: {}", e);
                    break;
                }
            }
        }
    });

    // Handle stderr - read in chunks for real-time streaming with error logging
    tokio::spawn(async move {
        let mut reader = TokioBufReader::new(stderr);
        let mut buffer = vec![0u8; STREAM_BUFFER_SIZE];

        loop {
            match reader.read(&mut buffer).await {
                Ok(0) => break, // EOF
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buffer[..n]).to_string();
                    if let Err(e) = app_stderr.emit(
                        "command-stderr",
                        StreamChunk {
                            chunk,
                            is_stderr: true,
                        },
                    ) {
                        eprintln!("Failed to emit stderr event: {}", e);
                        break;
                    }
                }
                Err(e) => {
                    eprintln!("Error reading stderr: {}", e);
                    break;
                }
            }
        }
    });

    // Wait for command to complete
    let exit_code = child
        .wait()
        .await
        .map_err(|e| format!("Failed to wait for command: {}", e))?;

    // Emit completion event
    let _ = app.emit("command-complete", exit_code.code().unwrap_or(0));

    Ok(exit_code.code().unwrap_or(0))
}

#[command]
pub async fn complete_command(prefix: String) -> Result<Vec<String>, String> {
    use std::env;

    let mut completions = Vec::new();

    // If prefix is empty, return empty list
    if prefix.is_empty() {
        return Ok(completions);
    }

    // Get PATH environment variable
    let path_var = env::var("PATH").unwrap_or_default();
    let paths: Vec<&str> = path_var.split(':').collect();

    for path_str in paths {
        if let Ok(entries) = std::fs::read_dir(path_str) {
            for entry in entries.flatten() {
                if let Some(name) = entry.file_name().to_str() {
                    if name.starts_with(&prefix) {
                        // Check if it's executable
                        let path = entry.path();
                        if path.is_file() {
                            #[cfg(unix)]
                            {
                                use std::os::unix::fs::PermissionsExt;
                                if let Ok(metadata) = entry.metadata() {
                                    let mode = metadata.permissions().mode();
                                    if mode & 0o111 != 0 {
                                        // Executable
                                        completions.push(name.to_string());
                                    }
                                }
                            }
                            #[cfg(not(unix))]
                            {
                                // On Windows, check file extension
                                if let Some(ext) = path.extension() {
                                    if ext == "exe" || ext == "bat" || ext == "cmd" {
                                        completions.push(name.to_string());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Also check common shell built-in commands
    for cmd in BUILTIN_COMMANDS {
        if cmd.starts_with(&prefix) && !completions.contains(&(*cmd).to_string()) {
            completions.push((*cmd).to_string());
        }
    }

    completions.sort();
    completions.dedup();

    Ok(completions)
}

/// Hide the main window and update visibility state
#[command]
pub fn hide_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;

    #[cfg(target_os = "macos")]
    {
        use objc2::runtime::AnyObject;
        let ns_window = window.ns_window().map_err(|e| e.to_string())? as *mut AnyObject;
        unsafe {
            crate::macos::hide_window(ns_window);
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        window.hide().map_err(|e| e.to_string())?;
    }

    Ok(())
}
