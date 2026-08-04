"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { initialFavoriteIds } from "@/data/documents";
import {
  canCreatePersonalSpace,
  canCreateTeamSpace,
  type Scope,
} from "@/data/scopes";
import type { Organization } from "@/data/organizations";
import { useCreateDocument } from "@/hooks/useCreateDocument";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import type { TemplateRecord } from "@/hooks/useTemplates";
import { useWorkspaceTemplates } from "@/hooks/useWorkspaceTemplates";
import { buildFeatureGates } from "@/lib/features/gates";
import { pathToView, scopeNavIdToAppView, viewToPath } from "@/lib/navigation";
import {
  buildEditorPath,
  isBrowserOffline,
  pushAppHistory,
  readDocIdFromBrowserLocation,
  replaceAppHistory,
  viewFromBrowserLocation,
} from "@/lib/navigation/app-path";
import { appendDevLog } from "@/lib/dev/client-error-log";
import { flushEditorBeforeNavigation } from "@/lib/offline/editor-save-flush";
import { awaitDocumentPushIfNeeded, syncIfNeeded } from "@/lib/offline/workspace-sync";
import { canWriteInScope } from "@/lib/workspaces/permissions";
import { readActiveWorkspaceId } from "@/lib/workspaces/scope";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { unlockOfflineVaults } from "@/lib/offline/offline-vault-session";
import { cleanupLegacyYjsIndexedDbDatabases } from "@/lib/offline/legacy-yjs-idb-cleanup";
import type { ScopeCompositionBody } from "@/lib/scope-composition/apply";
import type { PendingTeamInvite } from "@/components/ScopeSetupWizard";
import {
  DOCUMENTS_SCOPE_NAV_VIEW,
  isScopeSurfaceNavId,
  servableScopeNavViews,
} from "@/lib/scope-views/nav";

export type AppView =
  | "editor"
  | "documents"
  | "kanban"
  | "dashboard"
  | "calendar"
  | "gantt"
  | "mindmap"
  | "graph"
  | "templates"
  | "library"
  | "settings"
  | "sticker-sheet";
export type PanelTab = "insights" | "ask" | "comments" | "properties";
export type Theme = "light" | "dark";
export type ThemeMode = Theme | "system";
export type ToastVariant = "success" | "error" | "info" | "warning";

export type ToastPlacement = "default" | "bottom-center";

export type ToastAction = {
  href: string;
  label: string;
};

export type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
  persistent?: boolean;
  placement?: ToastPlacement;
  action?: ToastAction;
};

export type ShowToastOptions = {
  variant?: ToastVariant;
  persistent?: boolean;
  placement?: ToastPlacement;
  /** Stable id — skips duplicate toasts and enables dismiss side-effects. */
  id?: string;
  action?: ToastAction;
};

export type AppSession = {
  userId: string;
  userEmail: string;
  displayName: string;
  avatarUrl: string | null;
  personalOnboardingCompletedAt: string | null;
  orgUpgradeOnboardingPending: boolean;
  orgUpgradeOnboardingCompletedAt: string | null;
};

type AppContextValue = {
  session: AppSession;
  view: AppView;
  setView: (view: AppView) => void;
  openEditor: (documentId?: string) => void;
  openTemplateEditor: (templateId: string) => void;
  createNewDocument: () => Promise<void>;
  theme: Theme;
  themeMode: ThemeMode;
  setTheme: (theme: Theme) => void;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  panelOpen: boolean;
  panelTab: PanelTab;
  openPanel: (tab?: PanelTab) => void;
  closePanel: () => void;
  setPanelTab: (tab: PanelTab) => void;
  cmdKOpen: boolean;
  openCmdK: () => void;
  closeCmdK: () => void;
  /** Bump to open the system file picker for library upload (Cmd+K Import). */
  libraryUploadNonce: number;
  openLibraryUpload: () => void;
  headerHidden: boolean;
  setHeaderHidden: (hidden: boolean) => void;
  insightCount: number;
  showBubble: boolean;
  setShowBubble: (show: boolean) => void;
  documentTitle: string;
  setDocumentTitle: (title: string) => void;
  /** Active board/tab label for Kanban, Dashboard, etc. — shown in the header trail. */
  scopeInstanceLabel: string | null;
  setScopeInstanceLabel: (label: string | null) => void;
  documentId: string;
  setDocumentId: (id: string) => void;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  activeScope: Scope;
  activeScopeNavViewId: string;
  setActiveScopeNavViewId: (viewId: string) => void;
  scopeNavViews: ReturnType<typeof servableScopeNavViews>;
  scopes: Scope[];
  organizations: Organization[];
  scopesLoading: boolean;
  workspaceId: string | null;
  ensureWorkspace: () => Promise<Scope | null>;
  refreshScopes: () => Promise<void>;
  setActiveScope: (scopeId: string) => void;
  createPersonalSpace: (
    name: string,
    scopeComposition?: ScopeCompositionBody,
  ) => Promise<boolean>;
  createTeamSpace: (
    name: string,
    scopeComposition?: ScopeCompositionBody,
    orgId?: string | null,
    pendingInvites?: PendingTeamInvite[],
  ) => Promise<boolean>;
  updateDisplayName: (name: string) => void;
  updateAvatarUrl: (avatarUrl: string | null) => void;
  canCreatePersonalSpace: boolean;
  canCreateTeamSpace: boolean;
  canWriteActiveScope: boolean;
  featureGates: ReturnType<typeof buildFeatureGates>;
  overviewTemplates: TemplateRecord[];
  overviewTemplatesLoading: boolean;
  refreshOverviewTemplates: () => Promise<void>;
  toasts: ToastItem[];
  showToast: (
    message: string,
    variant?: ToastVariant,
    options?: Omit<ShowToastOptions, "variant">,
  ) => void;
  dismissToast: (id: string) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

const THEME_MODE_STORAGE_KEY = "rhodes-theme-mode";

const FALLBACK_SCOPE: Scope = {
  id: "loading",
  name: "Private",
  type: "private",
  role: "owner",
  orgId: null,
  createdAt: new Date(0).toISOString(),
  enabledViewsCount: 0,
  enabledViews: [],
};

function readStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

function resolveTheme(mode: ThemeMode): Theme {
  if (mode === "system") {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return mode;
}

export function AppProvider({
  session,
  children,
}: {
  session: AppSession;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const pendingViewRef = useRef<AppView | null>(null);
  const [view, setViewState] = useState<AppView>(() => pathToView(pathname));
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [theme, setThemeState] = useState<Theme>("light");
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>("insights");
  const [cmdKOpen, setCmdKOpen] = useState(false);
  const [libraryUploadNonce, setLibraryUploadNonce] = useState(0);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [documentTitle, setDocumentTitle] = useState("Untitled Document");
  const [documentId, setDocumentId] = useState("");
  const [scopeInstanceLabel, setScopeInstanceLabel] = useState<string | null>(
    null,
  );
  const [favorites, setFavorites] = useState<Set<string>>(
    () => new Set(initialFavoriteIds),
  );
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [sessionState, setSessionState] = useState(session);
  const insightCount = 3;

  useEffect(() => {
    setSessionState(session);
  }, [session.userId, session.userEmail, session.displayName, session.avatarUrl]);

  useEffect(() => {
    void unlockOfflineVaults(session.userId).catch((error) => {
      console.error("[AppContext] offline vault unlock failed", error);
    });
    void cleanupLegacyYjsIndexedDbDatabases().catch((error) => {
      console.warn("[AppContext] legacy yjs IDB cleanup failed", error);
    });
  }, [session.userId]);

  const {
    scopes,
    organizations,
    activeScopeId,
    loading: scopesLoading,
    error: scopesError,
    setActiveScopeId,
    ensureWorkspace,
    refresh: refreshScopes,
  } = useWorkspaces(session.userId);

  const activeScope =
    scopes.find((s) => s.id === activeScopeId) ?? scopes[0] ?? FALLBACK_SCOPE;
  const scopeNavViews = useMemo(
    () => servableScopeNavViews(activeScope.enabledViews ?? []),
    [activeScope.enabledViews],
  );
  const activeScopeNavViewId = useMemo(() => {
    if (isScopeSurfaceNavId(view)) return view;
    return DOCUMENTS_SCOPE_NAV_VIEW.id;
  }, [view]);
  const featureGates = useMemo(
    () =>
      buildFeatureGates({
        teamRole: activeScope.type === "team" ? activeScope.role : undefined,
      }),
    [activeScope.role, activeScope.type],
  );
  const allowTeamCreate = canCreateTeamSpace(featureGates.tier);
  const allowPersonalCreate = canCreatePersonalSpace(scopes, featureGates.tier);
  const canWriteActiveScope = canWriteInScope(activeScope);
  const workspaceId =
    activeScopeId ?? readActiveWorkspaceId() ?? scopes[0]?.id ?? null;
  const { online, onReconnect } = useOnlineStatus(workspaceId);
  const { createDocument } = useCreateDocument(
    workspaceId,
    session.userId,
    online,
  );
  const {
    templates: overviewTemplates,
    loading: overviewTemplatesLoading,
    refresh: refreshOverviewTemplates,
  } = useWorkspaceTemplates(workspaceId, "all", online);

  useEffect(() => {
    if (!workspaceId || !online) return;
    void syncIfNeeded(workspaceId);
  }, [online, workspaceId]);

  useEffect(() => {
    if (!workspaceId) return () => {};
    return onReconnect(() => {
      void syncIfNeeded(workspaceId);
    });
  }, [onReconnect, workspaceId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isBrowserOffline()) {
      setViewState(viewFromBrowserLocation());
      const docId = readDocIdFromBrowserLocation();
      if (docId) {
        setDocumentId(docId);
      }
      return;
    }

    const routeView = pathToView(pathname);
    if (pendingViewRef.current) {
      if (routeView === pendingViewRef.current) {
        pendingViewRef.current = null;
      }
      return;
    }
    setViewState(routeView);
  }, [pathname]);

  const commitAppNavigation = useCallback(
    (next: AppView, path: string, mode: "push" | "replace" = "replace") => {
      pendingViewRef.current = next;
      setViewState(next);
      if (isBrowserOffline()) {
        if (mode === "push") {
          pushAppHistory(path);
        } else {
          replaceAppHistory(path);
        }
        pendingViewRef.current = null;
        return;
      }
      replaceAppHistory(path);
      if (mode === "push") {
        router.push(path, { scroll: false });
      } else {
        router.replace(path, { scroll: false });
      }
    },
    [router],
  );

  useEffect(() => {
    const onOffline = () => {
      setViewState(viewFromBrowserLocation());
      const docId = readDocIdFromBrowserLocation();
      if (docId) {
        setDocumentId(docId);
      }
    };
    window.addEventListener("offline", onOffline);
    return () => window.removeEventListener("offline", onOffline);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setViewState(viewFromBrowserLocation());
      const docId = readDocIdFromBrowserLocation();
      if (docId) {
        setDocumentId(docId);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useLayoutEffect(() => {
    const mode = readStoredThemeMode();
    setThemeModeState(mode);
    setThemeState(resolveTheme(mode));
  }, []);

  useEffect(() => {
    const resolved = resolveTheme(themeMode);
    setThemeState(resolved);
    document.documentElement.setAttribute("data-theme", resolved);
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (themeMode !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setThemeState(resolveTheme("system"));
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [themeMode]);

  const setActiveScope = useCallback(
    (scopeId: string) => {
      if (activeScopeId === scopeId) return;
      setDocumentId("");
      setDocumentTitle("Untitled Document");
      if (pathToView(pathname) === "editor") {
        router.push("/documents");
      }
      setActiveScopeId(scopeId);
    },
    [activeScopeId, pathname, router, setActiveScopeId],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (
      id === "offline-quota-warning" &&
      typeof sessionStorage !== "undefined"
    ) {
      sessionStorage.setItem("rhodes:idb_quota_toast_dismissed", "1");
    }
  }, []);

  const showToast = useCallback(
    (
      message: string,
      variant: ToastVariant = "info",
      options?: Omit<ShowToastOptions, "variant">,
    ) => {
      const persistent = options?.persistent ?? false;
      const placement = options?.placement ?? "default";
      const id = options?.id ?? crypto.randomUUID();

      setToasts((prev) => {
        if (prev.some((t) => t.id === id)) return prev;
        return [
          ...prev,
          {
            id,
            message,
            variant,
            persistent,
            placement,
            action: options?.action,
          },
        ];
      });

      if (!persistent) {
        window.setTimeout(() => dismissToast(id), 4000);
      }
    },
    [dismissToast],
  );

  useEffect(() => {
    if (!session.userId) return;

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/app/api/invites/accept-pending", {
          method: "POST",
        });
        if (!response.ok || cancelled) return;

        const body = (await response.json().catch(() => ({}))) as {
          workspaces?: Array<{ id: string; name: string }>;
          joined?: number;
        };

        if ((body.joined ?? 0) > 0) {
          await refreshScopes();
          const joined = body.workspaces?.[body.workspaces.length - 1];
          if (joined?.id) {
            setActiveScopeId(joined.id);
            showToast(`Joined ${joined.name}`, "success");
          }
        }
      } catch {
        // Non-blocking: invite acceptance should not block app load.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session.userId, refreshScopes, setActiveScopeId, showToast]);

  const createScope = useCallback(
    async (
      name: string,
      isTeam: boolean,
      scopeComposition?: ScopeCompositionBody,
      orgId?: string | null,
      pendingInvites?: PendingTeamInvite[],
    ): Promise<boolean> => {
      try {
        const response = await fetch("/app/api/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            is_team_workspace: isTeam,
            ...(scopeComposition
              ? { scope_composition: scopeComposition }
              : {}),
            ...(orgId ? { org_id: orgId } : {}),
          }),
        });

        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
          workspace?: { id: string };
        };

        if (!response.ok) {
          const message =
            typeof body.error === "string"
              ? body.error
              : "Couldn't create scope";
          showToast(message, "error");
          return false;
        }

        await refreshScopes();

        if (body.workspace?.id) {
          setActiveScopeId(body.workspace.id);

          if (isTeam && pendingInvites?.length) {
            let sent = 0;
            let failed = 0;
            for (const invite of pendingInvites) {
              try {
                const inviteResponse = await fetch(
                  `/app/api/workspaces/${body.workspace.id}/invite`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(invite),
                  },
                );
                if (inviteResponse.ok) sent += 1;
                else failed += 1;
              } catch {
                failed += 1;
              }
            }
            if (sent > 0 && failed === 0) {
              showToast(
                `Sent ${sent} invite${sent === 1 ? "" : "s"}`,
                "success",
              );
            } else if (sent > 0) {
              showToast(`Sent ${sent} invites, ${failed} failed`, "error");
            } else if (failed > 0) {
              showToast("Couldn't send team invites", "error");
            }
          }
        }

        showToast(`"${name}" scope created`, "success");
        return true;
      } catch {
        showToast("Couldn't create scope", "error");
        return false;
      }
    },
    [refreshScopes, setActiveScopeId, showToast],
  );

  const createPersonalSpace = useCallback(
    (name: string, scopeComposition?: ScopeCompositionBody) =>
      createScope(name, false, scopeComposition),
    [createScope],
  );

  const createTeamSpace = useCallback(
    (
      name: string,
      scopeComposition?: ScopeCompositionBody,
      orgId?: string | null,
      pendingInvites?: PendingTeamInvite[],
    ) => createScope(name, true, scopeComposition, orgId, pendingInvites),
    [createScope],
  );

  const updateDisplayName = useCallback((name: string) => {
    setSessionState((prev) => ({ ...prev, displayName: name }));
  }, []);

  const updateAvatarUrl = useCallback((avatarUrl: string | null) => {
    setSessionState((prev) => ({ ...prev, avatarUrl }));
  }, []);

  useEffect(() => {
    if (view !== "editor") {
      setHeaderHidden(false);
    }
  }, [view]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdKOpen(true);
      }
      if (e.key === "Escape") {
        setCmdKOpen(false);
        setPanelOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const setView = useCallback(
    (next: AppView) => {
      const path = viewToPath[next];
      const navigate = () => {
        commitAppNavigation(next, path, "replace");
      };

      if (view === "editor" && next !== "editor") {
        const docId = documentId || readDocIdFromBrowserLocation();
        navigate();
        void flushEditorBeforeNavigation(docId);
        return;
      }

      navigate();
    },
    [commitAppNavigation, documentId, view],
  );

  useEffect(() => {
    if (!scopesLoading && isScopeSurfaceNavId(view)) {
      const stillEnabled = scopeNavViews.some((navView) => navView.id === view);
      if (!stillEnabled) {
        setView("documents");
      }
    }
  }, [scopesLoading, scopeNavViews, view, setView]);

  const setActiveScopeNavViewId = useCallback(
    (viewId: string) => {
      const next = scopeNavIdToAppView(viewId);
      if (next) setView(next);
    },
    [setView],
  );

  const openEditor = useCallback(
    (docId?: string) => {
      const path = buildEditorPath(docId);
      const targetId = docId ?? documentId;
      if (docId) {
        setDocumentId(docId);
      }
      if (isBrowserOffline()) {
        commitAppNavigation("editor", path, "push");
        if (process.env.NODE_ENV !== "production") {
          void appendDevLog("offline-open-editor", { docId, path });
        }
        return;
      }

      commitAppNavigation("editor", path, "replace");

      if (targetId && workspaceId) {
        void awaitDocumentPushIfNeeded(targetId, workspaceId);
      }
    },
    [commitAppNavigation, documentId, workspaceId],
  );

  const openTemplateEditor = useCallback(
    (templateId: string) => {
      const path = buildEditorPath(undefined, templateId);
      commitAppNavigation("editor", path, "replace");
    },
    [commitAppNavigation],
  );

  const createNewDocument = useCallback(async () => {
    if (!canWriteActiveScope) {
      showToast("You have read-only access in this scope", "error");
      return;
    }

    let targetWorkspaceId = workspaceId ?? readActiveWorkspaceId();

    if (!targetWorkspaceId) {
      if (scopesLoading && typeof navigator !== "undefined" && navigator.onLine) {
        showToast("Scope is still loading…", "info");
        return;
      }

      const scope = await ensureWorkspace();
      if (!scope) {
        showToast(
          scopesError ?? "Couldn't set up your private scope",
          "error",
        );
        return;
      }
      targetWorkspaceId = scope.id;
    }

    try {
      const created = await createDocument(undefined, targetWorkspaceId);
      setDocumentId(created.id);
      setDocumentTitle(created.title);
      openEditor(created.id);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Couldn't create document",
        "error",
      );
    }
  }, [
    canWriteActiveScope,
    workspaceId,
    scopesLoading,
    ensureWorkspace,
    scopesError,
    createDocument,
    openEditor,
    showToast,
  ]);

  const setTheme = useCallback((next: Theme) => {
    setThemeModeState(next);
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeModeState((mode) => {
      const resolved = resolveTheme(mode);
      return resolved === "light" ? "dark" : "light";
    });
  }, []);

  const openPanel = useCallback((tab: PanelTab = "insights") => {
    setPanelTab(tab);
    setPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => setPanelOpen(false), []);
  const openCmdK = useCallback(() => setCmdKOpen(true), []);
  const closeCmdK = useCallback(() => setCmdKOpen(false), []);
  const openLibraryUpload = useCallback(() => {
    setLibraryUploadNonce((n) => n + 1);
  }, []);

  const isFavorite = useCallback(
    (id: string) => favorites.has(id),
    [favorites],
  );

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      session: sessionState,
      view,
      setView,
      openEditor,
      openTemplateEditor,
      createNewDocument,
      theme,
      themeMode,
      setTheme,
      setThemeMode,
      toggleTheme,
      panelOpen,
      panelTab,
      openPanel,
      closePanel,
      setPanelTab,
      cmdKOpen,
      openCmdK,
      closeCmdK,
      libraryUploadNonce,
      openLibraryUpload,
      headerHidden,
      setHeaderHidden,
      insightCount,
      showBubble,
      setShowBubble,
      documentTitle,
      setDocumentTitle,
      scopeInstanceLabel,
      setScopeInstanceLabel,
      documentId,
      setDocumentId,
      isFavorite,
      toggleFavorite,
      activeScope,
      activeScopeNavViewId,
      setActiveScopeNavViewId,
      scopeNavViews,
      scopes,
      organizations,
      scopesLoading,
      workspaceId,
      ensureWorkspace,
      refreshScopes,
      setActiveScope,
      createPersonalSpace,
      createTeamSpace,
      updateDisplayName,
      updateAvatarUrl,
      canCreatePersonalSpace: allowPersonalCreate,
      canCreateTeamSpace: allowTeamCreate,
      canWriteActiveScope,
      featureGates,
      overviewTemplates,
      overviewTemplatesLoading,
      refreshOverviewTemplates,
      toasts,
      showToast,
      dismissToast,
    }),
    [
      sessionState,
      view,
      setView,
      openEditor,
      openTemplateEditor,
      createNewDocument,
      theme,
      themeMode,
      setTheme,
      setThemeMode,
      toggleTheme,
      panelOpen,
      panelTab,
      openPanel,
      closePanel,
      cmdKOpen,
      openCmdK,
      closeCmdK,
      libraryUploadNonce,
      openLibraryUpload,
      headerHidden,
      showBubble,
      documentTitle,
      scopeInstanceLabel,
      documentId,
      isFavorite,
      toggleFavorite,
      activeScope,
      activeScopeNavViewId,
      setActiveScopeNavViewId,
      scopeNavViews,
      scopes,
      organizations,
      scopesLoading,
      workspaceId,
      ensureWorkspace,
      refreshScopes,
      setActiveScope,
      createPersonalSpace,
      createTeamSpace,
      updateDisplayName,
      updateAvatarUrl,
      allowPersonalCreate,
      allowTeamCreate,
      canWriteActiveScope,
      featureGates,
      overviewTemplates,
      overviewTemplatesLoading,
      refreshOverviewTemplates,
      toasts,
      showToast,
      dismissToast,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
