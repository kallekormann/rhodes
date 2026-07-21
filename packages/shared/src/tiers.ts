export type BillingTier = "free" | "basic" | "pro" | "team";

/** Subscription-tier feature identifiers (Phase 11 billing gates). */
export type TierFeature =
  | "personal_scopes.create"
  | "team_scopes.create"
  | "library.upload"
  | "library.max_file_mb"
  | "library.allowed_file_types"
  | "templates.create"
  | "ask.chat"
  | "properties.manage"
  | "scope_views.additional";

/** App surfaces that can be gated per tier in future phases. */
export type GatedView =
  | "editor"
  | "documents"
  | "templates"
  | "library"
  | "settings"
  | "sticker-sheet";

export type TierLimits = {
  personalScopes: number;
  teamScopes: number;
  libraryStorageMb: number;
  libraryMaxFileMb: number;
  libraryAllowedFileTypes: string[];
  askMessagesPerDay: number;
  insightDebounceMs: number;
  versionHistoryRetention: number;
  maxAdditionalScopeViews: number;
  gatedViews: readonly GatedView[];
};

export const TIER_LIMITS: Record<BillingTier, TierLimits> = {
  free: {
    personalScopes: 1,
    teamScopes: 0,
    libraryStorageMb: 100,
    libraryMaxFileMb: 2,
    libraryAllowedFileTypes: ["txt", "md", "docx"],
    askMessagesPerDay: 20,
    insightDebounceMs: 10_000,
    versionHistoryRetention: 10,
    maxAdditionalScopeViews: 1,
    gatedViews: ["editor", "documents", "templates", "library", "settings"],
  },
  basic: {
    personalScopes: 5,
    teamScopes: 0,
    libraryStorageMb: 1_024,
    libraryMaxFileMb: 5,
    libraryAllowedFileTypes: ["txt", "md", "docx", "pdf", "epub"],
    askMessagesPerDay: 100,
    insightDebounceMs: 5_000,
    versionHistoryRetention: 25,
    maxAdditionalScopeViews: 3,
    gatedViews: ["editor", "documents", "templates", "library", "settings"],
  },
  pro: {
    personalScopes: Number.POSITIVE_INFINITY,
    teamScopes: 3,
    libraryStorageMb: 5_120,
    libraryMaxFileMb: 10,
    libraryAllowedFileTypes: ["txt", "md", "docx", "pdf", "ppt", "epub"],
    askMessagesPerDay: Number.POSITIVE_INFINITY,
    insightDebounceMs: 3_000,
    versionHistoryRetention: 50,
    maxAdditionalScopeViews: 5,
    gatedViews: ["editor", "documents", "templates", "library", "settings"],
  },
  team: {
    personalScopes: Number.POSITIVE_INFINITY,
    teamScopes: Number.POSITIVE_INFINITY,
    libraryStorageMb: 51_200,
    libraryMaxFileMb: 30,
    libraryAllowedFileTypes: ["txt", "md", "docx", "pdf", "ppt", "epub"],
    askMessagesPerDay: Number.POSITIVE_INFINITY,
    insightDebounceMs: 3_000,
    versionHistoryRetention: 100,
    maxAdditionalScopeViews: 5,
    gatedViews: ["editor", "documents", "templates", "library", "settings"],
  },
};

function readEnvMb(key: string, fallback: number): number {
  const env =
    typeof globalThis !== "undefined" &&
    "process" in globalThis
      ? (globalThis as { process?: { env?: Record<string, string | undefined> } })
          .process?.env
      : undefined;
  const raw = env?.[key];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

/** Code defaults with optional per-tier env overrides (server-side). */
export function resolveTierLimits(tier: BillingTier): TierLimits {
  const base = TIER_LIMITS[tier];
  const suffix = tier.toUpperCase();
  return {
    ...base,
    libraryStorageMb: readEnvMb(
      `RHODES_LIBRARY_STORAGE_MB_${suffix}`,
      base.libraryStorageMb,
    ),
    libraryMaxFileMb: readEnvMb(
      `RHODES_LIBRARY_MAX_FILE_MB_${suffix}`,
      base.libraryMaxFileMb,
    ),
  };
}

export function getTierLimits(tier: BillingTier): TierLimits {
  return resolveTierLimits(tier);
}

export function tierAllowsView(tier: BillingTier, view: GatedView): boolean {
  return TIER_LIMITS[tier].gatedViews.includes(view);
}

export function tierAllowsFeature(tier: BillingTier, feature: TierFeature): boolean {
  switch (feature) {
    case "personal_scopes.create":
      return TIER_LIMITS[tier].personalScopes > TIER_LIMITS.free.personalScopes;
    case "team_scopes.create":
      return TIER_LIMITS[tier].teamScopes > 0;
    case "library.upload":
      return true;
    case "templates.create":
      return tier !== "free";
    case "ask.chat":
      return true;
    case "properties.manage":
      return tier !== "free";
    case "scope_views.additional":
      return TIER_LIMITS[tier].maxAdditionalScopeViews > 0;
    case "library.max_file_mb":
    case "library.allowed_file_types":
      return true;
    default:
      return false;
  }
}

export function tierFeatureLimit(
  tier: BillingTier,
  feature: TierFeature,
): number | string[] {
  const limits = getTierLimits(tier);
  switch (feature) {
    case "personal_scopes.create":
      return limits.personalScopes;
    case "team_scopes.create":
      return limits.teamScopes;
    case "library.max_file_mb":
      return limits.libraryMaxFileMb;
    case "library.allowed_file_types":
      return limits.libraryAllowedFileTypes;
    case "ask.chat":
      return limits.askMessagesPerDay;
    case "scope_views.additional":
      return limits.maxAdditionalScopeViews;
    default:
      return 0;
  }
}

export function tierVersionHistoryRetention(tier: BillingTier): number {
  return getTierLimits(tier).versionHistoryRetention;
}

export function libraryStorageLimitBytes(tier: BillingTier): number {
  return getTierLimits(tier).libraryStorageMb * 1024 * 1024;
}

export function libraryMaxFileBytes(tier: BillingTier): number {
  return getTierLimits(tier).libraryMaxFileMb * 1024 * 1024;
}
