import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock CSS modules
vi.mock("./ResizeHandle.css", () => ({
  resizeHandle: "resize-handle",
  resizeHandleBottomRight: "resize-handle-bottom-right",
  resizeHandleBottomLeft: "resize-handle-bottom-left",
}));

// Hoist mock setup to intercept dynamic imports
const { mockSetSize, mockSetPosition, mockInnerSize, mockOuterPosition, mockGetCurrentWindow } = vi.hoisted(() => {
  const mockSetSize = vi.fn().mockResolvedValue(undefined);
  const mockSetPosition = vi.fn().mockResolvedValue(undefined);
  const mockInnerSize = vi.fn().mockResolvedValue({ width: 800, height: 600 });
  const mockOuterPosition = vi.fn().mockResolvedValue({ x: 100, y: 100 });

  const mockCurrentWindow = {
    innerSize: mockInnerSize,
    outerPosition: mockOuterPosition,
    setSize: mockSetSize,
    setPosition: mockSetPosition,
    listen: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
  };

  const mockGetCurrentWindow = vi.fn(() => mockCurrentWindow);

  return { mockSetSize, mockSetPosition, mockInnerSize, mockOuterPosition, mockGetCurrentWindow };
});

// Override global mocks with test-specific mocks
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: mockGetCurrentWindow,
}));

vi.mock("@tauri-apps/api/dpi", () => ({
  PhysicalSize: class PhysicalSize {
    constructor(public width: number, public height: number) {}
  },
  PhysicalPosition: class PhysicalPosition {
    constructor(public x: number, public y: number) {}
  },
}));

import ResizeHandle from "./ResizeHandle";

describe("ResizeHandle", () => {
  const mockOnResize = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock devicePixelRatio
    Object.defineProperty(window, "devicePixelRatio", {
      writable: true,
      configurable: true,
      value: 2,
    });
  });

  afterEach(() => {
    // Restore any style changes
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    vi.restoreAllMocks();
  });

  describe("Rendering", () => {
    it("should render with bottom-right position", () => {
      render(<ResizeHandle position="bottom-right" />);

      const handle = screen.getByTitle("Drag to resize");
      expect(handle).toBeInTheDocument();
      expect(handle).toHaveClass("resize-handle-bottom-right");
    });

    it("should render with bottom-left position", () => {
      render(<ResizeHandle position="bottom-left" />);

      const handle = screen.getByTitle("Drag to resize");
      expect(handle).toBeInTheDocument();
      expect(handle).toHaveClass("resize-handle-bottom-left");
    });

    it("should render SVG icon", () => {
      const { container } = render(<ResizeHandle position="bottom-right" />);

      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute("width", "12");
      expect(svg).toHaveAttribute("height", "12");
    });

    it("should flip SVG icon for left position", () => {
      const { container } = render(<ResizeHandle position="bottom-left" />);

      const svg = container.querySelector("svg");
      expect(svg).toHaveStyle({ transform: "scaleX(-1)" });
    });
  });

  describe("Mouse Down", () => {
    it("should prevent default on mouse down", async () => {
      render(<ResizeHandle position="bottom-right" />);

      const handle = screen.getByTitle("Drag to resize");
      const event = new MouseEvent("mousedown", { bubbles: true, screenX: 500, screenY: 500 });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");
      const stopPropagationSpy = vi.spyOn(event, "stopPropagation");

      fireEvent(handle, event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    it("should get window size on mouse down", async () => {
      render(<ResizeHandle position="bottom-right" />);

      const handle = screen.getByTitle("Drag to resize");
      fireEvent.mouseDown(handle, { screenX: 500, screenY: 500 });

      await waitFor(() => {
        expect(mockInnerSize).toHaveBeenCalled();
        expect(mockOuterPosition).toHaveBeenCalled();
      });
    });
  });

  describe("Resizing - Bottom Right", () => {
    it("should resize window on mouse move after mouse down", async () => {
      render(<ResizeHandle position="bottom-right" onResize={mockOnResize} />);

      const handle = screen.getByTitle("Drag to resize");

      // Mouse down - this will set isResizing to true after async completion
      fireEvent.mouseDown(handle, { screenX: 500, screenY: 500 });

      // Wait for mouseDown async operations and isResizing state update
      await waitFor(() => {
        expect(mockInnerSize).toHaveBeenCalled();
      });

      // Small delay to ensure state update has propagated
      await new Promise((resolve) => setTimeout(resolve, 10));

      vi.clearAllMocks();

      // Mouse move (expand by 100px in each direction)
      fireEvent.mouseMove(document, { screenX: 600, screenY: 600 });

      // Wait for async mouseMove handler to complete
      await waitFor(() => {
        expect(mockSetSize).toHaveBeenCalled();
      }, { timeout: 2000 });

      // Should expand width and height (deltaX: 100, deltaY: 100)
      // Original: 800x600, Delta: 100x100, New: 900x700 (in physical pixels with scale 2)
      const sizeCall = mockSetSize.mock.calls[0][0];
      expect(sizeCall.width).toBeGreaterThan(800);
      expect(sizeCall.height).toBeGreaterThan(600);
    });

    it("should constrain to minimum size", async () => {
      render(<ResizeHandle position="bottom-right" minWidth={400} minHeight={200} />);

      const handle = screen.getByTitle("Drag to resize");

      // Start at 800x600
      fireEvent.mouseDown(handle, { screenX: 500, screenY: 500 });

      await waitFor(() => {
        expect(mockInnerSize).toHaveBeenCalled();
      });

      // Small delay to ensure state update has propagated
      await new Promise((resolve) => setTimeout(resolve, 10));

      vi.clearAllMocks();

      // Try to shrink below minimum (move left and up)
      fireEvent.mouseMove(document, { screenX: 0, screenY: 0 });

      await waitFor(() => {
        expect(mockSetSize).toHaveBeenCalled();
      }, { timeout: 2000 });

      // Should be clamped to minimum (with scale factor 2)
      const sizeCall = mockSetSize.mock.calls[0][0];
      expect(sizeCall.width).toBeGreaterThanOrEqual(400 * 2);
      expect(sizeCall.height).toBeGreaterThanOrEqual(200 * 2);
    });

    it("should constrain to maximum size", async () => {
      render(<ResizeHandle position="bottom-right" maxWidth={1000} maxHeight={700} />);

      const handle = screen.getByTitle("Drag to resize");

      fireEvent.mouseDown(handle, { screenX: 500, screenY: 500 });

      await waitFor(() => {
        expect(mockInnerSize).toHaveBeenCalled();
      });

      // Small delay to ensure state update has propagated
      await new Promise((resolve) => setTimeout(resolve, 10));

      vi.clearAllMocks();

      // Try to expand beyond maximum
      fireEvent.mouseMove(document, { screenX: 2000, screenY: 2000 });

      await waitFor(() => {
        expect(mockSetSize).toHaveBeenCalled();
      }, { timeout: 2000 });

      // Should be clamped to maximum (with scale factor 2)
      const sizeCall = mockSetSize.mock.calls[0][0];
      expect(sizeCall.width).toBeLessThanOrEqual(1000 * 2);
      expect(sizeCall.height).toBeLessThanOrEqual(700 * 2);
    });

    it("should call onResize callback with logical pixels", async () => {
      render(<ResizeHandle position="bottom-right" onResize={mockOnResize} />);

      const handle = screen.getByTitle("Drag to resize");

      fireEvent.mouseDown(handle, { screenX: 500, screenY: 500 });

      await waitFor(() => {
        expect(mockInnerSize).toHaveBeenCalled();
      });

      // Small delay to ensure state update has propagated
      await new Promise((resolve) => setTimeout(resolve, 10));

      vi.clearAllMocks();

      fireEvent.mouseMove(document, { screenX: 600, screenY: 600 });

      await waitFor(() => {
        expect(mockOnResize).toHaveBeenCalled();
      });

      // Should call with logical pixels (divided by scale factor)
      const [width, height] = mockOnResize.mock.calls[0];
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
    });
  });

  describe("Resizing - Bottom Left", () => {
    it("should resize and reposition window for left resize", async () => {
      render(<ResizeHandle position="bottom-left" onResize={mockOnResize} />);

      const handle = screen.getByTitle("Drag to resize");

      // Mouse down
      fireEvent.mouseDown(handle, { screenX: 500, screenY: 500 });

      await waitFor(() => {
        expect(mockInnerSize).toHaveBeenCalled();
      });

      // Small delay to ensure state update has propagated
      await new Promise((resolve) => setTimeout(resolve, 10));

      vi.clearAllMocks();

      // Mouse move left (decrease X to expand width leftward)
      fireEvent.mouseMove(document, { screenX: 400, screenY: 600 });

      await waitFor(() => {
        expect(mockSetPosition).toHaveBeenCalled();
        expect(mockSetSize).toHaveBeenCalled();
      });

      // Should adjust position before resizing
      expect(mockSetPosition).toHaveBeenCalledBefore(mockSetSize);
    });

    it("should expand width leftward when dragging left", async () => {
      render(<ResizeHandle position="bottom-left" />);

      const handle = screen.getByTitle("Drag to resize");

      fireEvent.mouseDown(handle, { screenX: 500, screenY: 500 });

      await waitFor(() => {
        expect(mockInnerSize).toHaveBeenCalled();
      });

      // Small delay to ensure state update has propagated
      await new Promise((resolve) => setTimeout(resolve, 10));

      vi.clearAllMocks();

      // Drag left 100px
      fireEvent.mouseMove(document, { screenX: 400, screenY: 500 });

      await waitFor(() => {
        expect(mockSetSize).toHaveBeenCalled();
      }, { timeout: 2000 });

      // Width should increase (inverse deltaX)
      const sizeCall = mockSetSize.mock.calls[0][0];
      expect(sizeCall.width).toBeGreaterThan(800);
    });
  });

  describe("Mouse Up", () => {
    it("should stop resizing on mouse up", async () => {
      render(<ResizeHandle position="bottom-right" />);

      vi.clearAllMocks();

      const handle = screen.getByTitle("Drag to resize");

      // Start resizing
      fireEvent.mouseDown(handle, { screenX: 500, screenY: 500 });

      await waitFor(() => {
        expect(mockInnerSize).toHaveBeenCalled();
      });

      // Mouse up
      fireEvent.mouseUp(document);

      vi.clearAllMocks();

      // Further mouse moves should not trigger resizing
      fireEvent.mouseMove(document, { screenX: 600, screenY: 600 });

      // Wait a bit to ensure no calls
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockSetSize).not.toHaveBeenCalled();
    });

    it("should restore cursor on mouse up", async () => {
      render(<ResizeHandle position="bottom-right" />);

      const handle = screen.getByTitle("Drag to resize");

      // Start resizing
      fireEvent.mouseDown(handle, { screenX: 500, screenY: 500 });

      await waitFor(() => {
        expect(document.body.style.cursor).not.toBe("");
      });

      // Mouse up
      fireEvent.mouseUp(document);

      expect(document.body.style.cursor).toBe("");
      expect(document.body.style.userSelect).toBe("");
    });
  });

  describe("Cursor Styling", () => {
    it("should set nwse-resize cursor for bottom-right position", async () => {
      render(<ResizeHandle position="bottom-right" />);

      const handle = screen.getByTitle("Drag to resize");

      fireEvent.mouseDown(handle, { screenX: 500, screenY: 500 });

      await waitFor(() => {
        expect(document.body.style.cursor).toBe("nwse-resize");
      });
    });

    it("should set nesw-resize cursor for bottom-left position", async () => {
      render(<ResizeHandle position="bottom-left" />);

      const handle = screen.getByTitle("Drag to resize");

      fireEvent.mouseDown(handle, { screenX: 500, screenY: 500 });

      await waitFor(() => {
        expect(document.body.style.cursor).toBe("nesw-resize");
      });
    });

    it("should disable user selection during resize", async () => {
      render(<ResizeHandle position="bottom-right" />);

      const handle = screen.getByTitle("Drag to resize");

      fireEvent.mouseDown(handle, { screenX: 500, screenY: 500 });

      await waitFor(() => {
        expect(document.body.style.userSelect).toBe("none");
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle window size fetch errors gracefully", async () => {
      mockInnerSize.mockRejectedValueOnce(new Error("Size error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      render(<ResizeHandle position="bottom-right" />);

      const handle = screen.getByTitle("Drag to resize");
      fireEvent.mouseDown(handle, { screenX: 500, screenY: 500 });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "Failed to get window size:",
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });

    it("should handle resize errors gracefully", async () => {
      mockSetSize.mockRejectedValueOnce(new Error("Resize error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      render(<ResizeHandle position="bottom-right" />);

      const handle = screen.getByTitle("Drag to resize");

      fireEvent.mouseDown(handle, { screenX: 500, screenY: 500 });

      await waitFor(() => {
        expect(mockInnerSize).toHaveBeenCalled();
      });

      // Small delay to ensure state update has propagated
      await new Promise((resolve) => setTimeout(resolve, 10));

      fireEvent.mouseMove(document, { screenX: 600, screenY: 600 });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "Failed to resize window:",
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe("Component Cleanup", () => {
    it("should cleanup event listeners on unmount", async () => {
      const { unmount } = render(<ResizeHandle position="bottom-right" />);

      const handle = screen.getByTitle("Drag to resize");

      // Start resizing
      fireEvent.mouseDown(handle, { screenX: 500, screenY: 500 });

      await waitFor(() => {
        expect(mockInnerSize).toHaveBeenCalled();
      });

      const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

      // Unmount
      unmount();

      // Should remove listeners
      expect(removeEventListenerSpy).toHaveBeenCalledWith("mousemove", expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith("mouseup", expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });
});
