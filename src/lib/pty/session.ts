/**
 * PTY Session Manager
 *
 * Unified PTY session management with buffering, retry logic, and reconnection.
 * Consolidates the logic from both PtyManager class and usePtySession hook.
 */

import { isPtyExit, isPtyOutput, type PtyOutput, type PtyExit } from "@/lib/guards";
import { DataBuffer } from "@/lib/terminal/dataBuffer";
import {
  MAX_PTY_RETRIES,
  PTY_RESTART_DELAY_MS,
  PTY_RETRY_DELAY_MS,
} from "@/lib/constants";
import { ensureValidDimensions } from "@/lib/ptyUtils";
import { createPtySession, writeToPty, resizePty, closePtySession } from "@/lib/tauri/pty";
import { getListen } from "@/lib/tauri/preload";
import type { Terminal } from "@xterm/xterm";

export interface PtySessionOptions {
  terminal: Terminal;
  onSessionCreated?: (sessionId: string) => void;
  /**
   * Enable data buffering for better performance
   * @default true
   */
  enableBuffering?: boolean;
  /**
   * Buffer flush interval in ms
   * @default 5
   */
  bufferFlushInterval?: number;
}

/**
 * PTY Session Manager
 *
 * Handles PTY session lifecycle, I/O, and event management.
 */
export class PtySession {
  private sessionId: string | null = null;
  private terminal: Terminal;
  private onSessionCreated?: (sessionId: string) => void;
  private unlistenOutput: (() => void) | null = null;
  private unlistenExit: (() => void) | null = null;
  private dataBuffer: DataBuffer | null = null;
  private isReady = false;
  private isDestroyed = false; // Prevent write-after-dispose race condition

  constructor(options: PtySessionOptions) {
    this.terminal = options.terminal;
    this.onSessionCreated = options.onSessionCreated;

    // Set up data buffering if enabled
    if (options.enableBuffering !== false) {
      this.dataBuffer = new DataBuffer({
        flushInterval: options.bufferFlushInterval ?? 5,
        onFlush: (data) => {
          // Check if terminal is destroyed before writing
          if (!this.isDestroyed) {
            this.terminal.write(data);
          }
        },
      });
    }
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Check if session is active
   */
  isActive(): boolean {
    return this.sessionId !== null;
  }

  /**
   * Ensure PTY is ready before operations
   */
  private async ensureReady(): Promise<void> {
    if (this.isReady) return;

    // Wait for preload
    const { ensurePreload } = await import("@/lib/tauri/preload");
    await ensurePreload();
    this.isReady = true;
  }

  /**
   * Create a new PTY session
   */
  async create(cols: number, rows: number, retryCount = 0): Promise<void> {
    await this.ensureReady();

    const { cols: validCols, rows: validRows } = ensureValidDimensions(cols, rows);

    try {
      const sessionId = await createPtySession(validCols, validRows);
      this.sessionId = sessionId;
      this.onSessionCreated?.(sessionId);
    } catch (error) {
      console.error("[PTY] Failed to create session:", error);
      this.terminal.write(`\x1b[31mFailed to create PTY session: ${error}\x1b[0m\r\n`);

      if (retryCount < MAX_PTY_RETRIES) {
        const nextRetry = retryCount + 1;
        this.terminal.write(`\x1b[33mRetrying... (${nextRetry}/${MAX_PTY_RETRIES})\x1b[0m\r\n`);
        await new Promise((resolve) => setTimeout(resolve, PTY_RETRY_DELAY_MS * nextRetry));
        return this.create(cols, rows, nextRetry);
      } else {
        this.terminal.write(
          `\x1b[31mFailed to create terminal after ${MAX_PTY_RETRIES} attempts.\x1b[0m\r\n`
        );
        this.terminal.write(`\x1b[33mPlease restart the application.\x1b[0m\r\n`);
      }
    }
  }

  /**
   * Reuse an existing PTY session
   */
  async reuse(existingSessionId: string, cols: number, rows: number): Promise<void> {
    await this.ensureReady();

    this.sessionId = existingSessionId;
    const { cols: validCols, rows: validRows } = ensureValidDimensions(cols, rows);

    try {
      await resizePty(existingSessionId, validCols, validRows);
    } catch (error) {
      console.warn("[PTY] Failed to resize existing session, creating new one:", error);
      await this.create(cols, rows);
    }
  }

  /**
   * Write data to PTY session
   */
  async write(data: string): Promise<void> {
    if (!this.sessionId) return;

    await this.ensureReady();

    try {
      await writeToPty(this.sessionId, data);
    } catch (error) {
      console.error("[PTY] Write failed:", error);
      this.terminal.write("\r\n\x1b[31m[Connection lost. Attempting to reconnect...]\x1b[0m\r\n");

      // Try to reconnect
      const oldSession = this.sessionId;
      this.sessionId = null;

      if (oldSession) {
        try {
          await closePtySession(oldSession);
        } catch {
          // Ignore close errors during reconnection
        }
      }

      await this.create(this.terminal.cols, this.terminal.rows);
    }
  }

  /**
   * Resize PTY session
   */
  async resize(cols: number, rows: number): Promise<void> {
    if (!this.sessionId) return;

    await this.ensureReady();

    const { cols: validCols, rows: validRows } = ensureValidDimensions(cols, rows);

    try {
      await resizePty(this.sessionId, validCols, validRows);
    } catch (error) {
      console.error("[PTY] Resize failed:", error);
    }
  }

  /**
   * Set up event listeners for PTY output and exit
   */
  async setupListeners(): Promise<() => void> {
    await this.ensureReady();

    const listen = await getListen();

    // Listen for PTY output
    const unlistenOutput = await listen<PtyOutput>("pty-output", (event) => {
      if (!isPtyOutput(event.payload)) {
        console.warn("[PTY] Invalid pty-output payload:", event.payload);
        return;
      }

      if (event.payload.session_id === this.sessionId) {
        // Check if terminal is destroyed before writing
        if (this.isDestroyed) return;

        if (this.dataBuffer) {
          this.dataBuffer.push(event.payload.data);
        } else {
          this.terminal.write(event.payload.data);
        }
      }
    });
    this.unlistenOutput = unlistenOutput;

    // Listen for PTY exit
    const unlistenExit = await listen<PtyExit>("pty-exit", (event) => {
      if (!isPtyExit(event.payload)) {
        console.warn("[PTY] Invalid pty-exit payload:", event.payload);
        return;
      }

      if (event.payload.session_id === this.sessionId) {
        // Check if terminal is destroyed before writing
        if (!this.isDestroyed) {
          this.terminal.write("\r\n\x1b[33m[Process exited]\x1b[0m\r\n");
        }
        this.sessionId = null;

        // Restart the session after a delay (only if not destroyed)
        if (!this.isDestroyed) {
          setTimeout(() => {
            if (!this.isDestroyed) {
              this.create(this.terminal.cols, this.terminal.rows);
            }
          }, PTY_RESTART_DELAY_MS);
        }
      }
    });
    this.unlistenExit = unlistenExit;

    return () => {
      unlistenOutput();
      unlistenExit();
    };
  }

  /**
   * Close PTY session and clean up
   */
  async close(): Promise<void> {
    // Mark as destroyed to prevent any further writes
    this.isDestroyed = true;

    // Clean up event listeners
    this.unlistenOutput?.();
    this.unlistenOutput = null;
    this.unlistenExit?.();
    this.unlistenExit = null;

    // Flush and dispose buffer
    if (this.dataBuffer) {
      this.dataBuffer.dispose();
      this.dataBuffer = null;
    }

    // Close PTY session
    if (this.sessionId) {
      try {
        await closePtySession(this.sessionId);
      } catch (error) {
        console.error("[PTY] Close failed:", error);
      }
      this.sessionId = null;
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    // Mark as destroyed immediately
    this.isDestroyed = true;
    this.close();
  }
}
