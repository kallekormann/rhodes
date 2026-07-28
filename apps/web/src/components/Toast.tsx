"use client";

import Link from "next/link";
import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";
import type { ToastItem } from "@/context/AppContext";
import "./Toast.css";

const icons = {
  success: CircleCheck,
  error: CircleX,
  info: Info,
  warning: TriangleAlert,
} as const;

type ToastProps = {
  toast: ToastItem;
  onDismiss: (id: string) => void;
};

export function Toast({ toast, onDismiss }: ToastProps) {
  const Icon = icons[toast.variant];

  return (
    <div className={`toast toast--${toast.variant}`} role="status">
      <Icon size={18} strokeWidth={1.75} className="toast__icon" />
      <div className="toast__body">
        <span className="toast__message">{toast.message}</span>
        {toast.action ? (
          <Link
            href={toast.action.href}
            className="toast__action"
            onClick={() => onDismiss(toast.id)}
          >
            {toast.action.label}
          </Link>
        ) : null}
      </div>
      <button
        type="button"
        className="toast__dismiss"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  const defaultToasts = toasts.filter((t) => t.placement !== "bottom-center");
  const bottomCenterToasts = toasts.filter(
    (t) => t.placement === "bottom-center",
  );

  return (
    <>
      {defaultToasts.length > 0 && (
        <div className="toast-container" aria-live="polite">
          {defaultToasts.map((t) => (
            <Toast key={t.id} toast={t} onDismiss={onDismiss} />
          ))}
        </div>
      )}
      {bottomCenterToasts.length > 0 && (
        <div
          className="toast-container toast-container--bottom-center"
          aria-live="polite"
        >
          {bottomCenterToasts.map((t) => (
            <Toast key={t.id} toast={t} onDismiss={onDismiss} />
          ))}
        </div>
      )}
    </>
  );
}
