export type SettingsMode = "user" | "scope";

export type SettingsUrlState = {
  mode: SettingsMode;
  section: string | null;
};

export function parseSettingsMode(value: string | null | undefined): SettingsMode {
  return value === "scope" ? "scope" : "user";
}

export function readSettingsUrlState(search = ""): SettingsUrlState {
  const normalized = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(normalized);
  return {
    mode: parseSettingsMode(params.get("mode")),
    section: params.get("section"),
  };
}

export function readBrowserSettingsUrlState(): SettingsUrlState {
  if (typeof window === "undefined") {
    return { mode: "user", section: null };
  }
  return readSettingsUrlState(window.location.search);
}
