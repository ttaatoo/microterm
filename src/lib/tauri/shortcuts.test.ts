import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  registerGlobalShortcut,
  registerGlobalShortcutNoToggle,
  unregisterGlobalShortcut,
  unregisterAllShortcuts,
  isShortcutRegistered,
  registerLocalShortcut,
} from "./shortcuts";

// Mock preload module
const mockEmit = vi.fn().mockResolvedValue(undefined);
let isTauriMock = true;

vi.mock("./preload", () => ({
  getEmit: vi.fn(() => Promise.resolve(mockEmit)),
  isTauri: vi.fn(() => isTauriMock),
}));

// Mock global shortcut plugin
const mockRegister = vi.fn();
const mockUnregister = vi.fn();
const mockUnregisterAll = vi.fn();
const mockIsRegistered = vi.fn();

vi.mock("@tauri-apps/plugin-global-shortcut", () => ({
  register: mockRegister,
  unregister: mockUnregister,
  unregisterAll: mockUnregisterAll,
  isRegistered: mockIsRegistered,
}));

describe("shortcuts.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isTauriMock = true;
    mockRegister.mockResolvedValue(undefined);
    mockUnregister.mockResolvedValue(undefined);
    mockUnregisterAll.mockResolvedValue(undefined);
    mockIsRegistered.mockResolvedValue(false);
  });

  describe("registerGlobalShortcut", () => {
    it("should register shortcut and emit toggle-window on trigger", async () => {
      const onTrigger = vi.fn();
      let registeredCallback: ((event: { state: string }) => Promise<void>) | null = null;

      mockRegister.mockImplementation((_shortcut: string, callback: any) => {
        registeredCallback = callback;
        return Promise.resolve();
      });

      const unregister = await registerGlobalShortcut("CommandOrControl+Shift+T", onTrigger);

      expect(mockRegister).toHaveBeenCalledWith("CommandOrControl+Shift+T", expect.any(Function));

      // Simulate shortcut trigger
      if (registeredCallback) {
        await registeredCallback({ state: "Pressed" });
      }

      expect(mockEmit).toHaveBeenCalledWith("toggle-window", {});
      expect(onTrigger).toHaveBeenCalled();

      // Test unregister
      await unregister();
      expect(mockUnregister).toHaveBeenCalledWith("CommandOrControl+Shift+T");
    });

    it("should not trigger on Released state", async () => {
      const onTrigger = vi.fn();
      let registeredCallback: ((event: { state: string }) => Promise<void>) | null = null;

      mockRegister.mockImplementation((_shortcut: string, callback: any) => {
        registeredCallback = callback;
        return Promise.resolve();
      });

      await registerGlobalShortcut("CommandOrControl+T", onTrigger);

      // Simulate Released state
      if (registeredCallback) {
        await registeredCallback({ state: "Released" });
      }

      expect(mockEmit).not.toHaveBeenCalled();
      expect(onTrigger).not.toHaveBeenCalled();
    });

    it("should return no-op unregister in non-Tauri environment", async () => {
      isTauriMock = false;
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const onTrigger = vi.fn();

      const unregister = await registerGlobalShortcut("CommandOrControl+T", onTrigger);

      expect(consoleSpy).toHaveBeenCalledWith("Global shortcuts only work in Tauri environment");
      expect(mockRegister).not.toHaveBeenCalled();

      // Unregister should be no-op
      await unregister();
      expect(mockUnregister).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("registerGlobalShortcutNoToggle", () => {
    it("should register shortcut without emitting toggle-window", async () => {
      const onTrigger = vi.fn();
      let registeredCallback: ((event: { state: string }) => Promise<void>) | null = null;

      mockRegister.mockImplementation((_shortcut: string, callback: any) => {
        registeredCallback = callback;
        return Promise.resolve();
      });

      const unregister = await registerGlobalShortcutNoToggle("CommandOrControl+K", onTrigger);

      expect(mockRegister).toHaveBeenCalledWith("CommandOrControl+K", expect.any(Function));

      // Simulate shortcut trigger
      if (registeredCallback) {
        await registeredCallback({ state: "Pressed" });
      }

      expect(mockEmit).not.toHaveBeenCalled(); // Should NOT emit toggle-window
      expect(onTrigger).toHaveBeenCalled();

      // Test unregister
      await unregister();
      expect(mockUnregister).toHaveBeenCalledWith("CommandOrControl+K");
    });

    it("should handle async onTrigger callback", async () => {
      const onTrigger = vi.fn().mockResolvedValue(undefined);
      let registeredCallback: ((event: { state: string }) => Promise<void>) | null = null;

      mockRegister.mockImplementation((_shortcut: string, callback: any) => {
        registeredCallback = callback;
        return Promise.resolve();
      });

      await registerGlobalShortcutNoToggle("CommandOrControl+K", onTrigger);

      if (registeredCallback) {
        await registeredCallback({ state: "Pressed" });
      }

      expect(onTrigger).toHaveBeenCalled();
    });

    it("should return no-op unregister in non-Tauri environment", async () => {
      isTauriMock = false;
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const onTrigger = vi.fn();

      const unregister = await registerGlobalShortcutNoToggle("CommandOrControl+K", onTrigger);

      expect(consoleSpy).toHaveBeenCalledWith("Global shortcuts only work in Tauri environment");
      expect(mockRegister).not.toHaveBeenCalled();

      await unregister();
      expect(mockUnregister).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("unregisterGlobalShortcut", () => {
    it("should unregister shortcut", async () => {
      await unregisterGlobalShortcut("CommandOrControl+T");

      expect(mockUnregister).toHaveBeenCalledWith("CommandOrControl+T");
    });

    it("should do nothing in non-Tauri environment", async () => {
      isTauriMock = false;

      await unregisterGlobalShortcut("CommandOrControl+T");

      expect(mockUnregister).not.toHaveBeenCalled();
    });
  });

  describe("unregisterAllShortcuts", () => {
    it("should unregister all shortcuts", async () => {
      await unregisterAllShortcuts();

      expect(mockUnregisterAll).toHaveBeenCalled();
    });

    it("should do nothing in non-Tauri environment", async () => {
      isTauriMock = false;

      await unregisterAllShortcuts();

      expect(mockUnregisterAll).not.toHaveBeenCalled();
    });
  });

  describe("isShortcutRegistered", () => {
    it("should check if shortcut is registered", async () => {
      mockIsRegistered.mockResolvedValue(true);

      const result = await isShortcutRegistered("CommandOrControl+T");

      expect(mockIsRegistered).toHaveBeenCalledWith("CommandOrControl+T");
      expect(result).toBe(true);
    });

    it("should return false for unregistered shortcut", async () => {
      mockIsRegistered.mockResolvedValue(false);

      const result = await isShortcutRegistered("CommandOrControl+X");

      expect(result).toBe(false);
    });

    it("should return false in non-Tauri environment", async () => {
      isTauriMock = false;

      const result = await isShortcutRegistered("CommandOrControl+T");

      expect(mockIsRegistered).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe("registerLocalShortcut", () => {
    it("should register local shortcut", async () => {
      const onTrigger = vi.fn();
      let registeredCallback: ((event: { state: string }) => Promise<void>) | null = null;

      mockRegister.mockImplementation((_shortcut: string, callback: any) => {
        registeredCallback = callback;
        return Promise.resolve();
      });

      const unregister = await registerLocalShortcut("F1", onTrigger);

      expect(mockRegister).toHaveBeenCalledWith("F1", expect.any(Function));

      // Simulate shortcut trigger
      if (registeredCallback) {
        await registeredCallback({ state: "Pressed" });
      }

      expect(onTrigger).toHaveBeenCalled();

      // Test unregister
      await unregister();
      expect(mockUnregister).toHaveBeenCalledWith("F1");
    });

    it("should not trigger on Released state", async () => {
      const onTrigger = vi.fn();
      let registeredCallback: ((event: { state: string }) => Promise<void>) | null = null;

      mockRegister.mockImplementation((_shortcut: string, callback: any) => {
        registeredCallback = callback;
        return Promise.resolve();
      });

      await registerLocalShortcut("F2", onTrigger);

      if (registeredCallback) {
        await registeredCallback({ state: "Released" });
      }

      expect(onTrigger).not.toHaveBeenCalled();
    });

    it("should return no-op unregister in non-Tauri environment", async () => {
      isTauriMock = false;
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const onTrigger = vi.fn();

      const unregister = await registerLocalShortcut("F1", onTrigger);

      expect(consoleSpy).toHaveBeenCalledWith("Local shortcuts only work in Tauri environment");
      expect(mockRegister).not.toHaveBeenCalled();

      await unregister();
      expect(mockUnregister).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
