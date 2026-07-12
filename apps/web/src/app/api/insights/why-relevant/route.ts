import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createOllamaClient,
  whyRelevantPrompt,
  type KnowledgeMatch,
} from "@rhodes/ai";
import { OLLAMA_FAST_MODEL } from "@rhodes/shared/constants";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { createClient } from "@/lib/supabase/server";

const matchSchema = z.object({
  origin_type: z.string(),
  item_id: z.string().uuid(),
  title: z.string(),
  matched_text: z.string(),
  page_ref: z.number().nullable(),
  similarity: z.number(),
});

const whyRelevantSchema = z.object({
  workspace_id: z.string().uuid(),
  query_text: z.string().min(1).max(8000),
  match: matchSchema,
});

function formatSse(data: Record<string, unknown>) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = whyRelevantSchema.safeParse(body);

  if (!parsed.success) {
    return withSecurityHeaders(
      NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }),
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const { data: allowed } = await supabase.rpc("is_workspace_member", {
    ws_id: parsed.data.workspace_id,
  });

  if (!allowed) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
  }

  const match = parsed.data.match as KnowledgeMatch;
  const fallback = match.matched_text.slice(0, 120);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(formatSse(payload)));
      };

      try {
        const ollama = createOllamaClient();
        const prompt = whyRelevantPrompt(match, parsed.data.query_text);
        let streamed = "";

        for await (const token of ollama.streamGenerate(prompt, OLLAMA_FAST_MODEL)) {
          streamed += token;
          if (streamed.length <= 120) {
            send({ type: "token", token });
          }
        }

        const text = streamed.trim().slice(0, 120) || fallback;
        send({ type: "done", text });
        controller.close();
      } catch (error) {
        send({
          type: "token",
          token: fallback,
        });
        send({
          type: "done",
          text: fallback,
          fallback: true,
          message:
            error instanceof Error ? error.message : "Why relevant generation failed",
        });
        controller.close();
      }
    },
  });

  return withSecurityHeaders(
    new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    }),
  );
}
