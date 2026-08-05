"use client";

import "./OfflineUnavailable.css";

type OfflineUnavailableProps = {
  title?: string;
  message?: string;
};

/** Soft offline placeholder — caption-scale, no alarm iconography. */
export function OfflineUnavailable({
  title = "Unavailable offline",
  message = "Connect to use this area. Cached documents still work from Documents.",
}: OfflineUnavailableProps) {
  return (
    <div className="offline-unavailable" role="status">
      <p className="offline-unavailable__title">{title}</p>
      <p className="offline-unavailable__message">{message}</p>
    </div>
  );
}
