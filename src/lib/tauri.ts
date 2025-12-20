export interface CommandResult {
  stdout: string;
  stderr: string;
  exit_code: number;
}

export interface StreamChunk {
  chunk: string;
  is_stderr: boolean;
}

// Check if running in Tauri environment
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

// Dynamic imports to avoid issues when not in Tauri environment
async function getInvoke() {
  if (!isTauri()) {
    throw new Error("Not running in Tauri environment");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke;
}

async function getListen() {
  if (!isTauri()) {
    throw new Error("Not running in Tauri environment");
  }
  const { listen } = await import("@tauri-apps/api/event");
  return listen;
}

export async function executeCommand(
  cmd: string,
  args: string[] = [],
): Promise<CommandResult> {
  const invoke = await getInvoke();
  const result = await invoke<CommandResult>("execute_command", {
    cmd,
    args,
  });
  return result;
}

export async function executeCommandStream(
  cmd: string,
  args: string[] = [],
  onStdout: (chunk: string) => void,
  onStderr: (chunk: string) => void,
  onComplete: (exitCode: number) => void,
): Promise<void> {
  const invoke = await getInvoke();
  const listen = await getListen();

  // Set up event listeners
  const unlistenStdout = await listen<StreamChunk>(
    "command-stdout",
    (event) => {
      onStdout(event.payload.chunk);
    },
  );

  const unlistenStderr = await listen<StreamChunk>(
    "command-stderr",
    (event) => {
      onStderr(event.payload.chunk);
    },
  );

  const unlistenComplete = await listen<number>(
    "command-complete",
    (event) => {
      onComplete(event.payload);
      // Clean up listeners
      unlistenStdout();
      unlistenStderr();
      unlistenComplete();
    },
  );

  // Execute command
  await invoke<number>("execute_command_stream", {
    cmd,
    args,
  });
}

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

// PTY-related functions
export interface PtyOutput {
  session_id: string;
  data: string;
}

export interface PtyExit {
  session_id: string;
  exit_code: number | null;
}

export async function createPtySession(
  cols: number,
  rows: number
): Promise<string> {
  const invoke = await getInvoke();
  return invoke<string>("create_pty_session", { cols, rows });
}

export async function writeToPty(
  sessionId: string,
  data: string
): Promise<void> {
  const invoke = await getInvoke();
  await invoke("write_to_pty", { sessionId, data });
}

export async function resizePty(
  sessionId: string,
  cols: number,
  rows: number
): Promise<void> {
  const invoke = await getInvoke();
  await invoke("resize_pty", { sessionId, cols, rows });
}

export async function closePtySession(sessionId: string): Promise<void> {
  const invoke = await getInvoke();
  await invoke("close_pty_session", { sessionId });
}
