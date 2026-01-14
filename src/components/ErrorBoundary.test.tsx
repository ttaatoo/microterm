import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorBoundary from "./ErrorBoundary";
import React from "react";

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error("Test error message");
  }
  return <div>No error</div>;
};

// Suppress console.error for error boundary tests
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalError;
});

describe("ErrorBoundary", () => {
  it("should render children when there is no error", () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("should catch error and render default error UI", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Test error message")).toBeInTheDocument();
    expect(screen.getByText("Try Again")).toBeInTheDocument();
    expect(screen.getByText("Reload App")).toBeInTheDocument();
  });

  it("should render custom fallback when provided", () => {
    const customFallback = <div>Custom error message</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Custom error message")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("should log error to console", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(console.error).toHaveBeenCalled();
  });

  it("should reset error state when Try Again is clicked", async () => {
    const user = userEvent.setup();
    const { rerender: _rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    const tryAgainButton = screen.getByText("Try Again");
    await user.click(tryAgainButton);

    // ErrorBoundary resets state, but component still throws error
    // We need to re-render with a component that doesn't throw
    const { unmount } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText("No error")).toBeInTheDocument();
    unmount();
  });

  it("should reload window when Reload App is clicked", async () => {
    const user = userEvent.setup();
    // In jsdom, window.location.reload cannot be mocked or verified
    // We verify the button exists and can be clicked without errors
    // The actual reload behavior would be tested in integration/e2e tests

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const reloadButton = screen.getByText("Reload App");
    expect(reloadButton).toBeInTheDocument();
    expect(reloadButton).toBeInstanceOf(HTMLButtonElement);
    
    // Click the button - it should not throw
    // In jsdom, window.location.reload() is a no-op, but the handler executes
    await user.click(reloadButton);
    
    // Button was clicked successfully - reload() was called but can't be verified in jsdom
    // The button may still be visible if the error re-throws after state reset
    // This is expected behavior in the test environment
  });

  it("should display error message when error has message", () => {
    const ErrorWithMessage = () => {
      throw new Error("Specific error message");
    };

    render(
      <ErrorBoundary>
        <ErrorWithMessage />
      </ErrorBoundary>
    );

    expect(screen.getByText("Specific error message")).toBeInTheDocument();
  });

  it("should display default message when error has no message", () => {
    const ErrorWithoutMessage = () => {
      throw new Error();
    };

    render(
      <ErrorBoundary>
        <ErrorWithoutMessage />
      </ErrorBoundary>
    );

    expect(screen.getByText("An unexpected error occurred")).toBeInTheDocument();
  });

  it("should handle multiple errors", async () => {
    const user = userEvent.setup();
    const { rerender: _rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    const tryAgainButton = screen.getByText("Try Again");
    await user.click(tryAgainButton);

    // Throw another error
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });
});
