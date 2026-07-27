"use client";

import { Wifi, WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import "./ConnectivityIndicator.css";

export function ConnectivityIndicator() {
  const { online } = useOnlineStatus();
  const label = online ? "Online" : "Offline";

  return (
    <span
      className={`connectivity-indicator ${online ? "" : "connectivity-indicator--offline"}`}
      role="status"
      aria-label={label}
      title={label}
    >
      {online ? (
        <Wifi size={20} strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <WifiOff size={20} strokeWidth={1.75} aria-hidden="true" />
      )}
    </span>
  );
}
