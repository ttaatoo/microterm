import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { migrateSettingsIfNeeded } from "./migrateSettings";
import { getSettings, updateSettings } from "./tauri/settings";
import { loadSettings } from "./settings";

// Mock dependencies
vi.mock("./tauri/settings", () => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock("./settings", () => ({
  loadSettings: vi.fn(),
}));

const MIGRATION_KEY = "microterm-settings-migrated";

describe("migrateSettingsIfNeeded", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // Reset console methods
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("should skip migration if already migrated", async () => {
    localStorage.setItem(MIGRATION_KEY, "true");

    await migrateSettingsIfNeeded();

    expect(getSettings).not.toHaveBeenCalled();
    expect(loadSettings).not.toHaveBeenCalled();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("should skip migration if Rust settings already configured", async () => {
    (getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
      opacity: 0.9,
      fontSize: 14,
      globalShortcut: "CommandOrControl+Shift+T",
      shortcutEnabled: true,
      pinShortcut: "CommandOrControl+Backquote",
      onboardingComplete: true,
      pinned: false,
    });

    await migrateSettingsIfNeeded();

    expect(getSettings).toHaveBeenCalled();
    expect(loadSettings).not.toHaveBeenCalled();
    expect(updateSettings).not.toHaveBeenCalled();
    expect(localStorage.getItem(MIGRATION_KEY)).toBe("true");
  });

  it("should migrate settings from localStorage to Rust", async () => {
    (getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
      onboardingComplete: false,
    });

    (loadSettings as ReturnType<typeof vi.fn>).mockReturnValue({
      opacity: 0.85,
      fontSize: 13,
      globalShortcut: "CommandOrControl+Shift+T",
      shortcutEnabled: true,
      pinShortcut: "CommandOrControl+Backquote",
      onboardingComplete: false,
      pinned: false,
    });

    (updateSettings as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await migrateSettingsIfNeeded();

    expect(getSettings).toHaveBeenCalled();
    expect(loadSettings).toHaveBeenCalled();
    expect(updateSettings).toHaveBeenCalledWith({
      opacity: 0.85,
      fontSize: 13,
      globalShortcut: "CommandOrControl+Shift+T",
      shortcutEnabled: true,
      pinShortcut: "CommandOrControl+Backquote",
      onboardingComplete: false,
      pinned: false,
    });
    expect(localStorage.getItem(MIGRATION_KEY)).toBe("true");
  });

  it("should use default values for missing settings", async () => {
    (getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
      onboardingComplete: false,
    });

    (loadSettings as ReturnType<typeof vi.fn>).mockReturnValue({
      opacity: 0.9,
      // Missing fontSize, globalShortcut, etc.
    });

    (updateSettings as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await migrateSettingsIfNeeded();

    expect(updateSettings).toHaveBeenCalledWith({
      opacity: 0.9,
      fontSize: 13, // Default
      globalShortcut: "CommandOrControl+Shift+T", // Default
      shortcutEnabled: true, // Default (not false)
      pinShortcut: "CommandOrControl+Backquote", // Default
      onboardingComplete: false, // Default
      pinned: false, // Default
    });
  });

  it("should handle shortcutEnabled being false", async () => {
    (getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
      onboardingComplete: false,
    });

    (loadSettings as ReturnType<typeof vi.fn>).mockReturnValue({
      opacity: 0.9,
      shortcutEnabled: false,
    });

    (updateSettings as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await migrateSettingsIfNeeded();

    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        shortcutEnabled: false,
      })
    );
  });

  it("should not mark as migrated if updateSettings fails", async () => {
    (getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
      onboardingComplete: false,
    });

    (loadSettings as ReturnType<typeof vi.fn>).mockReturnValue({
      opacity: 0.9,
    });

    (updateSettings as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    await migrateSettingsIfNeeded();

    expect(updateSettings).toHaveBeenCalled();
    expect(localStorage.getItem(MIGRATION_KEY)).not.toBe("true");
  });

  it("should not mark as migrated on error", async () => {
    (getSettings as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error")
    );

    await migrateSettingsIfNeeded();

    expect(console.error).toHaveBeenCalled();
    expect(localStorage.getItem(MIGRATION_KEY)).not.toBe("true");
  });

  it("should handle error during getSettings", async () => {
    (getSettings as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Failed to get settings")
    );

    await migrateSettingsIfNeeded();

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Error during settings migration"),
      expect.any(Error)
    );
    expect(loadSettings).not.toHaveBeenCalled();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("should handle error during loadSettings", async () => {
    (getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
      onboardingComplete: false,
    });

    (loadSettings as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("Failed to load settings");
    });

    await migrateSettingsIfNeeded();

    expect(console.error).toHaveBeenCalled();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("should handle error during updateSettings", async () => {
    (getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
      onboardingComplete: false,
    });

    (loadSettings as ReturnType<typeof vi.fn>).mockReturnValue({
      opacity: 0.9,
    });

    (updateSettings as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Failed to update")
    );

    await migrateSettingsIfNeeded();

    expect(console.error).toHaveBeenCalled();
    expect(localStorage.getItem(MIGRATION_KEY)).not.toBe("true");
  });

  it("should log migration start", async () => {
    (getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
      onboardingComplete: false,
    });

    (loadSettings as ReturnType<typeof vi.fn>).mockReturnValue({
      opacity: 0.9,
    });

    (updateSettings as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await migrateSettingsIfNeeded();

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Starting settings migration")
    );
  });

  it("should log successful migration", async () => {
    (getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
      onboardingComplete: false,
    });

    (loadSettings as ReturnType<typeof vi.fn>).mockReturnValue({
      opacity: 0.9,
    });

    (updateSettings as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await migrateSettingsIfNeeded();

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Successfully migrated settings")
    );
  });
});
