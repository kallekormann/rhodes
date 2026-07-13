"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import { useDocuments } from "@/hooks/useDocuments";
import { buildFeatureGates } from "@/lib/features/gates";
import { canWriteInScope } from "@/lib/workspaces/permissions";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { pathToView, viewToPath } from "@/lib/navigation";

export type AppView =
  | "editor"
  | "documents"
  | "templates"
  | "library"
  | "settings"
  | "sticker-sheet";
export type PanelTab = "insights" | "ask" | "comments" | "properties";
export type Theme = "light" | "dark";
export type ThemeMode = Theme | "system";
export type ToastVariant = "success" | "error" | "info";

export type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
};

export type AppSession = {
  userId: string;
  userEmail: string;
  displayName: string;
  avatarUrl: string | null;
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
  headerHidden: boolean;
  setHeaderHidden: (hidden: boolean) => void;
  insightCount: number;
  showBubble: boolean;
  setShowBubble: (show: boolean) => void;
  documentTitle: string;
  setDocumentTitle: (title: string) => void;
  documentId: string;
  setDocumentId: (id: string) => void;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  activeScope: Scope;
  scopes: Scope[];
  scopesLoading: boolean;
  workspaceId: string | null;
  ensureWorkspace: () => Promise<Scope | null>;
  refreshScopes: () => Promise<void>;
  setActiveScope: (scopeId: string) => void;
  createPersonalSpace: (name: string) => Promise<void>;
  createTeamSpace: (name: string) => Promise<void>;
  updateDisplayName: (name: string) => void;
  updateAvatarUrl: (avatarUrl: string | null) => void;
  canCreatePersonalSpace: boolean;
  canCreateTeamSpace: boolean;
  canWriteActiveScope: boolean;
  featureGates: ReturnType<typeof buildFeatureGates>;
  toasts: ToastItem[];
  showToast: (message: string, variant?: ToastVariant) => void;
  dismissToast: (id: string) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

const THEME_MODE_STORAGE_KEY = "rhodes-theme-mode";

const FALLBACK_SCOPE: Scope = {
  id: "loading",
  name: "Private",
  type: "private",
  role: "owner",
  createdAt: new Date(0).toISOString(),
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
  const [view, setViewState] = useState<AppView>(() => pathToView(pathname));
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [theme, setThemeState] = useState<Theme>("light");
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>("insights");
  const [cmdKOpen, setCmdKOpen] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [documentTitle, setDocumentTitle] = useState("Untitled Document");
  const [documentId, setDocumentId] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(
    () => new Set(initialFavoriteIds),
  );
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [sessionState, setSessionState] = useState(session);
  const insightCount = 3;

  useEffect(() => {
    setSessionState(session);
  }, [session.userId, session.userEmail, session.displayName, session.avatarUrl]);

  const {
    scopes,
    activeScopeId,
    loading: scopesLoading,
    error: scopesError,
    setActiveScopeId,
    ensureWorkspace,
    refresh: refreshScopes,
  } = useWorkspaces(session.userId);

  const activeScope =
    scopes.find((s) => s.id === activeScopeId) ?? scopes[0] ?? FALLBACK_SCOPE;
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
  const workspaceId = scopesLoading
    ? null
    : (activeScopeId ?? scopes[0]?.id ?? null);
  const { createDocument } = useDocuments(workspaceId, "recent");

  useEffect(() => {
    setViewState(pathToView(pathname));
  }, [pathname]);

  useEffect(() => {
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
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, variant }]);
      window.setTimeout(() => dismissToast(id), 4000);
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
    async (name: string, isTeam: boolean) => {
      try {
        const response = await fetch("/app/api/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            is_team_workspace: isTeam,
          }),
        });

        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
          workspace?: { id: string };
        };

        if (!response.ok) {
          showToast(body.error ?? "Couldn't create scope", "error");
          return;
        }

        await refreshScopes();

        if (body.workspace?.id) {
          setActiveScopeId(body.workspace.id);
        }

        showToast(`"${name}" scope created`, "success");
      } catch {
        showToast("Couldn't create scope", "error");
      }
    },
    [refreshScopes, setActiveScopeId, showToast],
  );

  const createPersonalSpace = useCallback(
    (name: string) => createScope(name, false),
    [createScope],
  );

  const createTeamSpace = useCallback(
    (name: string) => createScope(name, true),
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
      router.push(viewToPath[next]);
    },
    [router],
  );

  const openEditor = useCallback(
    (docId?: string) => {
      const base = viewToPath.editor;
      router.push(docId ? `${base}?doc=${encodeURIComponent(docId)}` : base);
    },
    [router],
  );

  const openTemplateEditor = useCallback(
    (templateId: string) => {
      router.push(
        `${viewToPath.editor}?template=${encodeURIComponent(templateId)}`,
      );
    },
    [router],
  );

  const createNewDocument = useCallback(async () => {
    if (!canWriteActiveScope) {
      showToast("You have read-only access in this scope", "error");
      return;
    }

    let targetWorkspaceId = workspaceId;

    if (!targetWorkspaceId) {
      if (scopesLoading) {
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

    const created = await createDocument(undefined, targetWorkspaceId);
    if (!created) {
      showToast("Couldn't create document", "error");
      return;
    }

    setDocumentId(created.id);
    setDocumentTitle(created.title);
    openEditor(created.id);
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
      headerHidden,
      setHeaderHidden,
      insightCount,
      showBubble,
      setShowBubble,
      documentTitle,
      setDocumentTitle,
      documentId,
      setDocumentId,
      isFavorite,
      toggleFavorite,
      activeScope,
      scopes,
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
      headerHidden,
      showBubble,
      documentTitle,
      documentId,
      isFavorite,
      toggleFavorite,
      activeScope,
      scopes,
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
