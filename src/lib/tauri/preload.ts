/**
 * Tauri API preloading and caching
 *
 * Preloads Tauri APIs on module initialization to reduce startup delay.
 * Caches module references to avoid repeated dynamic imports.
 */

// Check if running in Tauri environment
export function isTauri(): boolean {
  return "__TAURI__" in window;
}

// Cached module references to avoid repeated dynamic imports
let cachedInvoke: typeof import("@tauri-apps/api/core").invoke | null = null;
let cachedListen: typeof import("@tauri-apps/api/event").listen | null = null;
let cachedEmit: typeof import("@tauri-apps/api/event").emit | null = null;

// Preload promise to start loading Tauri APIs early
let preloadPromise: Promise<void> | null = null;

/**
 * Preload Tauri APIs to reduce startup delay
 */
function preloadTauriApis(): Promise<void> {
  if (!isTauri()) {
    return Promise.resolve();
  }
  if (preloadPromise) {
    return preloadPromise;
  }

  // Set promise BEFORE starting async work to prevent race condition
  preloadPromise = Promise.all([
    import("@tauri-apps/api/core").then(({ invoke }) => {
      cachedInvoke = invoke;
    }),
    import("@tauri-apps/api/event").then(({ listen, emit }) => {
      cachedListen = listen;
      cachedEmit = emit;
    }),
  ]).then(() => {
    // Preload completed
  });
  return preloadPromise;
}

// Start preloading immediately when module loads (if in Tauri environment)
if (isTauri()) {
  preloadTauriApis();
}

/**
 * Get invoke function with caching and preload support
 */
export async function getInvoke() {
  if (!isTauri()) {
    throw new Error("Not running in Tauri environment");
  }
  // Wait for preload if it's in progress
  if (preloadPromise) {
    await preloadPromise;
  }
  if (!cachedInvoke) {
    const { invoke } = await import("@tauri-apps/api/core");
    cachedInvoke = invoke;
  }
  return cachedInvoke;
}

/**
 * Get listen function with caching and preload support
 */
export async function getListen() {
  if (!isTauri()) {
    throw new Error("Not running in Tauri environment");
  }
  // Wait for preload if it's in progress
  if (preloadPromise) {
    await preloadPromise;
  }
  if (!cachedListen) {
    const { listen } = await import("@tauri-apps/api/event");
    cachedListen = listen;
  }
  return cachedListen;
}

/**
 * Get emit function with caching and preload support
 */
export async function getEmit() {
  if (!isTauri()) {
    throw new Error("Not running in Tauri environment");
  }
  // Wait for preload if it's in progress
  if (preloadPromise) {
    await preloadPromise;
  }
  if (!cachedEmit) {
    const { emit } = await import("@tauri-apps/api/event");
    cachedEmit = emit;
  }
  return cachedEmit;
}

/**
 * Force preload to start immediately
 * Useful for eager initialization
 */
export function ensurePreload(): Promise<void> {
  return preloadTauriApis();
}

/**
 * Helper function to check if Tauri is available and invoke a command
 */
export function checkTauriAvailable(): boolean {
  return isTauri();
}

/**
 * Invoke a Tauri command with automatic error handling
 */
export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const invokeFunction = await getInvoke();
  return invokeFunction(command, args);
}

/**
 * Listen to a Tauri event
 */
export async function listen<T>(
  event: string,
  handler: (event: { payload: T }) => void
): Promise<() => void> {
  const listenFunction = await getListen();
  const unlisten = await listenFunction<T>(event, handler);
  return unlisten;
}

/**
 * Emit a Tauri event
 */
export async function emit(event: string, payload?: unknown): Promise<void> {
  const emitFunction = await getEmit();
  await emitFunction(event, payload);
}
