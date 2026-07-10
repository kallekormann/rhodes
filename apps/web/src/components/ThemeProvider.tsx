"use client";

import { useEffect } from "react";

const THEME_MODE_STORAGE_KEY = "rhodes-theme-mode";

function resolveTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const mode = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
  if (mode === "dark" || mode === "light") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      root.setAttribute("data-theme", resolveTheme());
    };

    apply();

    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_MODE_STORAGE_KEY) apply();
    };

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onMedia = () => {
      const mode = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
      if (mode === "system" || !mode) apply();
    };

    window.addEventListener("storage", onStorage);
    media.addEventListener("change", onMedia);
    return () => {
      window.removeEventListener("storage", onStorage);
      media.removeEventListener("change", onMedia);
    };
  }, []);

  return <>{children}</>;
}

export { resolveTheme, THEME_MODE_STORAGE_KEY };
