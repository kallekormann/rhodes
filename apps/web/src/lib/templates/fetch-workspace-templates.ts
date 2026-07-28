import type { TemplateFilter, TemplateRecord } from "@/hooks/useTemplates";

type CacheEntry = {
  templates: TemplateRecord[];
  fetchedAt: number;
};

const templatesCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<TemplateRecord[]>>();

function cacheKey(workspaceId: string, filter: TemplateFilter): string {
  return `${workspaceId}:${filter}`;
}

export function readCachedWorkspaceTemplates(
  workspaceId: string | null,
  filter: TemplateFilter,
): TemplateRecord[] | undefined {
  if (!workspaceId) return undefined;
  return templatesCache.get(cacheKey(workspaceId, filter))?.templates;
}

export function writeCachedWorkspaceTemplates(
  workspaceId: string,
  filter: TemplateFilter,
  templates: TemplateRecord[],
): void {
  templatesCache.set(cacheKey(workspaceId, filter), {
    templates,
    fetchedAt: Date.now(),
  });
}

export async function fetchWorkspaceTemplates(
  workspaceId: string,
  filter: TemplateFilter = "all",
): Promise<TemplateRecord[]> {
  const key = cacheKey(workspaceId, filter);
  const pending = inFlight.get(key);
  if (pending) return pending;

  const job = (async () => {
    const params = new URLSearchParams({
      workspace_id: workspaceId,
      filter,
    });
    const response = await fetch(`/app/api/templates?${params}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        typeof data.error === "string" ? data.error : "Failed to load templates",
      );
    }
    const templates = (data.templates as TemplateRecord[]) ?? [];
    writeCachedWorkspaceTemplates(workspaceId, filter, templates);
    return templates;
  })();

  inFlight.set(key, job);
  try {
    return await job;
  } finally {
    inFlight.delete(key);
  }
}
