import { z } from "zod";

export const documentFilterSchema = z.enum([
  "recent",
  "all",
  "favorites",
  "archive",
  "shared",
]);

export const createDocumentSchema = z.object({
  id: z.string().uuid().optional(),
  workspace_id: z.string().uuid(),
  title: z.string().min(1).max(500).optional(),
  template_id: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
  content: z.record(z.unknown()).optional(),
  content_plain: z.string().optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.record(z.unknown()).optional(),
  content_plain: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  /** Optimistic concurrency — reject with 409 when server is newer. */
  expected_updated_at: z.string().datetime({ offset: true }).or(z.string().min(1)).optional(),
  /** Conflict resolution — overwrite server without OCC check. */
  force: z.boolean().optional(),
});

export const listDocumentsQuerySchema = z.object({
  workspace_id: z.string().uuid(),
  filter: documentFilterSchema.default("recent"),
  /** Title search (Cmd+K / discovery). */
  q: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).max(10_000).optional(),
  /** Pull cursor — documents with updated_at strictly after this ISO timestamp. */
  since: z.string().min(1).optional(),
  /** When false (default), list rows omit document body fields. Pass include_body=true to opt in. */
  include_body: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export type DocumentFilter = z.infer<typeof documentFilterSchema>;
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

export const EMPTY_DOCUMENT_CONTENT = {
  type: "doc",
  content: [{ type: "paragraph" }],
} as const;
