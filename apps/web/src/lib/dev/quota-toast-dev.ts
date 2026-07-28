export const QUOTA_TOAST_DISMISS_KEY = "rhodes:idb_quota_toast_dismissed";

export function clearQuotaToastDismissed(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(QUOTA_TOAST_DISMISS_KEY);
}

export function installQuotaToastDevHelpers(showPreview: () => void): void {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV === "production") return;

  window.__rhodesShowQuotaToast = () => {
    clearQuotaToastDismissed();
    showPreview();
  };
}

declare global {
  interface Window {
    /** Dev only — preview the centered storage warning toast. */
    __rhodesShowQuotaToast?: () => void;
  }
}
