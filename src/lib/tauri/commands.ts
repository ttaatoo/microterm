/**
 * Command execution via Tauri IPC
 *
 * Handles both synchronous and streaming command execution.
 */

import { getInvoke, getListen } from "./preload";

export interface CommandResult {
  stdout: string;
  stderr: string;
  exit_code: number;
}

export interface StreamChunk {
  chunk: string;
  is_stderr: boolean;
}

/**
 * Execute a command and wait for result
 * @param cmd - Command to execute
 * @param args - Command arguments
 * @returns Command result with stdout, stderr, and exit code
 */
export async function executeCommand(cmd: string, args: string[] = []): Promise<CommandResult> {
  const invoke = await getInvoke();
  const result = await invoke<CommandResult>("execute_command", {
    cmd,
    args,
  });
  return result;
}

/**
 * Execute a command with streaming output
 * @param cmd - Command to execute
 * @param args - Command arguments
 * @param onStdout - Callback for stdout chunks
 * @param onStderr - Callback for stderr chunks
 * @param onComplete - Callback when command completes
 */
export async function executeCommandStream(
  cmd: string,
  args: string[] = [],
  onStdout: (chunk: string) => void,
  onStderr: (chunk: string) => void,
  onComplete: (exitCode: number) => void
): Promise<void> {
  const invoke = await getInvoke();
  const listen = await getListen();

  // Set up event listeners
  const unlistenStdout = await listen<StreamChunk>("command-stdout", (event) => {
    onStdout(event.payload.chunk);
  });

  const unlistenStderr = await listen<StreamChunk>("command-stderr", (event) => {
    onStderr(event.payload.chunk);
  });

  const unlistenComplete = await listen<number>("command-complete", (event) => {
    onComplete(event.payload);
    // Clean up listeners
    unlistenStdout();
    unlistenStderr();
    unlistenComplete();
  });

  // Execute command
  await invoke<number>("execute_command_stream", {
    cmd,
    args,
  });
}

/**
 * Get command completions
 * @param prefix - Command prefix to complete
 * @returns Array of completion suggestions
 */
export async function completeCommand(prefix: string): Promise<string[]> {
  try {
    const invoke = await getInvoke();
    const result = await invoke<string[]>("complete_command", {
      prefix,
    });
    return result;
  } catch (error) {
    console.error("Command completion error:", error);
    return [];
  }
}
