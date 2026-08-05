import { DocumentsListView } from "@/views/DocumentsListView";

// Route is fully client-driven (scope/session-dependent); opt out of static
// optimization so a stale prerendered shell can never diverge from what the
// client renders on hydration.
export const dynamic = "force-dynamic";

export default function DocumentsPage() {
  return <DocumentsListView />;
}
