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
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { pathToView, viewToPath } from "@/lib/navigation";

export type AppView =
  | "editor"
  | "documents"
  | "templates"
  | "library"
  | "settings"
  | "sticker-sheet";
export type PanelTab = "insights" | "ask" | "properties";
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
};

type AppContextValue = {
  session: AppSession;
  view: AppView;
  setView: (view: AppView) => void;
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
  setActiveScope: (scopeId: string) => void;
  createPersonalSpace: (name: string) => void;
  createTeamSpace: (name: string) => void;
  canCreatePersonalSpace: boolean;
  canCreateTeamSpace: boolean;
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
  const [documentTitle, setDocumentTitle] = useState("Q3 Product Spec");
  const [documentId, setDocumentId] = useState("q3-product-spec");
  const [favorites, setFavorites] = useState<Set<string>>(
    () => new Set(initialFavoriteIds),
  );
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const insightCount = 3;

  const {
    scopes,
    activeScopeId,
    loading: scopesLoading,
    setActiveScopeId,
  } = useWorkspaces(session.userId);

  const activeScope =
    scopes.find((s) => s.id === activeScopeId) ?? scopes[0] ?? FALLBACK_SCOPE;
  const allowPersonalCreate = canCreatePersonalSpace(scopes);

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
      setActiveScopeId(scopeId);
    },
    [setActiveScopeId],
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

  const createPersonalSpace = useCallback(
    (_name: string) => {
      showToast("Creating additional spaces ships in Phase 08.", "info");
    },
    [showToast],
  );

  const createTeamSpace = useCallback(
    (_name: string) => {
      showToast("Team spaces ship in Phase 08.", "info");
    },
    [showToast],
  );

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
      session,
      view,
      setView,
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
      setActiveScope,
      createPersonalSpace,
      createTeamSpace,
      canCreatePersonalSpace: allowPersonalCreate,
      canCreateTeamSpace,
      toasts,
      showToast,
      dismissToast,
    }),
    [
      session,
      view,
      setView,
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
      setActiveScope,
      createPersonalSpace,
      createTeamSpace,
      allowPersonalCreate,
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
