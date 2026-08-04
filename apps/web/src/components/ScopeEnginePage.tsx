"use client";

import dynamic from "next/dynamic";
import { LoaderState } from "@/components/Loader";

/**
 * Client-only mount for Kanban / Calendar / etc.
 * Avoids SSR Suspense from `dynamic(..., { ssr: false })` engines hydrating
 * against a server-rendered documents list (or empty Suspense boundary).
 */
const DocumentsView = dynamic(
  () =>
    import("@/views/DocumentsView").then((m) => ({ default: m.DocumentsView })),
  {
    ssr: false,
    loading: () => <LoaderState label="Loading…" align="fill" />,
  },
);

export function ScopeEnginePage() {
  return <DocumentsView />;
}
