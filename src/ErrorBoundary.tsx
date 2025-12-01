import { Component, type ErrorInfo, type ReactNode } from "react";

export class ErrorWithJSX extends Error {
  jsx: ReactNode;

  constructor(message: string, jsx: ReactNode) {
    super(message);
    this.name = "ErrorWithJSX";
    this.jsx = jsx;
  }
}

export class ErrorBoundary extends Component<
  {
    fallback?: (error: Error, errorInfo: ErrorInfo) => ReactNode;
    children: ReactNode;
  },
  { hasError: boolean; error: Error | null; errorInfo: ErrorInfo | null }
> {
  state: {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
  } = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.state.errorInfo!);
      }

      // Default dev-friendly error display
      const error = this.state.error;
      const isErrorWithJSX = error instanceof ErrorWithJSX;

      return (
        <div className="border border-red-300 bg-red-50 rounded p-4 m-4 select-text self-start">
          <div className="font-semibold text-red-800 mb-2 text-lg">
            Error: {error.message}
          </div>

          {isErrorWithJSX && (
            <div className="mt-3 mb-3">{(error as ErrorWithJSX).jsx}</div>
          )}

          {error.stack && (
            <details className="mt-3">
              <summary className="cursor-pointer text-red-700 font-medium mb-1">
                Stack Trace
              </summary>
              <pre className="text-xs bg-red-100 p-3 rounded overflow-x-auto text-red-900 mt-2">
                {error.stack}
              </pre>
            </details>
          )}

          {this.state.errorInfo?.componentStack && (
            <details className="mt-3">
              <summary className="cursor-pointer text-red-700 font-medium mb-1">
                Component Stack
              </summary>
              <pre className="text-xs bg-red-100 p-3 rounded overflow-x-auto text-red-900 mt-2">
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
