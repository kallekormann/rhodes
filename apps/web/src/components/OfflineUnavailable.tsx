"use client";

import { WifiOff } from "lucide-react";
import "./OfflineUnavailable.css";

type OfflineUnavailableProps = {
  title?: string;
  message?: string;
};

export function OfflineUnavailable({
  title = "You're offline",
  message = "This area needs an internet connection. Open a cached document from Documents to keep working offline.",
}: OfflineUnavailableProps) {
  return (
    <div className="offline-unavailable" role="status">
      <WifiOff size={28} strokeWidth={1.75} className="offline-unavailable__icon" />
      <h2 className="offline-unavailable__title">{title}</h2>
      <p className="offline-unavailable__message">{message}</p>
    </div>
  );
}
