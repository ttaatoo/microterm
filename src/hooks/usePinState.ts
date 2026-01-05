import { useCallback, useEffect, useState } from "react";
import { loadSettings, saveSettings, type Settings } from "@/lib/settings";
import { isPinStatePayload, type PinStatePayload } from "@/lib/guards";

/**
 * Custom hook for managing pin state across the application.
 * Handles loading, updating, and syncing pin state with Rust backend.
 */
export function usePinState() {
  const [pinned, setPinned] = useState(false);

  // Load pin state from settings on mount
  useEffect(() => {
    const settings = loadSettings();
    setPinned(settings.pinned ?? false);
  }, []);

  // Listen for pin state changes from other sources (shortcuts, other components)
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;

    const setupListener = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlistenFn = await listen<PinStatePayload>("pin-state-updated", (event) => {
          // Validate payload type (M4 fix)
          if (isPinStatePayload(event.payload)) {
            setPinned(event.payload.pinned);
          } else {
            console.error("[Pin] Invalid pin-state-updated payload:", event.payload);
          }
        });
      } catch (error) {
        console.error("[Pin] Failed to setup pin state listener:", error);
      }
    };

    setupListener();

    return () => {
      unlistenFn?.();
    };
  }, []);

  // Sync pin state to Rust backend on mount only (H1 fix - removed [pinned] dependency)
  useEffect(() => {
    const syncInitialState = async () => {
      try {
        const settings = loadSettings();
        const { emit } = await import("@tauri-apps/api/event");
        await emit("pin-state-changed", { pinned: settings.pinned ?? false });
      } catch (error) {
        console.error("[Pin] Failed to sync initial pin state:", error);
      }
    };
    syncInitialState();
  }, []); // Empty dependency - only sync on mount

  // Toggle pin state and sync everywhere
  const togglePin = useCallback(async () => {
    const settings = loadSettings();
    const oldPinned = settings.pinned ?? false;
    const newPinned = !oldPinned;

    // Update local state immediately for responsive UI
    setPinned(newPinned);

    // Save to settings
    const newSettings: Settings = { ...settings, pinned: newPinned };
    saveSettings(newSettings);

    // Sync to Rust backend and notify other frontend components
    try {
      const { emit } = await import("@tauri-apps/api/event");
      // Single event to Rust backend
      await emit("pin-state-changed", { pinned: newPinned });
      // Single event to frontend components
      await emit("pin-state-updated", { pinned: newPinned });
    } catch (error) {
      console.error("[Pin] Failed to sync pin state:", error);
      // Revert to original state on failure
      setPinned(oldPinned);
      saveSettings({ ...settings, pinned: oldPinned });
    }
  }, []);

  // Set pin state to a specific value (for Cmd+W unpin scenario)
  const setPin = useCallback(async (newPinned: boolean) => {
    const settings = loadSettings();
    const oldPinned = settings.pinned ?? false;

    // Skip if already in desired state
    if (oldPinned === newPinned) return;

    // Update local state
    setPinned(newPinned);

    // Save to settings
    const newSettings: Settings = { ...settings, pinned: newPinned };
    saveSettings(newSettings);

    // Sync to Rust backend and notify frontend
    try {
      const { emit } = await import("@tauri-apps/api/event");
      await emit("pin-state-changed", { pinned: newPinned });
      await emit("pin-state-updated", { pinned: newPinned });
    } catch (error) {
      console.error("[Pin] Failed to set pin state:", error);
      // Revert to original state on failure
      setPinned(oldPinned);
      saveSettings({ ...settings, pinned: oldPinned });
    }
  }, []);

  return { pinned, togglePin, setPin };
}
