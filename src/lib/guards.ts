// Type guards for runtime type validation

/**
 * Payload for pin state events
 */
export interface PinStatePayload {
  pinned: boolean;
}

/**
 * Type guard for PinStatePayload
 */
export function isPinStatePayload(payload: unknown): payload is PinStatePayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "pinned" in payload &&
    typeof (payload as PinStatePayload).pinned === "boolean"
  );
}

/**
 * PTY output event payload
 */
export interface PtyOutput {
  session_id: string;
  data: string;
}

/**
 * Type guard for PtyOutput
 */
export function isPtyOutput(payload: unknown): payload is PtyOutput {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "session_id" in payload &&
    "data" in payload &&
    typeof (payload as PtyOutput).session_id === "string" &&
    typeof (payload as PtyOutput).data === "string"
  );
}

/**
 * PTY exit event payload
 */
export interface PtyExit {
  session_id: string;
  exit_code: number | null;
}

/**
 * Type guard for PtyExit
 */
export function isPtyExit(payload: unknown): payload is PtyExit {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "session_id" in payload &&
    "exit_code" in payload &&
    typeof (payload as PtyExit).session_id === "string" &&
    ((payload as PtyExit).exit_code === null || typeof (payload as PtyExit).exit_code === "number")
  );
}
