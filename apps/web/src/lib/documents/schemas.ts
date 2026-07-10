import { z } from "zod";

export const documentFilterSchema = z.enum(["recent", "all", "favorites"]);

export const createDocumentSchema = z.object({
  workspace_id: z.string().uuid(),
  title: z.string().min(1).max(500).optional(),
  template_id: z.string().uuid().optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.record(z.unknown()).optional(),
  content_plain: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const listDocumentsQuerySchema = z.object({
  workspace_id: z.string().uuid(),
  filter: documentFilterSchema.default("recent"),
});

export type DocumentFilter = z.infer<typeof documentFilterSchema>;
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

export const EMPTY_DOCUMENT_CONTENT = {
  type: "doc",
  content: [{ type: "paragraph" }],
} as const;
