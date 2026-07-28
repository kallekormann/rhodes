/** TEMP (TD-006): dev-only sticky error strip — opt-in, remove before M13. */

export const DEBUG_BANNER_STORAGE_KEY = "rhodes:debug_banner";

export function isDebugBannerEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV === "production") return false;
  try {
    return window.localStorage.getItem(DEBUG_BANNER_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setDebugBannerEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) {
      window.localStorage.setItem(DEBUG_BANNER_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(DEBUG_BANNER_STORAGE_KEY);
    }
  } catch {
    /* private mode */
  }
}

export function installDebugBannerConsoleHelpers(): void {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV === "production") return;

  window.__rhodesShowDebugBanner = () => {
    setDebugBannerEnabled(true);
    window.location.reload();
  };
  window.__rhodesHideDebugBanner = () => {
    setDebugBannerEnabled(false);
    window.location.reload();
  };
}

declare global {
  interface Window {
    __rhodesShowDebugBanner?: () => void;
    __rhodesHideDebugBanner?: () => void;
  }
}
