"use client";

import type { ReactNode } from "react";
import { OfflineUnavailable } from "@/components/OfflineUnavailable";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

type OfflineGateProps = {
  children: ReactNode;
  title?: string;
  message?: string;
};

export function OfflineGate({ children, title, message }: OfflineGateProps) {
  const { online } = useOnlineStatus();

  if (!online) {
    return <OfflineUnavailable title={title} message={message} />;
  }

  return children;
}
