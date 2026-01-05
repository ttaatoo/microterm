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
