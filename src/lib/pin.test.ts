import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Tauri core module (for invoke command)
const mockInvoke = vi.fn().mockResolvedValue(undefined);
vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

// Mock settings module
const mockLoadSettings = vi.fn();
const mockSaveSettings = vi.fn();
vi.mock("./settings", () => ({
  loadSettings: () => mockLoadSettings(),
  saveSettings: (settings: unknown) => mockSaveSettings(settings),
}));

// Import after mocks
import { togglePinState, setPinState } from "./pin";

describe("pin.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadSettings.mockReturnValue({ pinned: false });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("togglePinState", () => {
    it("should toggle pin state from false to true", async () => {
      mockLoadSettings.mockReturnValue({ pinned: false });

      await togglePinState();

      expect(mockSaveSettings).toHaveBeenCalledWith({ pinned: true });
      // Should call set_pinned command (which emits pin-state-updated internally)
      expect(mockInvoke).toHaveBeenCalledWith("set_pinned", { pinned: true });
    });

    it("should toggle pin state from true to false", async () => {
      mockLoadSettings.mockReturnValue({ pinned: true });

      await togglePinState();

      expect(mockSaveSettings).toHaveBeenCalledWith({ pinned: false });
      // Should call set_pinned command
      expect(mockInvoke).toHaveBeenCalledWith("set_pinned", { pinned: false });
    });

    it("should handle undefined pinned as false", async () => {
      mockLoadSettings.mockReturnValue({});

      await togglePinState();

      expect(mockSaveSettings).toHaveBeenCalledWith({ pinned: true });
    });

    it("should revert on sync failure", async () => {
      mockLoadSettings.mockReturnValue({ pinned: false, fontSize: 14 });
      mockInvoke.mockRejectedValueOnce(new Error("Sync failed"));

      await togglePinState();

      // First save with new state
      expect(mockSaveSettings).toHaveBeenNthCalledWith(1, { pinned: true, fontSize: 14 });
      // Revert to original state on failure
      expect(mockSaveSettings).toHaveBeenNthCalledWith(2, { pinned: false, fontSize: 14 });
    });
  });

  describe("setPinState", () => {
    it("should set pin state to true", async () => {
      mockLoadSettings.mockReturnValue({ pinned: false });

      await setPinState(true);

      expect(mockSaveSettings).toHaveBeenCalledWith({ pinned: true });
      // Should call set_pinned command
      expect(mockInvoke).toHaveBeenCalledWith("set_pinned", { pinned: true });
    });

    it("should set pin state to false", async () => {
      mockLoadSettings.mockReturnValue({ pinned: true });

      await setPinState(false);

      expect(mockSaveSettings).toHaveBeenCalledWith({ pinned: false });
      // Should call set_pinned command
      expect(mockInvoke).toHaveBeenCalledWith("set_pinned", { pinned: false });
    });

    it("should skip if already in desired state", async () => {
      mockLoadSettings.mockReturnValue({ pinned: true });

      await setPinState(true);

      expect(mockSaveSettings).not.toHaveBeenCalled();
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("should revert on sync failure", async () => {
      mockLoadSettings.mockReturnValue({ pinned: false, opacity: 0.9 });
      mockInvoke.mockRejectedValueOnce(new Error("Sync failed"));

      await setPinState(true);

      // First save with new state
      expect(mockSaveSettings).toHaveBeenNthCalledWith(1, { pinned: true, opacity: 0.9 });
      // Revert to original state on failure
      expect(mockSaveSettings).toHaveBeenNthCalledWith(2, { pinned: false, opacity: 0.9 });
    });
  });
});
