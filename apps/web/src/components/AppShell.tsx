"use client";

import type { ReactNode } from "react";
import {
  AppProvider,
  useApp,
  type AppSession,
} from "@/context/AppContext";
import { AppHeader } from "@/components/AppHeader";
import { CmdKModal } from "@/components/CmdKModal";
import { ToastContainer } from "@/components/Toast";

function AppShellContent({ children }: { children: ReactNode }) {
  const { view, toasts, dismissToast } = useApp();
  const isEditor = view === "editor";

  return (
    <div className={`app-shell ${isEditor ? "app-shell--editor" : ""}`}>
      <AppHeader />
      <main className="app-main">{children}</main>
      <CmdKModal />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export function AppShell({
  session,
  children,
}: {
  session: AppSession;
  children: ReactNode;
}) {
  return (
    <AppProvider session={session}>
      <AppShellContent>{children}</AppShellContent>
    </AppProvider>
  );
}
