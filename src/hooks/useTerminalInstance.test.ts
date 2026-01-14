import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTerminalInstance } from "./useTerminalInstance";
import { createRef } from "react";

// Mock dependencies
vi.mock("@xterm/xterm", () => ({
  Terminal: class MockTerminal {
    open = vi.fn();
    focus = vi.fn();
    dispose = vi.fn();
    onData = vi.fn();
    cols = 80;
    rows = 24;
    options: any = {};
    refresh = vi.fn();

    constructor(_options: any) {
      this.options = _options;
    }
  },
}));

vi.mock("@/lib/terminal/theme", () => ({
  getTerminalTheme: vi.fn((opacity) => ({
    background: `rgba(0, 0, 0, ${opacity})`,
    foreground: "#abb2bf",
  })),
}));

vi.mock("@/lib/terminalAddons", () => ({
  setupTerminalAddons: vi.fn(() => ({
    fitAddon: { fit: vi.fn() },
    searchAddon: {},
    webglAddon: { dispose: vi.fn() },
  })),
}));

vi.mock("@/lib/settings", () => ({
  loadSettings: vi.fn(() => ({
    opacity: 0.96,
    fontSize: 14,
  })),
}));

import { getTerminalTheme } from "@/lib/terminal/theme";

describe("useTerminalInstance", () => {
  let containerRef: ReturnType<typeof createRef<HTMLDivElement>>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a real DOM element for the container
    const div = document.createElement("div");
    document.body.appendChild(div);

    containerRef = { current: div };
  });

  it("should create terminal instance on mount", () => {
    const { result } = renderHook(() =>
      useTerminalInstance({
        containerRef,
        opacity: 0.95,
        fontSize: 16,
      })
    );

    // Check that terminal was created
    expect(result.current).not.toBeNull();
    expect(result.current?.terminal).toBeDefined();
    expect(result.current?.fitAddon).toBeDefined();

    // Verify terminal options
    expect(result.current?.terminal.options).toMatchObject({
      fontSize: 16,
      cursorBlink: true,
      cursorStyle: "block",
    });
  });

  it("should apply initial opacity from props", () => {
    renderHook(() =>
      useTerminalInstance({
        containerRef,
        opacity: 0.85,
      })
    );

    expect(getTerminalTheme).toHaveBeenCalledWith(0.85);
  });

  it("should update theme when opacity changes", () => {
    const { rerender } = renderHook(
      ({ opacity }) =>
        useTerminalInstance({
          containerRef,
          opacity,
        }),
      { initialProps: { opacity: 0.95 } }
    );

    vi.clearAllMocks();

    // Change opacity
    rerender({ opacity: 0.80 });

    expect(getTerminalTheme).toHaveBeenCalledWith(0.80);
  });

  it("should register onData handler if provided", () => {
    const mockOnData = vi.fn();

    const { result } = renderHook(() =>
      useTerminalInstance({
        containerRef,
        onData: mockOnData,
      })
    );

    // Verify onData was called during setup
    expect(result.current?.terminal.onData).toHaveBeenCalledWith(mockOnData);
  });

  it("should cleanup on unmount", () => {
    const { result, unmount } = renderHook(() =>
      useTerminalInstance({
        containerRef,
      })
    );

    const terminal = result.current?.terminal;
    expect(terminal).toBeDefined();

    unmount();

    // Verify dispose was called
    expect(terminal?.dispose).toHaveBeenCalled();
  });
});
