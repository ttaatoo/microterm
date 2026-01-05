//! Command execution module for µTerm
//!
//! Provides synchronous and streaming command execution capabilities.

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::process::Stdio;
use std::sync::LazyLock;
use std::time::{Duration, Instant};
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

/// Time-to-live for command completion cache (60 seconds)
const COMPLETION_CACHE_TTL: Duration = Duration::from_secs(60);

/// Cached executable commands for tab completion
struct CompletionCache {
    commands: HashSet<String>,
    last_updated: Instant,
}

impl CompletionCache {
    fn new() -> Self {
        Self {
            commands: HashSet::new(),
            last_updated: Instant::now() - COMPLETION_CACHE_TTL, // Expired on creation
        }
    }

    fn is_expired(&self) -> bool {
        self.last_updated.elapsed() > COMPLETION_CACHE_TTL
    }
}

/// Global completion cache with RwLock for concurrent access
static COMPLETION_CACHE: LazyLock<RwLock<CompletionCache>> =
    LazyLock::new(|| RwLock::new(CompletionCache::new()));

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

/// Refresh the completion cache by scanning PATH directories
fn refresh_completion_cache() {
    use std::env;

    let mut commands = HashSet::new();

    // Add built-in commands first
    for cmd in BUILTIN_COMMANDS {
        commands.insert((*cmd).to_string());
    }

    // Get PATH environment variable
    let path_var = env::var("PATH").unwrap_or_default();

    for path_str in path_var.split(':') {
        if let Ok(entries) = std::fs::read_dir(path_str) {
            for entry in entries.flatten() {
                if let Some(name) = entry.file_name().to_str() {
                    // Check if it's executable
                    let path = entry.path();
                    if path.is_file() {
                        #[cfg(unix)]
                        {
                            use std::os::unix::fs::PermissionsExt;
                            if let Ok(metadata) = entry.metadata() {
                                let mode = metadata.permissions().mode();
                                if mode & 0o111 != 0 {
                                    commands.insert(name.to_string());
                                }
                            }
                        }
                        #[cfg(not(unix))]
                        {
                            if let Some(ext) = path.extension() {
                                if ext == "exe" || ext == "bat" || ext == "cmd" {
                                    commands.insert(name.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Update the cache
    let mut cache = COMPLETION_CACHE.write();
    cache.commands = commands;
    cache.last_updated = Instant::now();
}

#[command]
pub async fn complete_command(prefix: String) -> Result<Vec<String>, String> {
    // If prefix is empty, return empty list
    if prefix.is_empty() {
        return Ok(Vec::new());
    }

    // Check if cache needs refresh (use read lock first for better concurrency)
    {
        let cache = COMPLETION_CACHE.read();
        if cache.is_expired() {
            drop(cache); // Release read lock before acquiring write lock
            refresh_completion_cache();
        }
    }

    // Filter completions from cache
    let cache = COMPLETION_CACHE.read();
    let mut completions: Vec<String> = cache
        .commands
        .iter()
        .filter(|cmd| cmd.starts_with(&prefix))
        .cloned()
        .collect();

    completions.sort();
    Ok(completions)
}

#[cfg(test)]
mod tests {
    use super::*;

    // ============== validate_command tests ==============

    #[test]
    fn test_validate_command_valid() {
        assert!(validate_command("ls").is_ok());
        assert!(validate_command("echo").is_ok());
        assert!(validate_command("/usr/bin/ls").is_ok());
        assert!(validate_command("my_command").is_ok());
        assert!(validate_command("command123").is_ok());
    }

    #[test]
    fn test_validate_command_empty() {
        let result = validate_command("");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("empty"));
    }

    #[test]
    fn test_validate_command_too_long() {
        let long_cmd = "a".repeat(MAX_COMMAND_LENGTH + 1);
        let result = validate_command(&long_cmd);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("too long"));
    }

    #[test]
    fn test_validate_command_max_length_ok() {
        let max_cmd = "a".repeat(MAX_COMMAND_LENGTH);
        assert!(validate_command(&max_cmd).is_ok());
    }

    #[test]
    fn test_validate_command_forbidden_chars() {
        // Test each forbidden character
        let forbidden = vec![
            (";", ";"),
            ("&", "&"),
            ("|", "|"),
            ("$", "$"),
            ("`", "`"),
            ("(", "("),
            (")", ")"),
            ("{", "{"),
            ("}", "}"),
            ("[", "["),
            ("]", "]"),
            ("<", "<"),
            (">", ">"),
            ("'", "'"),
            ("\"", "\""),
            ("\\", "\\"),
        ];

        for (char_str, display) in forbidden {
            let cmd = format!("command{}", char_str);
            let result = validate_command(&cmd);
            assert!(
                result.is_err(),
                "Command with '{}' should be rejected",
                display
            );
            assert!(
                result.unwrap_err().contains("forbidden character"),
                "Error should mention forbidden character for '{}'",
                display
            );
        }
    }

    #[test]
    fn test_validate_command_special_chars_display() {
        // Test special character display in error message
        let result = validate_command("cmd\n");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("\\n"));

        let result = validate_command("cmd\r");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("\\r"));

        let result = validate_command("cmd\0");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("\\0"));
    }

    #[test]
    fn test_validate_command_starts_with_dash() {
        let result = validate_command("-rf");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("start with '-'"));

        let result = validate_command("--help");
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_command_path_traversal() {
        let result = validate_command("../etc/passwd");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("path traversal"));

        let result = validate_command("foo/../bar");
        assert!(result.is_err());

        // Single dot is OK
        assert!(validate_command("./script").is_ok());
    }

    // ============== validate_args tests ==============

    #[test]
    fn test_validate_args_valid() {
        let args = vec!["arg1".to_string(), "arg2".to_string()];
        assert!(validate_args(&args).is_ok());

        // Empty args is valid
        assert!(validate_args(&[]).is_ok());
    }

    #[test]
    fn test_validate_args_too_many() {
        let args: Vec<String> = (0..MAX_ARGS_COUNT + 1).map(|i| i.to_string()).collect();
        let result = validate_args(&args);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Too many arguments"));
    }

    #[test]
    fn test_validate_args_max_count_ok() {
        let args: Vec<String> = (0..MAX_ARGS_COUNT).map(|i| i.to_string()).collect();
        assert!(validate_args(&args).is_ok());
    }

    #[test]
    fn test_validate_args_too_long() {
        let long_arg = "a".repeat(MAX_ARG_LENGTH + 1);
        let args = vec![long_arg];
        let result = validate_args(&args);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("too long"));
    }

    #[test]
    fn test_validate_args_max_length_ok() {
        let max_arg = "a".repeat(MAX_ARG_LENGTH);
        let args = vec![max_arg];
        assert!(validate_args(&args).is_ok());
    }

    #[test]
    fn test_validate_args_null_byte() {
        let args = vec!["normal".to_string(), "has\0null".to_string()];
        let result = validate_args(&args);
        assert!(result.is_err());
        let err_msg = result.unwrap_err();
        assert!(err_msg.contains("null byte"));
        assert!(err_msg.contains("1")); // Should mention arg index
    }

    #[test]
    fn test_validate_args_null_byte_index() {
        let args = vec![
            "arg0".to_string(),
            "arg1".to_string(),
            "arg2\0bad".to_string(),
        ];
        let result = validate_args(&args);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("2")); // Index of bad arg
    }

    // ============== Data structure tests ==============

    #[test]
    fn test_command_result_serialization() {
        let result = CommandResult {
            stdout: "output".to_string(),
            stderr: "error".to_string(),
            exit_code: 0,
        };

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("output"));
        assert!(json.contains("error"));
        assert!(json.contains("0"));

        let deserialized: CommandResult = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.stdout, "output");
        assert_eq!(deserialized.stderr, "error");
        assert_eq!(deserialized.exit_code, 0);
    }

    #[test]
    fn test_stream_chunk_serialization() {
        let chunk = StreamChunk {
            chunk: "data".to_string(),
            is_stderr: false,
        };

        let json = serde_json::to_string(&chunk).unwrap();
        let deserialized: StreamChunk = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.chunk, "data");
        assert!(!deserialized.is_stderr);

        let stderr_chunk = StreamChunk {
            chunk: "error".to_string(),
            is_stderr: true,
        };
        let json = serde_json::to_string(&stderr_chunk).unwrap();
        let deserialized: StreamChunk = serde_json::from_str(&json).unwrap();
        assert!(deserialized.is_stderr);
    }

    // ============== Constants validation ==============

    #[test]
    fn test_constants_are_reasonable() {
        assert!(MAX_COMMAND_LENGTH > 0);
        assert!(MAX_ARG_LENGTH > 0);
        assert!(MAX_ARGS_COUNT > 0);
        assert!(STREAM_BUFFER_SIZE > 0);

        // Ensure we have sensible limits
        assert!(MAX_COMMAND_LENGTH >= 256); // At least allow reasonable paths
        assert!(MAX_ARGS_COUNT >= 10); // At least allow common use cases
    }

    #[test]
    fn test_builtin_commands_not_empty() {
        assert!(!BUILTIN_COMMANDS.is_empty());
        // Common commands should be present
        assert!(BUILTIN_COMMANDS.contains(&"ls"));
        assert!(BUILTIN_COMMANDS.contains(&"cd"));
        assert!(BUILTIN_COMMANDS.contains(&"echo"));
    }

    #[test]
    fn test_forbidden_chars_comprehensive() {
        // Ensure common injection characters are forbidden
        assert!(FORBIDDEN_COMMAND_CHARS.contains(&';'));
        assert!(FORBIDDEN_COMMAND_CHARS.contains(&'|'));
        assert!(FORBIDDEN_COMMAND_CHARS.contains(&'&'));
        assert!(FORBIDDEN_COMMAND_CHARS.contains(&'$'));
        assert!(FORBIDDEN_COMMAND_CHARS.contains(&'`'));
        assert!(FORBIDDEN_COMMAND_CHARS.contains(&'\0'));
    }
}

/// Hide the main window and update visibility state
#[command]
pub fn hide_window(app: AppHandle) -> Result<(), String> {
    // Check pin state: if pinned, don't hide
    #[cfg(target_os = "macos")]
    {
        if crate::macos::is_window_pinned() {
            return Ok(());
        }
    }

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
