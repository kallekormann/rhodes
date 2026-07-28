"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { appendClientError } from "@/lib/dev/client-error-log";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AppErrorBoundary]", error, info.componentStack);
    void appendClientError({
      message: error.message,
      stack: `${error.stack ?? ""}\n${info.componentStack ?? ""}`,
      source: "AppErrorBoundary",
    });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-error-fallback" role="alert">
          <h1 className="app-error-fallback__title">Something went wrong</h1>
          <p className="app-error-fallback__message">
            {this.state.error.message || "The app hit an unexpected error."}
          </p>
          <p className="caption">
            Logged to <code>rhodes-app/logs/client-errors.log</code> (dev) — or
            run <code>await __rhodesErrors()</code> in the console.
          </p>
          <button
            type="button"
            className="app-error-fallback__retry"
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
