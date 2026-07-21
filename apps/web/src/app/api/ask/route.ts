import { NextResponse } from "next/server";
import { z } from "zod";
import {
  askSystemPrompt,
  askUserPrompt,
  ASK_NO_CONTEXT_REPLY,
  createOllamaClient,
  retrieveWorkspaceKnowledge,
  rerankKnowledgeMatches,
  type KnowledgeMatch,
} from "@rhodes/ai";
import {
  askLlmRerankEnabled,
  resolveOllamaAskFallbackModel,
  resolveOllamaAskModel,
} from "@rhodes/shared/constants";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import {
  formatToolNarration,
  formatToolResultsForPrompt,
  isToolOnlyQuestion,
  runMatchingAskTools,
} from "@/lib/ask/tools";
import { streamTextAsTokens } from "@/lib/ask/tools/stream-text";
import { buildWorkspaceAskContext } from "@/lib/ask/workspace-context";
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

async function streamOllamaTokens(
  prompt: string,
  send: (payload: Record<string, unknown>) => void,
  options?: { preferFast?: boolean },
): Promise<void> {
  const ollama = createOllamaClient();
  const chatModel = resolveOllamaAskModel();
  const fastModel = resolveOllamaAskFallbackModel();
  // Tool narrations: fast model first. Knowledge answers: chat model first.
  const models = options?.preferFast
    ? [...new Set([fastModel, chatModel])]
    : [...new Set([chatModel, fastModel])];

  let streamed = false;
  let lastError: Error | null = null;

  for (const model of models) {
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
      if (!missingModel || model === models[models.length - 1]) {
        throw lastError;
      }
    }
  }

  if (lastError) throw lastError;
  if (!streamed) throw new Error("Ask generation returned no tokens");
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

  // Pure calc: skip overview + RAG + Ollama — narrate + soft-stream for chat feel.
  const toolResults = await runMatchingAskTools(lastUserMessage.content);
  const toolOnly = isToolOnlyQuestion(lastUserMessage.content, toolResults);

  if (toolOnly) {
    const charts = toolResults
      .filter((result) => result.ok && result.chart)
      .map((result) => result.chart!);
    const reply = formatToolNarration(toolResults);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(formatSse(payload)));
        };

        try {
          send({
            type: "context",
            matches: [],
            has_workspace_overview: false,
            tools_run: toolResults.map((result) => ({
              tool: result.tool,
              ok: result.ok,
              summary: result.summary,
            })),
            fast_path: "tools",
          });
          if (charts.length > 0) {
            send({ type: "charts", charts });
          }
          await streamTextAsTokens(reply, send, {
            // Longer replies (A/B walkthrough) stream a bit faster; short math stays readable.
            delayMs: reply.length > 280 ? 10 : 16,
          });
          send({ type: "sources_used", sources: [] });
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

  const workspaceOverview = await buildWorkspaceAskContext(
    supabase,
    parsed.data.workspace_id,
  );

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
        const toolPrompt = formatToolResultsForPrompt(toolResults);
        const charts = toolResults
          .filter((result) => result.ok && result.chart)
          .map((result) => result.chart!);

        send({
          type: "context",
          matches: matches.slice(0, 6).map((match) => ({
            title: match.title,
            page_ref: match.page_ref,
            origin_type: match.origin_type,
            location_label: match.location_label,
          })),
          has_workspace_overview: workspaceOverview.hasContent,
          tools_run: toolResults.map((result) => ({
            tool: result.tool,
            ok: result.ok,
            summary: result.summary,
          })),
        });

        if (charts.length > 0) {
          send({ type: "charts", charts });
        }

        let kept = matches.slice(0, 4);
        const enableRerank = askLlmRerankEnabled();
        if (enableRerank && matches.length > 0) {
          const { kept: reranked } = await rerankKnowledgeMatches({
            question: lastUserMessage.content,
            matches: matches.slice(0, 8),
            concurrency: 3,
            onStep: async (step) => {
              send({
                type: "reasoning_step",
                label: step.label,
                verdict: step.verdict,
                origin_type: step.origin_type,
                location_label: step.location_label,
                title: step.title,
              });
            },
          });
          kept = reranked;
          send({
            type: "reasoning_done",
            kept_count: kept.length,
            skipped_count: Math.max(0, matches.slice(0, 8).length - kept.length),
          });
        } else if (matches.length > 0) {
          // No LLM rerank: still stream keep/skip so the Ask ticker shows reasoning.
          const candidates = matches.slice(0, 8);
          const keptIds = new Set(kept.map((match) => match.item_id));
          for (const match of candidates) {
            const keep = keptIds.has(match.item_id);
            send({
              type: "reasoning_step",
              label: `${match.title}${match.location_label ? ` — ${match.location_label}` : ""}`.slice(
                0,
                80,
              ),
              verdict: keep ? "keep" : "skip",
              origin_type: match.origin_type,
              location_label: match.location_label,
              title: match.title,
            });
            await new Promise((resolve) => setTimeout(resolve, 70));
          }
          send({
            type: "reasoning_done",
            kept_count: kept.length,
            skipped_count: Math.max(0, candidates.length - kept.length),
          });
        }

        const hasTools = toolResults.some((result) => result.ok);
        if (kept.length === 0 && !workspaceOverview.hasContent && !hasTools) {
          send({
            type: "token",
            token: ASK_NO_CONTEXT_REPLY,
          });
          send({ type: "sources_used", sources: [] });
          send({ type: "done" });
          controller.close();
          return;
        }

        const prompt = `${askSystemPrompt()}\n\n${askUserPrompt({
          question: lastUserMessage.content,
          matches: kept,
          workspaceOverview: workspaceOverview.overviewText,
          toolResults: toolPrompt || null,
        })}`;

        await streamOllamaTokens(prompt, send);

        const sources =
          kept.length > 0
            ? kept.map((match) => ({
                title: match.title,
                location_label: match.location_label,
                origin_type: match.origin_type,
              }))
            : hasTools
              ? []
              : workspaceOverview.hasContent
                ? [
                    {
                      title: "Workspace overview",
                      location_label: null,
                      origin_type: "overview",
                    },
                  ]
                : [];
        send({ type: "sources_used", sources });
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
