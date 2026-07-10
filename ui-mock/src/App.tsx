import { AppProvider, useApp } from "./context/AppContext";
import { AppHeader } from "./components/AppHeader";
import { CmdKModal } from "./components/CmdKModal";
import { ToastContainer } from "./components/Toast";
import { EditorView } from "./views/EditorView";
import { DocumentsView } from "./views/DocumentsView";
import { LibraryView } from "./views/LibraryView";
import { SettingsView } from "./views/SettingsView";
import { StickerSheetView } from "./views/StickerSheetView";
import { TemplatesView } from "./views/TemplatesView";

function AppContent() {
  const { view, toasts, dismissToast } = useApp();
  const isEditor = view === "editor";

  return (
    <div className={`app-shell ${isEditor ? "app-shell--editor" : ""}`}>
      <AppHeader />
      <main className="app-main">
        {view === "editor" && <EditorView />}
        {view === "documents" && <DocumentsView />}
        {view === "templates" && <TemplatesView />}
        {view === "library" && <LibraryView />}
        {view === "settings" && <SettingsView />}
        {view === "sticker-sheet" && <StickerSheetView />}
      </main>
      <CmdKModal />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
