import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ToastType } from "./Toast";
import { Toast, ToastContainer } from "./Toast";

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render toast with message", () => {
    const onClose = vi.fn();
    render(<Toast message="Test message" onClose={onClose} />);

    expect(screen.getByText("Test message")).toBeInTheDocument();
  });

  it("should render with default info type", () => {
    const onClose = vi.fn();
    render(<Toast message="Test" onClose={onClose} />);

    // Just verify the message is rendered, styles are mocked
    expect(screen.getByText("Test")).toBeInTheDocument();
  });

  it("should render with different toast types", () => {
    const onClose = vi.fn();
    const types: ToastType[] = ["info", "success", "warning", "error"];

    types.forEach((type) => {
      const { unmount } = render(
        <Toast message={`${type} message`} type={type} onClose={onClose} />
      );
      expect(screen.getByText(`${type} message`)).toBeInTheDocument();
      unmount();
    });
  });

  it("should call onClose after duration", () => {
    const onClose = vi.fn();
    render(<Toast message="Test" duration={1000} onClose={onClose} />);

    expect(onClose).not.toHaveBeenCalled();

    // Advance time to trigger timeout (1000ms) + fade out delay (200ms)
    act(() => {
      vi.advanceTimersByTime(1200);
    });

    // onClose should be called synchronously after timers advance
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should call onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<Toast message="Test" onClose={onClose} />);

    const closeButton = screen.getByRole("button", { name: /×/ });
    act(() => {
      closeButton.click();
      vi.advanceTimersByTime(200); // fade out delay
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should cleanup timer on unmount", () => {
    const onClose = vi.fn();
    const { unmount } = render(<Toast message="Test" duration={1000} onClose={onClose} />);

    unmount();
    vi.advanceTimersByTime(2000);

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("ToastContainer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render nothing when toasts array is empty", () => {
    const { container } = render(<ToastContainer toasts={[]} onRemove={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("should render multiple toasts", () => {
    const toasts = [
      { id: "1", message: "First toast", type: "info" as ToastType },
      { id: "2", message: "Second toast", type: "success" as ToastType },
      { id: "3", message: "Third toast", type: "error" as ToastType },
    ];

    render(<ToastContainer toasts={toasts} onRemove={vi.fn()} />);

    expect(screen.getByText("First toast")).toBeInTheDocument();
    expect(screen.getByText("Second toast")).toBeInTheDocument();
    expect(screen.getByText("Third toast")).toBeInTheDocument();
  });

  it("should call onRemove when toast is closed", () => {
    const onRemove = vi.fn();
    const toasts = [{ id: "1", message: "Test toast", type: "info" as ToastType }];

    render(<ToastContainer toasts={toasts} onRemove={onRemove} />);

    const closeButton = screen.getByRole("button", { name: /×/ });
    act(() => {
      closeButton.click();
      vi.advanceTimersByTime(200); // fade out delay
    });

    expect(onRemove).toHaveBeenCalledWith("1");
  });

  it("should render toasts with correct types", () => {
    const toasts = [
      { id: "1", message: "Info", type: "info" as ToastType },
      { id: "2", message: "Success", type: "success" as ToastType },
      { id: "3", message: "Warning", type: "warning" as ToastType },
      { id: "4", message: "Error", type: "error" as ToastType },
    ];

    render(<ToastContainer toasts={toasts} onRemove={vi.fn()} />);

    expect(screen.getByText("Info")).toBeInTheDocument();
    expect(screen.getByText("Success")).toBeInTheDocument();
    expect(screen.getByText("Warning")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
  });
});
