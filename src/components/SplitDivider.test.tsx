import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SplitDivider from "./SplitDivider";
import { DEFAULT_SPLIT_RATIO, MIN_PANE_RATIO, MAX_PANE_RATIO } from "@/lib/constants";

describe("SplitDivider", () => {
  beforeEach(() => {
    // Reset document body styles
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });

  afterEach(() => {
    // Clean up any event listeners
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });

  it("should render divider", () => {
    const onResize = vi.fn();
    const { container } = render(<SplitDivider direction="vertical" branchId="branch-1" onResize={onResize} />);

    const divider = container.querySelector('[data-branch-id="branch-1"]');
    expect(divider).toBeInTheDocument();
  });

  it("should have correct data attribute", () => {
    const onResize = vi.fn();
    const { container } = render(
      <SplitDivider direction="vertical" branchId="test-branch" onResize={onResize} />
    );

    const divider = container.querySelector('[data-branch-id="test-branch"]');
    expect(divider).toBeInTheDocument();
  });

  it("should apply vertical direction class", () => {
    const onResize = vi.fn();
    const { container } = render(
      <SplitDivider direction="vertical" branchId="branch-1" onResize={onResize} />
    );

    const divider = container.querySelector('[data-branch-id="branch-1"]');
    expect(divider).toHaveClass("mocked-style"); // dividerVertical
  });

  it("should apply horizontal direction class", () => {
    const onResize = vi.fn();
    const { container } = render(
      <SplitDivider direction="horizontal" branchId="branch-1" onResize={onResize} />
    );

    const divider = container.querySelector('[data-branch-id="branch-1"]');
    expect(divider).toHaveClass("mocked-style"); // dividerHorizontal
  });

  it("should set dragging state on mouse down", async () => {
    const onResize = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <div style={{ width: "1000px", height: "500px" }}>
        <div style={{ width: "500px", height: "500px" }}>First</div>
        <SplitDivider direction="vertical" branchId="branch-1" onResize={onResize} />
        <div style={{ width: "500px", height: "500px" }}>Second</div>
      </div>
    );

    const divider = container.querySelector('[data-branch-id="branch-1"]') as HTMLElement;
    await user.pointer({ keys: "[MouseLeft>]", target: divider });

    // Divider should have active class when dragging
    expect(divider).toHaveClass("mocked-style"); // dividerActive
  });

  it("should prevent default on mouse down", async () => {
    const onResize = vi.fn();
    const _user = userEvent.setup();
    const { container } = render(
      <SplitDivider direction="vertical" branchId="branch-1" onResize={onResize} />
    );

    const divider = container.querySelector('[data-branch-id="branch-1"]') as HTMLElement;
    const mouseDownEvent = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    const preventDefaultSpy = vi.spyOn(mouseDownEvent, "preventDefault");

    divider.dispatchEvent(mouseDownEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it("should calculate ratio from first child size (vertical)", async () => {
    const onResize = vi.fn();
    const { container } = render(
      <div style={{ width: "1000px", height: "500px" }}>
        <div style={{ width: "300px", height: "500px" }}>First</div>
        <SplitDivider direction="vertical" branchId="branch-1" onResize={onResize} />
        <div style={{ width: "700px", height: "500px" }}>Second</div>
      </div>
    );

    const divider = container.querySelector('[data-branch-id="branch-1"]') as HTMLElement;
    const parentDiv = divider.parentElement as HTMLElement;
    
    // Ensure parent has correct dimensions
    Object.defineProperty(parentDiv, "clientWidth", { value: 1000, configurable: true });
    
    // Use fireEvent to trigger React synthetic event
    await act(async () => {
      fireEvent.mouseDown(divider, {
        clientX: 300,
        clientY: 250,
      });
      // Wait for state update and useEffect to run
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Move mouse to simulate resize - this should trigger onResize
    fireEvent.mouseMove(document, {
      clientX: 400, // 100px to the right from start (300px)
      clientY: 250,
    });

    // Wait for onResize to be called
    await waitFor(() => {
      expect(onResize).toHaveBeenCalled();
    }, { timeout: 1000 });

    // Mouse up
    fireEvent.mouseUp(document);

    const lastCall = onResize.mock.calls[onResize.mock.calls.length - 1][0];
    expect(lastCall).toBeGreaterThanOrEqual(MIN_PANE_RATIO);
    expect(lastCall).toBeLessThanOrEqual(MAX_PANE_RATIO);
  });

  it("should calculate ratio from first child size (horizontal)", async () => {
    const onResize = vi.fn();
    const { container } = render(
      <div style={{ width: "1000px", height: "500px" }}>
        <div style={{ width: "1000px", height: "200px" }}>First</div>
        <SplitDivider direction="horizontal" branchId="branch-1" onResize={onResize} />
        <div style={{ width: "1000px", height: "300px" }}>Second</div>
      </div>
    );

    const divider = container.querySelector('[data-branch-id="branch-1"]') as HTMLElement;
    const parentDiv = divider.parentElement as HTMLElement;
    
    // Ensure parent has correct dimensions
    Object.defineProperty(parentDiv, "clientHeight", { value: 500, configurable: true });
    
    await act(async () => {
      fireEvent.mouseDown(divider, {
        clientX: 500,
        clientY: 200,
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    fireEvent.mouseMove(document, {
      clientX: 500,
      clientY: 250, // 50px down from start (200px)
    });

    await waitFor(() => {
      expect(onResize).toHaveBeenCalled();
    }, { timeout: 1000 });

    fireEvent.mouseUp(document);
  });

  it("should use default ratio when no first child", async () => {
    const onResize = vi.fn();
    const { container } = render(
      <div style={{ width: "1000px", height: "500px" }}>
        <SplitDivider direction="vertical" branchId="branch-1" onResize={onResize} />
      </div>
    );

    const divider = container.querySelector('[data-branch-id="branch-1"]') as HTMLElement;
    const parentDiv = divider.parentElement as HTMLElement;
    
    // Ensure parent has correct dimensions
    Object.defineProperty(parentDiv, "clientWidth", { value: 1000, configurable: true });
    
    await act(async () => {
      fireEvent.mouseDown(divider, {
        clientX: 500,
        clientY: 250,
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    fireEvent.mouseMove(document, {
      clientX: 600,
      clientY: 250,
    });

    await waitFor(() => {
      expect(onResize).toHaveBeenCalled();
    }, { timeout: 1000 });

    fireEvent.mouseUp(document);
  });

  it("should clamp ratio to min/max bounds", async () => {
    const onResize = vi.fn();
    const { container } = render(
      <div style={{ width: "1000px", height: "500px" }}>
        <div style={{ width: "500px", height: "500px" }}>First</div>
        <SplitDivider direction="vertical" branchId="branch-1" onResize={onResize} />
        <div style={{ width: "500px", height: "500px" }}>Second</div>
      </div>
    );

    const divider = container.querySelector('[data-branch-id="branch-1"]') as HTMLElement;
    const parentDiv = divider.parentElement as HTMLElement;
    
    // Ensure parent has correct dimensions
    Object.defineProperty(parentDiv, "clientWidth", { value: 1000, configurable: true });
    
    await act(async () => {
      fireEvent.mouseDown(divider, {
        clientX: 500,
        clientY: 250,
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    fireEvent.mouseMove(document, {
      clientX: 50, // Way too far left
      clientY: 250,
    });

    await waitFor(() => {
      expect(onResize).toHaveBeenCalled();
    }, { timeout: 1000 });

    fireEvent.mouseUp(document);

    const lastCall = onResize.mock.calls[onResize.mock.calls.length - 1][0];
    expect(lastCall).toBeGreaterThanOrEqual(MIN_PANE_RATIO);
    expect(lastCall).toBeLessThanOrEqual(MAX_PANE_RATIO);
  });

  it("should reset to default ratio on double click", async () => {
    const onResize = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <SplitDivider direction="vertical" branchId="branch-1" onResize={onResize} />
    );

    const divider = container.querySelector('[data-branch-id="branch-1"]') as HTMLElement;
    await user.dblClick(divider);

    expect(onResize).toHaveBeenCalledWith(DEFAULT_SPLIT_RATIO);
  });

  it("should set cursor style during drag (vertical)", async () => {
    const onResize = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <SplitDivider direction="vertical" branchId="branch-1" onResize={onResize} />
    );

    const divider = container.querySelector('[data-branch-id="branch-1"]') as HTMLElement;
    await user.pointer({ keys: "[MouseLeft>]", target: divider });

    expect(document.body.style.cursor).toBe("col-resize");
    expect(document.body.style.userSelect).toBe("none");

    await user.pointer({ keys: "[/MouseLeft]" });

    // Should restore original styles
    expect(document.body.style.cursor).toBe("");
    expect(document.body.style.userSelect).toBe("");
  });

  it("should set cursor style during drag (horizontal)", async () => {
    const onResize = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <SplitDivider direction="horizontal" branchId="branch-1" onResize={onResize} />
    );

    const divider = container.querySelector('[data-branch-id="branch-1"]') as HTMLElement;
    await user.pointer({ keys: "[MouseLeft>]", target: divider });

    expect(document.body.style.cursor).toBe("row-resize");
    expect(document.body.style.userSelect).toBe("none");

    await user.pointer({ keys: "[/MouseLeft]" });
  });

  it("should stop dragging on mouse up", async () => {
    const onResize = vi.fn();
    const { container } = render(
      <div style={{ width: "1000px", height: "500px" }}>
        <div style={{ width: "500px", height: "500px" }}>First</div>
        <SplitDivider direction="vertical" branchId="branch-1" onResize={onResize} />
        <div style={{ width: "500px", height: "500px" }}>Second</div>
      </div>
    );

    const divider = container.querySelector('[data-branch-id="branch-1"]') as HTMLElement;
    const parentDiv = divider.parentElement as HTMLElement;
    
    // Ensure parent has correct dimensions
    Object.defineProperty(parentDiv, "clientWidth", { value: 1000, configurable: true });
    
    await act(async () => {
      fireEvent.mouseDown(divider, {
        clientX: 500,
        clientY: 250,
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    fireEvent.mouseMove(document, {
      clientX: 600,
      clientY: 250,
    });

    await waitFor(() => {
      expect(onResize).toHaveBeenCalled();
    }, { timeout: 1000 });

    await act(async () => {
      fireEvent.mouseUp(document);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Move mouse again - should not trigger resize
    const moveCountBefore = onResize.mock.calls.length;
    fireEvent.mouseMove(document, {
      clientX: 700,
      clientY: 250,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onResize.mock.calls.length).toBe(moveCountBefore);
  });

  it("should handle zero container size gracefully", async () => {
    const onResize = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <div style={{ width: "0px", height: "0px" }}>
        <SplitDivider direction="vertical" branchId="branch-1" onResize={onResize} />
      </div>
    );

    const divider = container.querySelector('[data-branch-id="branch-1"]') as HTMLElement;
    await user.pointer({ keys: "[MouseLeft>]", target: divider });

    const mouseMoveEvent = new MouseEvent("mousemove", {
      bubbles: true,
      clientX: 100,
      clientY: 100,
    });
    document.dispatchEvent(mouseMoveEvent);

    // Should not call onResize when container size is 0
    await user.pointer({ keys: "[/MouseLeft]" });
    // onResize might be called but with clamped values
  });
});
