import { Component, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="panel">
            <h2>Something went wrong</h2>
            <div className="section-card">
              <strong>Error Details:</strong>
              <div className="summary">
                <div>{this.state.error?.message}</div>
                <details>
                  <summary>Stack Trace</summary>
                  <pre>{this.state.error?.stack}</pre>
                </details>
              </div>
              <div className="cta">
                <button onClick={() => window.location.reload()}>Reload Page</button>
                <button className="secondary" onClick={() => this.setState({ hasError: false, error: null })}>
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
