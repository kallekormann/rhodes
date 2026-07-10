import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { initialFavoriteIds } from "../data/documents";
import {
  canCreatePersonalSpace,
  canCreateTeamSpace,
  createScopeId,
  defaultScopeId,
  initialScopes,
  type Scope,
} from "../data/scopes";

export type AppView =
  | "editor"
  | "documents"
  | "templates"
  | "library"
  | "settings"
  | "sticker-sheet";
export type PanelTab = "insights" | "ask" | "properties";
export type Theme = "light" | "dark";
export type ToastVariant = "success" | "error" | "info";

export type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type AppContextValue = {
  view: AppView;
  setView: (view: AppView) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
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

export function AppProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<AppView>("editor");
  const [theme, setTheme] = useState<Theme>("light");
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
  const [scopes, setScopes] = useState<Scope[]>(() => [...initialScopes]);
  const [activeScopeId, setActiveScopeId] = useState(defaultScopeId);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const insightCount = 3;

  const activeScope = scopes.find((s) => s.id === activeScopeId) ?? scopes[0];
  const allowPersonalCreate = canCreatePersonalSpace(scopes);

  const setActiveScope = useCallback((scopeId: string) => {
    setActiveScopeId(scopeId);
  }, []);

  const createPersonalSpace = useCallback((name: string) => {
    setScopes((prev) => {
      if (!canCreatePersonalSpace(prev)) return prev;
      const newScope: Scope = {
        id: createScopeId("private"),
        name,
        type: "private",
        role: "owner",
      };
      setActiveScopeId(newScope.id);
      return [...prev, newScope];
    });
  }, []);

  const createTeamSpace = useCallback((name: string) => {
    if (!canCreateTeamSpace) return;
    const newScope: Scope = {
      id: createScopeId("team"),
      name,
      type: "team",
      role: "owner",
    };
    setScopes((prev) => [...prev, newScope]);
    setActiveScopeId(newScope.id);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

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

  const applyTheme = useCallback((next: Theme) => {
    setTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
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

  const value = useMemo(
    () => ({
      view,
      setView,
      theme,
      setTheme: applyTheme,
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
      view,
      theme,
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
      setActiveScope,
      createPersonalSpace,
      createTeamSpace,
      allowPersonalCreate,
      toasts,
      showToast,
      dismissToast,
      toggleTheme,
      applyTheme,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
