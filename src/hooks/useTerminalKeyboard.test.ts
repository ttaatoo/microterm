import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useTerminalKeyboard } from "./useTerminalKeyboard";
import { PtyManager } from "@/lib/ptyManager";
import type { Terminal } from "@xterm/xterm";

// Mock terminalKeyHandlers
const { mockCreateWordMovementHandler } = vi.hoisted(() => {
  return {
    mockCreateWordMovementHandler: vi.fn(() => vi.fn()),
  };
});

vi.mock("@/lib/terminalKeyHandlers", () => ({
  createWordMovementHandler: mockCreateWordMovementHandler,
}));

// Mock Tauri API
const mockInvoke = vi.fn().mockResolvedValue(undefined);
vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

describe("useTerminalKeyboard", () => {
  let mockTerminal: Terminal;
  let mockPtyManager: PtyManager;

  beforeEach(() => {
    mockTerminal = {
      attachCustomKeyEventHandler: vi.fn(),
    } as unknown as Terminal;

    mockPtyManager = {
      getSessionId: vi.fn().mockReturnValue("test-session-id"),
    } as unknown as PtyManager;

    mockCreateWordMovementHandler.mockClear();
    mockInvoke.mockClear();
  });

  it("should not setup handler when terminal is null", () => {
    renderHook(() =>
      useTerminalKeyboard({
        terminal: null,
        ptyManager: mockPtyManager,
      })
    );

    expect(mockCreateWordMovementHandler).not.toHaveBeenCalled();
    expect(mockTerminal.attachCustomKeyEventHandler).not.toHaveBeenCalled();
  });

  it("should not setup handler when ptyManager is null", () => {
    renderHook(() =>
      useTerminalKeyboard({
        terminal: mockTerminal,
        ptyManager: null,
      })
    );

    expect(mockCreateWordMovementHandler).not.toHaveBeenCalled();
    expect(mockTerminal.attachCustomKeyEventHandler).not.toHaveBeenCalled();
  });

  it("should setup word movement handler when both terminal and ptyManager are provided", async () => {
    renderHook(() =>
      useTerminalKeyboard({
        terminal: mockTerminal,
        ptyManager: mockPtyManager,
      })
    );

    await waitFor(() => {
      expect(mockCreateWordMovementHandler).toHaveBeenCalled();
    });

    expect(mockCreateWordMovementHandler).toHaveBeenCalledWith(
      mockTerminal,
      expect.any(Function), // getSessionId function
      mockInvoke
    );

    await waitFor(() => {
      expect(mockTerminal.attachCustomKeyEventHandler).toHaveBeenCalled();
    });
  });

  it("should pass getSessionId function that calls ptyManager.getSessionId", async () => {
    renderHook(() =>
      useTerminalKeyboard({
        terminal: mockTerminal,
        ptyManager: mockPtyManager,
      })
    );

    await waitFor(() => {
      expect(mockCreateWordMovementHandler).toHaveBeenCalled();
    });

    const callArgs = mockCreateWordMovementHandler.mock.calls[0];
    expect(callArgs).toBeDefined();
    expect(callArgs).toBeTruthy();
    expect(callArgs.length).toBeGreaterThan(1);
    // TypeScript doesn't narrow the type after expect, so we use a type assertion
    const getSessionId = (callArgs as unknown[])[1] as (() => string) | undefined;

    expect(getSessionId).toBeDefined();
    if (getSessionId) {
      expect(getSessionId()).toBe("test-session-id");
      expect(mockPtyManager.getSessionId).toHaveBeenCalled();
    }
  });

  it("should re-setup handler when terminal changes", async () => {
    const { rerender } = renderHook(
      ({ terminal }) =>
        useTerminalKeyboard({
          terminal,
          ptyManager: mockPtyManager,
        }),
      { initialProps: { terminal: mockTerminal } }
    );

    await waitFor(() => {
      expect(mockCreateWordMovementHandler).toHaveBeenCalledTimes(1);
    });

    const newTerminal = {
      attachCustomKeyEventHandler: vi.fn(),
    } as unknown as Terminal;

    rerender({ terminal: newTerminal });

    await waitFor(() => {
      expect(mockCreateWordMovementHandler).toHaveBeenCalledTimes(2);
    });
  });

  it("should re-setup handler when ptyManager changes", async () => {
    const { rerender } = renderHook(
      ({ ptyManager }) =>
        useTerminalKeyboard({
          terminal: mockTerminal,
          ptyManager,
        }),
      { initialProps: { ptyManager: mockPtyManager } }
    );

    await waitFor(() => {
      expect(mockCreateWordMovementHandler).toHaveBeenCalledTimes(1);
    });

    const newPtyManager = {
      getSessionId: vi.fn().mockReturnValue("new-session-id"),
    } as unknown as PtyManager;

    rerender({ ptyManager: newPtyManager });

    await waitFor(() => {
      expect(mockCreateWordMovementHandler).toHaveBeenCalledTimes(2);
    });
  });
});
