import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Tauri event module
const mockEmit = vi.fn().mockResolvedValue(undefined);
vi.mock("@tauri-apps/api/event", () => ({
  emit: mockEmit,
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
      expect(mockEmit).toHaveBeenCalledWith("pin-state-changed", { pinned: true });
      expect(mockEmit).toHaveBeenCalledWith("pin-state-updated", { pinned: true });
    });

    it("should toggle pin state from true to false", async () => {
      mockLoadSettings.mockReturnValue({ pinned: true });

      await togglePinState();

      expect(mockSaveSettings).toHaveBeenCalledWith({ pinned: false });
      expect(mockEmit).toHaveBeenCalledWith("pin-state-changed", { pinned: false });
      expect(mockEmit).toHaveBeenCalledWith("pin-state-updated", { pinned: false });
    });

    it("should handle undefined pinned as false", async () => {
      mockLoadSettings.mockReturnValue({});

      await togglePinState();

      expect(mockSaveSettings).toHaveBeenCalledWith({ pinned: true });
    });

    it("should revert on sync failure", async () => {
      mockLoadSettings.mockReturnValue({ pinned: false, fontSize: 14 });
      mockEmit.mockRejectedValueOnce(new Error("Sync failed"));

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
      expect(mockEmit).toHaveBeenCalledWith("pin-state-changed", { pinned: true });
      expect(mockEmit).toHaveBeenCalledWith("pin-state-updated", { pinned: true });
    });

    it("should set pin state to false", async () => {
      mockLoadSettings.mockReturnValue({ pinned: true });

      await setPinState(false);

      expect(mockSaveSettings).toHaveBeenCalledWith({ pinned: false });
      expect(mockEmit).toHaveBeenCalledWith("pin-state-changed", { pinned: false });
    });

    it("should skip if already in desired state", async () => {
      mockLoadSettings.mockReturnValue({ pinned: true });

      await setPinState(true);

      expect(mockSaveSettings).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it("should revert on sync failure", async () => {
      mockLoadSettings.mockReturnValue({ pinned: false, opacity: 0.9 });
      mockEmit.mockRejectedValueOnce(new Error("Sync failed"));

      await setPinState(true);

      // First save with new state
      expect(mockSaveSettings).toHaveBeenNthCalledWith(1, { pinned: true, opacity: 0.9 });
      // Revert to original state on failure
      expect(mockSaveSettings).toHaveBeenNthCalledWith(2, { pinned: false, opacity: 0.9 });
    });
  });
});
