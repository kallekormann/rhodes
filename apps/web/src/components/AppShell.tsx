"use client";

import "@/lib/dev/client-error-log-init";

import { Suspense, useEffect } from "react";
import type { ReactNode } from "react";
import {
  AppProvider,
  useApp,
  type AppSession,
} from "@/context/AppContext";
import { AppHeader } from "@/components/AppHeader";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { AppPathMemory } from "@/components/AppPathMemory";
import { CmdKModal } from "@/components/CmdKModal";
import { GlobalAskPanel } from "@/components/GlobalAskPanel";
import { LibraryUploadHost } from "@/components/LibraryUploadHost";
import { OfflineDebugBanner } from "@/components/OfflineDebugBanner";
import { ToastContainer } from "@/components/Toast";
import { AppViewSwitch } from "@/components/AppViewSwitch";

function AppShellContent({ children }: { children: ReactNode }) {
  const { view, toasts, dismissToast, session } = useApp();
  const isEditor = view === "editor";

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    void import("@/lib/dev/offline-doc-debug").then(({ installOfflineDocDebug }) => {
      installOfflineDocDebug(session.userId);
    });
  }, [session.userId]);

  return (
    <div className={`app-shell ${isEditor ? "app-shell--editor" : ""}`}>
      <AppHeader />
      <main className="app-main">
        <AppViewSwitch>{children}</AppViewSwitch>
        <GlobalAskPanel />
      </main>
      <LibraryUploadHost />
      <OfflineDebugBanner />
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
      <Suspense fallback={null}>
        <AppPathMemory />
      </Suspense>
      <AppErrorBoundary>
        <AppShellContent>{children}</AppShellContent>
      </AppErrorBoundary>
    </AppProvider>
  );
}
