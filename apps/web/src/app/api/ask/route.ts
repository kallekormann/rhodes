import { NextResponse } from "next/server";
import { z } from "zod";
import {
  askSystemPrompt,
  askUserPrompt,
  createOllamaClient,
  retrieveWorkspaceKnowledge,
  type KnowledgeMatch,
} from "@rhodes/ai";
import { OLLAMA_CHAT_MODEL, OLLAMA_FAST_MODEL } from "@rhodes/shared/constants";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { createClient } from "@/lib/supabase/server";

const askSchema = z.object({
  workspace_id: z.string().uuid(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      }),
    )
    .min(1)
    .max(40),
});

function formatSse(data: Record<string, unknown>) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = askSchema.safeParse(body);

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

  const lastUserMessage = [...parsed.data.messages]
    .reverse()
    .find((message) => message.role === "user");

  if (!lastUserMessage) {
    return withSecurityHeaders(
      NextResponse.json({ error: "A user message is required" }, { status: 400 }),
    );
  }

  let matches: KnowledgeMatch[] = [];
  try {
    matches = await retrieveWorkspaceKnowledge({
      workspaceId: parsed.data.workspace_id,
      queryText: lastUserMessage.content,
      matchCount: 10,
      matchThreshold: 0.68,
    });
  } catch (error) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Workspace retrieval failed",
        },
        { status: 503 },
      ),
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(formatSse(payload)));
      };

      try {
        send({
          type: "context",
          matches: matches.slice(0, 6).map((match) => ({
            title: match.title,
            page_ref: match.page_ref,
            origin_type: match.origin_type,
          })),
        });

        if (matches.length === 0) {
          send({
            type: "token",
            token:
              "I don't have that in this workspace. Try uploading sources to your library or writing more in related documents.",
          });
          send({ type: "done" });
          controller.close();
          return;
        }

        const ollama = createOllamaClient();
        const prompt = `${askSystemPrompt()}\n\n${askUserPrompt({
          question: lastUserMessage.content,
          matches,
        })}`;

        let streamed = false;
        let lastError: Error | null = null;

        for (const model of [OLLAMA_CHAT_MODEL, OLLAMA_FAST_MODEL]) {
          try {
            for await (const token of ollama.streamGenerate(prompt, model)) {
              streamed = true;
              send({ type: "token", token });
            }
            lastError = null;
            break;
          } catch (error) {
            lastError =
              error instanceof Error ? error : new Error("Ask generation failed");
            const missingModel =
              lastError.message.includes("404") ||
              lastError.message.toLowerCase().includes("not found");
            if (!missingModel || model === OLLAMA_FAST_MODEL) {
              throw lastError;
            }
          }
        }

        if (lastError) {
          throw lastError;
        }

        if (!streamed) {
          throw new Error("Ask generation returned no tokens");
        }

        send({ type: "done" });
        controller.close();
      } catch (error) {
        send({
          type: "error",
          message:
            error instanceof Error ? error.message : "Ask generation failed",
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
