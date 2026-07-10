export function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = Math.max(0, now - date.getTime());
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "Updated just now";
  if (diffMin < 60) return `Updated ${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Updated ${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Updated ${diffDays}d ago`;

  return `Updated ${date.toLocaleDateString()}`;
}

export function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  return `Created ${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

export function formatDocumentMeta(createdAt: string, updatedAt: string): string {
  return `${formatCreatedAt(createdAt)} · ${formatUpdatedAt(updatedAt)}`;
}

export function getDateGroup(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfLastWeek = new Date(startOfToday);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  if (date >= startOfToday) return "Today";
  if (date >= startOfYesterday) return "Yesterday";
  if (date >= startOfLastWeek) return "Last week";
  return "Older";
}

const GROUP_ORDER = ["Today", "Yesterday", "Last week", "Older"];

export function sortDateGroups(a: string, b: string): number {
  return GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b);
}
