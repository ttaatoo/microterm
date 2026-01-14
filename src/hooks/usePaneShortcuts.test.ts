import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePaneShortcuts } from "./usePaneShortcuts";
import { usePaneContext } from "@/contexts/PaneContext";
import { useTabContext } from "@/contexts/TabContext";

// Mock contexts
vi.mock("@/contexts/PaneContext", async () => {
  const actual = await vi.importActual("@/contexts/PaneContext");
  return {
    ...actual,
    usePaneContext: vi.fn(),
  };
});

vi.mock("@/contexts/TabContext", async () => {
  const actual = await vi.importActual("@/contexts/TabContext");
  return {
    ...actual,
    useTabContext: vi.fn(),
  };
});

describe("usePaneShortcuts", () => {
  const mockGetActivePaneId = vi.fn();
  const mockSplitPane = vi.fn();
  const mockClosePane = vi.fn();
  const mockGetPaneCount = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (usePaneContext as ReturnType<typeof vi.fn>).mockReturnValue({
      getActivePaneId: mockGetActivePaneId,
      splitPane: mockSplitPane,
      closePane: mockClosePane,
      getPaneCount: mockGetPaneCount,
    });
    (useTabContext as ReturnType<typeof vi.fn>).mockReturnValue({
      activeTabId: "tab-1",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return split and close functions", () => {
    const { result } = renderHook(() => usePaneShortcuts());

    expect(result.current.splitVertical).toBeDefined();
    expect(result.current.splitHorizontal).toBeDefined();
    expect(result.current.closeActivePane).toBeDefined();
  });

  it("should not handle shortcuts when disabled", () => {
    mockGetActivePaneId.mockReturnValue("pane-1");
    mockGetPaneCount.mockReturnValue(2);

    renderHook(() => usePaneShortcuts({ disabled: true }));

    const event = new KeyboardEvent("keydown", {
      key: "d",
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(mockSplitPane).not.toHaveBeenCalled();
  });

  it("should split vertically on Cmd+D", () => {
    mockGetActivePaneId.mockReturnValue("pane-1");

    renderHook(() => usePaneShortcuts());

    const event = new KeyboardEvent("keydown", {
      key: "d",
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(mockSplitPane).toHaveBeenCalledWith("tab-1", "pane-1", "vertical");
  });

  it("should split horizontally on Cmd+Shift+D", () => {
    mockGetActivePaneId.mockReturnValue("pane-1");

    renderHook(() => usePaneShortcuts());

    const event = new KeyboardEvent("keydown", {
      key: "d",
      metaKey: true,
      shiftKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(mockSplitPane).toHaveBeenCalledWith("tab-1", "pane-1", "horizontal");
  });

  it("should split vertically on Ctrl+D", () => {
    mockGetActivePaneId.mockReturnValue("pane-1");

    renderHook(() => usePaneShortcuts());

    const event = new KeyboardEvent("keydown", {
      key: "d",
      ctrlKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(mockSplitPane).toHaveBeenCalledWith("tab-1", "pane-1", "vertical");
  });

  it("should not split when no active tab", () => {
    (useTabContext as ReturnType<typeof vi.fn>).mockReturnValue({
      activeTabId: null,
    });

    renderHook(() => usePaneShortcuts());

    const event = new KeyboardEvent("keydown", {
      key: "d",
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(mockSplitPane).not.toHaveBeenCalled();
  });

  it("should not split when no active pane", () => {
    mockGetActivePaneId.mockReturnValue(null);

    renderHook(() => usePaneShortcuts());

    const event = new KeyboardEvent("keydown", {
      key: "d",
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(mockSplitPane).not.toHaveBeenCalled();
  });

  it("should close pane on Cmd+W when multiple panes exist", () => {
    mockGetActivePaneId.mockReturnValue("pane-1");
    mockGetPaneCount.mockReturnValue(2);
    mockClosePane.mockReturnValue(true);

    renderHook(() => usePaneShortcuts());

    const event = new KeyboardEvent("keydown", {
      key: "w",
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(mockClosePane).toHaveBeenCalledWith("tab-1", "pane-1");
  });

  it("should not close pane on Cmd+W when only one pane exists", () => {
    mockGetActivePaneId.mockReturnValue("pane-1");
    mockGetPaneCount.mockReturnValue(1);

    renderHook(() => usePaneShortcuts());

    const event = new KeyboardEvent("keydown", {
      key: "w",
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(mockClosePane).not.toHaveBeenCalled();
  });

  it("should not close pane on Cmd+Shift+W", () => {
    mockGetActivePaneId.mockReturnValue("pane-1");
    mockGetPaneCount.mockReturnValue(2);

    renderHook(() => usePaneShortcuts());

    const event = new KeyboardEvent("keydown", {
      key: "w",
      metaKey: true,
      shiftKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(mockClosePane).not.toHaveBeenCalled();
  });

  it("should prevent default and stop propagation on split shortcuts", () => {
    mockGetActivePaneId.mockReturnValue("pane-1");

    renderHook(() => usePaneShortcuts());

    const event = new KeyboardEvent("keydown", {
      key: "d",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");
    const stopPropagationSpy = vi.spyOn(event, "stopPropagation");

    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(stopPropagationSpy).toHaveBeenCalled();
  });

  it("should prevent default and stop propagation on close shortcut", () => {
    mockGetActivePaneId.mockReturnValue("pane-1");
    mockGetPaneCount.mockReturnValue(2);

    renderHook(() => usePaneShortcuts());

    const event = new KeyboardEvent("keydown", {
      key: "w",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");
    const stopPropagationSpy = vi.spyOn(event, "stopPropagation");

    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(stopPropagationSpy).toHaveBeenCalled();
  });

  it("should not handle keys without modifier", () => {
    mockGetActivePaneId.mockReturnValue("pane-1");

    renderHook(() => usePaneShortcuts());

    const event = new KeyboardEvent("keydown", {
      key: "d",
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(mockSplitPane).not.toHaveBeenCalled();
  });

  it("should not handle other keys", () => {
    mockGetActivePaneId.mockReturnValue("pane-1");

    renderHook(() => usePaneShortcuts());

    const event = new KeyboardEvent("keydown", {
      key: "x",
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(mockSplitPane).not.toHaveBeenCalled();
    expect(mockClosePane).not.toHaveBeenCalled();
  });

  it("should debounce close pane calls", () => {
    mockGetActivePaneId.mockReturnValue("pane-1");
    mockGetPaneCount.mockReturnValue(2);
    mockClosePane.mockReturnValue(true);

    vi.useFakeTimers();
    const { result } = renderHook(() => usePaneShortcuts());

    // First close
    act(() => {
      result.current.closeActivePane();
    });

    // Second close immediately (should be ignored)
    act(() => {
      result.current.closeActivePane();
    });

    expect(mockClosePane).toHaveBeenCalledTimes(1);

    // Advance time
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Now should allow another close
    act(() => {
      result.current.closeActivePane();
    });

    expect(mockClosePane).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("should cleanup event listeners on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => usePaneShortcuts());

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function), true);

    removeEventListenerSpy.mockRestore();
  });

  it("should call splitVertical function", () => {
    mockGetActivePaneId.mockReturnValue("pane-1");

    const { result } = renderHook(() => usePaneShortcuts());

    act(() => {
      result.current.splitVertical();
    });

    expect(mockSplitPane).toHaveBeenCalledWith("tab-1", "pane-1", "vertical");
  });

  it("should call splitHorizontal function", () => {
    mockGetActivePaneId.mockReturnValue("pane-1");

    const { result } = renderHook(() => usePaneShortcuts());

    act(() => {
      result.current.splitHorizontal();
    });

    expect(mockSplitPane).toHaveBeenCalledWith("tab-1", "pane-1", "horizontal");
  });
});
