"use client";

import dynamic from "next/dynamic";
import { useApp } from "@/context/AppContext";
import { LoaderState } from "@/components/Loader";
import { DocumentsListView } from "@/views/DocumentsListView";

const engineLoading = () => <LoaderState label="Loading…" align="fill" />;

const KanbanView = dynamic(
  () => import("@/views/KanbanView").then((m) => ({ default: m.KanbanView })),
  { loading: engineLoading, ssr: false },
);
const DashboardView = dynamic(
  () =>
    import("@/views/DashboardView").then((m) => ({ default: m.DashboardView })),
  { loading: engineLoading, ssr: false },
);
const CalendarView = dynamic(
  () =>
    import("@/views/CalendarView").then((m) => ({ default: m.CalendarView })),
  { loading: engineLoading, ssr: false },
);
const MindMapView = dynamic(
  () => import("@/views/MindMapView").then((m) => ({ default: m.MindMapView })),
  { loading: engineLoading, ssr: false },
);
const KnowledgeGraphView = dynamic(
  () =>
    import("@/views/KnowledgeGraphView").then((m) => ({
      default: m.KnowledgeGraphView,
    })),
  { loading: engineLoading, ssr: false },
);
const GanttView = dynamic(
  () => import("@/views/GanttView").then((m) => ({ default: m.GanttView })),
  { loading: engineLoading, ssr: false },
);
const WikiView = dynamic(
  () => import("@/views/WikiView").then((m) => ({ default: m.WikiView })),
  { loading: engineLoading, ssr: false },
);

/**
 * Routes scope engine surfaces (Kanban, Calendar, …).
 * Engine views are client-only (`ssr: false`). The documents list is mounted
 * via DocumentsListPage / AppViewSwitch — not through this router — so it does
 * not inherit engine Suspense boundaries.
 */
export function DocumentsView() {
  const { view } = useApp();
  if (view === "kanban") {
    return <KanbanView />;
  }
  if (view === "dashboard") {
    return <DashboardView />;
  }
  if (view === "calendar") {
    return <CalendarView />;
  }
  if (view === "mindmap") {
    return <MindMapView />;
  }
  if (view === "graph") {
    return <KnowledgeGraphView />;
  }
  if (view === "gantt") {
    return <GanttView />;
  }
  if (view === "wiki") {
    return <WikiView />;
  }
  return <DocumentsListView />;
}
