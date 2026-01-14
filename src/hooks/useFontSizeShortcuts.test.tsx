import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFontSizeShortcuts } from "./useFontSizeShortcuts";
import * as settings from "@/lib/settings";

// Mock settings module
vi.mock("@/lib/settings", async () => {
  const actual = await vi.importActual("@/lib/settings");
  return {
    ...actual,
    loadSettings: vi.fn(),
    saveSettings: vi.fn(),
  };
});

describe("useFontSizeShortcuts", () => {
  const mockOnSettingsChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default settings
    vi.mocked(settings.loadSettings).mockReturnValue({
      opacity: 0.9,
      fontSize: 13,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should increase font size with Cmd+=", () => {
    renderHook(() =>
      useFontSizeShortcuts({
        disabled: false,
        onSettingsChange: mockOnSettingsChange,
      })
    );

    // Simulate Cmd+=
    const event = new KeyboardEvent("keydown", {
      key: "=",
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(settings.saveSettings).toHaveBeenCalledWith({
      opacity: 0.9,
      fontSize: 14,
    });
    expect(mockOnSettingsChange).toHaveBeenCalledWith({
      opacity: 0.9,
      fontSize: 14,
    });
  });

  it("should increase font size with Cmd++", () => {
    renderHook(() =>
      useFontSizeShortcuts({
        disabled: false,
        onSettingsChange: mockOnSettingsChange,
      })
    );

    // Simulate Cmd++
    const event = new KeyboardEvent("keydown", {
      key: "+",
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(settings.saveSettings).toHaveBeenCalledWith({
      opacity: 0.9,
      fontSize: 14,
    });
  });

  it("should decrease font size with Cmd+-", () => {
    renderHook(() =>
      useFontSizeShortcuts({
        disabled: false,
        onSettingsChange: mockOnSettingsChange,
      })
    );

    // Simulate Cmd+-
    const event = new KeyboardEvent("keydown", {
      key: "-",
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(settings.saveSettings).toHaveBeenCalledWith({
      opacity: 0.9,
      fontSize: 12,
    });
    expect(mockOnSettingsChange).toHaveBeenCalledWith({
      opacity: 0.9,
      fontSize: 12,
    });
  });

  it("should decrease font size with Cmd+_", () => {
    renderHook(() =>
      useFontSizeShortcuts({
        disabled: false,
        onSettingsChange: mockOnSettingsChange,
      })
    );

    // Simulate Cmd+_
    const event = new KeyboardEvent("keydown", {
      key: "_",
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(settings.saveSettings).toHaveBeenCalledWith({
      opacity: 0.9,
      fontSize: 12,
    });
  });

  it("should work with Ctrl instead of Cmd", () => {
    renderHook(() =>
      useFontSizeShortcuts({
        disabled: false,
        onSettingsChange: mockOnSettingsChange,
      })
    );

    // Simulate Ctrl+=
    const event = new KeyboardEvent("keydown", {
      key: "=",
      ctrlKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(settings.saveSettings).toHaveBeenCalledWith({
      opacity: 0.9,
      fontSize: 14,
    });
  });

  it("should not change font size below minimum (10)", () => {
    vi.mocked(settings.loadSettings).mockReturnValue({
      opacity: 0.9,
      fontSize: 10,
    });

    renderHook(() =>
      useFontSizeShortcuts({
        disabled: false,
        onSettingsChange: mockOnSettingsChange,
      })
    );

    // Try to decrease below minimum
    const event = new KeyboardEvent("keydown", {
      key: "-",
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    // Should not save or call callback since size didn't change
    expect(settings.saveSettings).not.toHaveBeenCalled();
    expect(mockOnSettingsChange).not.toHaveBeenCalled();
  });

  it("should not change font size above maximum (24)", () => {
    vi.mocked(settings.loadSettings).mockReturnValue({
      opacity: 0.9,
      fontSize: 24,
    });

    renderHook(() =>
      useFontSizeShortcuts({
        disabled: false,
        onSettingsChange: mockOnSettingsChange,
      })
    );

    // Try to increase above maximum
    const event = new KeyboardEvent("keydown", {
      key: "=",
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    // Should not save or call callback since size didn't change
    expect(settings.saveSettings).not.toHaveBeenCalled();
    expect(mockOnSettingsChange).not.toHaveBeenCalled();
  });

  it("should not trigger when disabled", () => {
    renderHook(() =>
      useFontSizeShortcuts({
        disabled: true,
        onSettingsChange: mockOnSettingsChange,
      })
    );

    // Try to increase font size
    const event = new KeyboardEvent("keydown", {
      key: "=",
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(settings.saveSettings).not.toHaveBeenCalled();
    expect(mockOnSettingsChange).not.toHaveBeenCalled();
  });

  it("should not trigger without Cmd or Ctrl", () => {
    renderHook(() =>
      useFontSizeShortcuts({
        disabled: false,
        onSettingsChange: mockOnSettingsChange,
      })
    );

    // Press = without modifier key
    const event = new KeyboardEvent("keydown", {
      key: "=",
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(settings.saveSettings).not.toHaveBeenCalled();
    expect(mockOnSettingsChange).not.toHaveBeenCalled();
  });

  it("should handle default fontSize when not set", () => {
    vi.mocked(settings.loadSettings).mockReturnValue({
      opacity: 0.9,
      // fontSize not set - should default to 13
    });

    renderHook(() =>
      useFontSizeShortcuts({
        disabled: false,
        onSettingsChange: mockOnSettingsChange,
      })
    );

    // Increase font size
    const event = new KeyboardEvent("keydown", {
      key: "=",
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(settings.saveSettings).toHaveBeenCalledWith({
      opacity: 0.9,
      fontSize: 14, // 13 (default) + 1
    });
  });
});
