"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component to catch and handle React component errors gracefully.
 * Prevents the entire app from crashing when a component throws.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console for debugging
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
  }

  handleReload = (): void => {
    // Reset state and reload the window
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleReset = (): void => {
    // Just reset state to try rendering again
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <h2>Something went wrong</h2>
            <p className="error-message">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <div className="error-actions">
              <button onClick={this.handleReset} className="error-button retry">
                Try Again
              </button>
              <button onClick={this.handleReload} className="error-button reload">
                Reload App
              </button>
            </div>
          </div>
          <style jsx>{`
            .error-boundary {
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              background: rgba(30, 30, 30, 0.95);
              color: #e5e5e5;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                sans-serif;
            }
            .error-boundary-content {
              text-align: center;
              padding: 2rem;
              max-width: 400px;
            }
            h2 {
              color: #e06c75;
              margin-bottom: 1rem;
              font-size: 1.5rem;
            }
            .error-message {
              color: #abb2bf;
              margin-bottom: 1.5rem;
              font-size: 0.9rem;
              word-break: break-word;
            }
            .error-actions {
              display: flex;
              gap: 1rem;
              justify-content: center;
            }
            .error-button {
              padding: 0.5rem 1rem;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 0.9rem;
              transition: opacity 0.2s;
            }
            .error-button:hover {
              opacity: 0.8;
            }
            .error-button.retry {
              background: #61afef;
              color: #1e1e1e;
            }
            .error-button.reload {
              background: #4b5263;
              color: #e5e5e5;
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
