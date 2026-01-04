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
  return "__TAURI__" in window;
}

// Cached module references to avoid repeated dynamic imports
let cachedInvoke: typeof import("@tauri-apps/api/core").invoke | null = null;
let cachedListen: typeof import("@tauri-apps/api/event").listen | null = null;
let cachedEmit: typeof import("@tauri-apps/api/event").emit | null = null;

// Dynamic imports with caching to avoid repeated module loading
async function getInvoke() {
  if (!isTauri()) {
    throw new Error("Not running in Tauri environment");
  }
  if (!cachedInvoke) {
    const { invoke } = await import("@tauri-apps/api/core");
    cachedInvoke = invoke;
  }
  return cachedInvoke;
}

async function getListen() {
  if (!isTauri()) {
    throw new Error("Not running in Tauri environment");
  }
  if (!cachedListen) {
    const { listen } = await import("@tauri-apps/api/event");
    cachedListen = listen;
  }
  return cachedListen;
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

// Global shortcut functions
async function getEmit() {
  if (!isTauri()) {
    throw new Error("Not running in Tauri environment");
  }
  if (!cachedEmit) {
    const { emit } = await import("@tauri-apps/api/event");
    cachedEmit = emit;
  }
  return cachedEmit;
}

export async function registerGlobalShortcut(
  shortcut: string,
  onTrigger: () => void
): Promise<() => Promise<void>> {
  if (!isTauri()) {
    console.warn("Global shortcuts only work in Tauri environment");
    return async () => {};
  }

  const { register, unregister } = await import("@tauri-apps/plugin-global-shortcut");
  const emit = await getEmit();

  await register(shortcut, async (event) => {
    if (event.state === "Pressed") {
      // Emit event to Rust backend to toggle window
      await emit("toggle-window", {});
      onTrigger();
    }
  });

  // Return unregister function
  return async () => {
    await unregister(shortcut);
  };
}

export async function unregisterGlobalShortcut(shortcut: string): Promise<void> {
  if (!isTauri()) {
    return;
  }

  const { unregister } = await import("@tauri-apps/plugin-global-shortcut");
  await unregister(shortcut);
}

export async function unregisterAllShortcuts(): Promise<void> {
  if (!isTauri()) {
    return;
  }

  const { unregisterAll } = await import("@tauri-apps/plugin-global-shortcut");
  await unregisterAll();
}

export async function isShortcutRegistered(shortcut: string): Promise<boolean> {
  if (!isTauri()) {
    return false;
  }

  const { isRegistered } = await import("@tauri-apps/plugin-global-shortcut");
  return isRegistered(shortcut);
}

// Open URL in system default browser
export async function openUrl(url: string): Promise<void> {
  if (!isTauri()) {
    // Fallback for browser environment
    window.open(url, "_blank");
    return;
  }

  const { open } = await import("@tauri-apps/plugin-shell");
  await open(url);
}

// Register a local shortcut that only works when the app window is focused
// Used for shortcuts like Ctrl+Tab that are intercepted by the webview
export async function registerLocalShortcut(
  shortcut: string,
  onTrigger: () => void
): Promise<() => Promise<void>> {
  if (!isTauri()) {
    console.warn("Local shortcuts only work in Tauri environment");
    return async () => {};
  }

  const { register, unregister } = await import("@tauri-apps/plugin-global-shortcut");

  await register(shortcut, async (event) => {
    if (event.state === "Pressed") {
      onTrigger();
    }
  });

  return async () => {
    await unregister(shortcut);
  };
}
