"use client";

import { CircleCheck, CircleX, Info } from "lucide-react";
import type { ToastItem } from "@/context/AppContext";
import "./Toast.css";

const icons = {
  success: CircleCheck,
  error: CircleX,
  info: Info,
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

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
