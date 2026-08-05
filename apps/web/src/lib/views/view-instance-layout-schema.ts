import { z } from "zod";

/** Legacy Mind-Map layout: documentId → position. */
const mindMapLayoutV1Schema = z.record(
  z.object({ x: z.number(), y: z.number() }),
);

/** Mind-Map layout v2: tree + placeholder roots. */
const mindMapLayoutV2Schema = z
  .object({
    v: z.literal(2),
    rootId: z.string().min(1),
    nodes: z.record(
      z.object({
        x: z.number(),
        y: z.number(),
        parentId: z.string().nullable(),
        documentId: z.string().nullable(),
        side: z.enum(["left", "right"]).nullable().optional(),
      }),
    ),
  })
  .refine((layout) => layout.rootId in layout.nodes, {
    message: "rootId must exist in nodes",
  });

/** Wiki sibling display order: parent document id → ordered child ids. */
const wikiLayoutSchema = z.object({
  v: z.literal(1),
  order: z.record(z.array(z.string().min(1))),
});

/**
 * Accepts Mind-Map layout v2, Wiki order maps, legacy v1 position maps, or null.
 * Prefer v2 / Wiki before legacy v1 so structured payloads are not misread as maps.
 */
export const viewInstanceLayoutSchema = z
  .union([mindMapLayoutV2Schema, wikiLayoutSchema, mindMapLayoutV1Schema])
  .nullable();
