"use client";

/** TEMP (TD-004) — remove with client-error-log.ts after offline editor bug is fixed. */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { appendClientError } from "@/lib/dev/client-error-log";

type EditorErrorBoundaryProps = {
  children: ReactNode;
  documentId?: string | null;
};

type EditorErrorBoundaryState = {
  error: Error | null;
};

export class EditorErrorBoundary extends Component<
  EditorErrorBoundaryProps,
  EditorErrorBoundaryState
> {
  state: EditorErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): EditorErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    void appendClientError({
      message: error.message,
      stack: `${error.stack ?? ""}\n${info.componentStack ?? ""}`,
      source: `editor:${this.props.documentId ?? "unknown"}`,
    });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="editor-content__load-error" role="alert">
          <p className="editor-content__load-error-title">Editor failed to load</p>
          <p className="editor-content__load-error-message">
            {this.state.error.message}
          </p>
          <p className="caption">
            Logged to <code>rhodes-app/logs/client-errors.log</code> (dev) — or
            run <code>await __rhodesCopyErrors()</code> in the console.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
