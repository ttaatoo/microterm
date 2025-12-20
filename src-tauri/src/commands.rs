//! Command execution module for µTerm
//!
//! Provides synchronous and streaming command execution capabilities.

use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tauri::{command, AppHandle, Emitter};
use tokio::io::AsyncReadExt;
use tokio::io::BufReader as TokioBufReader;
use tokio::process::Command as TokioCommand;

/// Buffer size for reading command output streams
const STREAM_BUFFER_SIZE: usize = 1024;

/// Common shell built-in commands for tab completion
const BUILTIN_COMMANDS: &[&str] = &[
    "alias", "cat", "cd", "clear", "cp", "echo", "exit", "export", "find",
    "grep", "help", "history", "ls", "mkdir", "mv", "pwd", "quit", "rm",
    "type", "unalias", "unset", "where", "which",
];

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

    // Validate command is not empty
    if cmd.is_empty() {
        return Err("Command cannot be empty".to_string());
    }

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
    // Validate command is not empty
    if cmd.is_empty() {
        return Err("Command cannot be empty".to_string());
    }

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

    // Handle stdout - read in chunks for real-time streaming
    tokio::spawn(async move {
        let mut reader = TokioBufReader::new(stdout);
        let mut buffer = vec![0u8; STREAM_BUFFER_SIZE];

        loop {
            match reader.read(&mut buffer).await {
                Ok(0) => break, // EOF
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buffer[..n]).to_string();
                    let _ = app_stdout.emit(
                        "command-stdout",
                        StreamChunk {
                            chunk,
                            is_stderr: false,
                        },
                    );
                }
                Err(_) => break,
            }
        }
    });

    // Handle stderr - read in chunks for real-time streaming
    tokio::spawn(async move {
        let mut reader = TokioBufReader::new(stderr);
        let mut buffer = vec![0u8; STREAM_BUFFER_SIZE];

        loop {
            match reader.read(&mut buffer).await {
                Ok(0) => break, // EOF
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buffer[..n]).to_string();
                    let _ = app_stderr.emit(
                        "command-stderr",
                        StreamChunk {
                            chunk,
                            is_stderr: true,
                        },
                    );
                }
                Err(_) => break,
            }
        }
    });

    // Wait for command to complete
    let exit_code = child.wait().await.map_err(|e| format!("Failed to wait for command: {}", e))?;

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
