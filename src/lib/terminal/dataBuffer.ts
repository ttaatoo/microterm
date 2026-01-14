/**
 * Data buffering utility for terminal output
 *
 * Buffers incoming data and flushes periodically to reduce rendering overhead.
 * This matches VSCode's terminal buffering approach for better performance.
 */

export interface DataBufferOptions {
  /**
   * Flush interval in milliseconds
   * @default 5
   */
  flushInterval?: number;

  /**
   * Callback to execute when buffer is flushed
   */
  onFlush: (data: string) => void;
}

export class DataBuffer {
  private buffer: string[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly flushInterval: number;
  private readonly onFlush: (data: string) => void;

  constructor(options: DataBufferOptions) {
    this.flushInterval = options.flushInterval ?? 5;
    this.onFlush = options.onFlush;
  }

  /**
   * Add data to buffer and schedule flush
   */
  push(data: string): void {
    this.buffer.push(data);

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flush();
      }, this.flushInterval);
    }
  }

  /**
   * Flush buffer immediately
   */
  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.buffer.length === 0) {
      return;
    }

    const data = this.buffer.join("");
    this.buffer = [];
    this.onFlush(data);
  }

  /**
   * Clear buffer without flushing
   */
  clear(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.buffer = [];
  }

  /**
   * Check if buffer has pending data
   */
  isEmpty(): boolean {
    return this.buffer.length === 0;
  }

  /**
   * Get current buffer size (number of chunks)
   */
  size(): number {
    return this.buffer.length;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.flush();
  }
}
