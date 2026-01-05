import { Component, ErrorInfo, ReactNode } from "react";
import * as styles from "./ErrorBoundary.css";

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
        <div className={styles.errorBoundary}>
          <div className={styles.errorBoundaryContent}>
            <h2>Something went wrong</h2>
            <p className={styles.errorMessage}>
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <div className={styles.errorActions}>
              <button onClick={this.handleReset} className={`${styles.errorButton} ${styles.errorButtonRetry}`}>
                Try Again
              </button>
              <button onClick={this.handleReload} className={`${styles.errorButton} ${styles.errorButtonReload}`}>
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
