"use client";

import { useCallback, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { estimateIdbStorage } from "@/lib/offline/idb-quota-monitor";
import {
  clearQuotaToastDismissed,
  installQuotaToastDevHelpers,
  QUOTA_TOAST_DISMISS_KEY,
} from "@/lib/dev/quota-toast-dev";

export const OFFLINE_QUOTA_TOAST_ID = "offline-quota-warning";

const STORAGE_SETTINGS_HREF = "/settings?mode=user&section=Storage";

function quotaToastMessage(percentUsed: number): string {
  return `Browser storage for Rhodes is almost full (${percentUsed}% used). Clear offline cache to free space on this device. Your documents on the server are unchanged.`;
}

/** Persistent toast when browser storage is nearly full. */
export function useOfflineQuotaToast() {
  const { showToast } = useApp();

  const presentQuotaToast = useCallback(
    (percentUsed: number) => {
      showToast(quotaToastMessage(percentUsed), "warning", {
        persistent: true,
        placement: "bottom-center",
        id: OFFLINE_QUOTA_TOAST_ID,
        action: {
          href: STORAGE_SETTINGS_HREF,
          label: "Open Storage settings",
        },
      });
    },
    [showToast],
  );

  useEffect(() => {
    installQuotaToastDevHelpers(() => presentQuotaToast(90));
    return () => {
      delete window.__rhodesShowQuotaToast;
    };
  }, [presentQuotaToast]);

  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    if (sessionStorage.getItem(QUOTA_TOAST_DISMISS_KEY) === "1") return;

    let cancelled = false;

    void (async () => {
      const estimate = await estimateIdbStorage();
      if (cancelled || !estimate.isHigh || estimate.ratio == null) return;

      presentQuotaToast(Math.round(estimate.ratio * 100));
    })();

    return () => {
      cancelled = true;
    };
  }, [presentQuotaToast]);
}

export { clearQuotaToastDismissed, QUOTA_TOAST_DISMISS_KEY };
