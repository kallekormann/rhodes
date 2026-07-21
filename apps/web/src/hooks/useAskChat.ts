"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { markAskEngagedToday } from "@/lib/ask/engagement";
import {
  beginAskOllamaWork,
  endAskOllamaWork,
} from "@/lib/ollama-admission";
import type { AskReasoningStep } from "@/components/ask/AskReasoningTicker";
import type { AskSourceUsed } from "@/components/ask/AskSourcesLine";
import type { AskChartPayload } from "@/components/charts/ChartFrame";
import { isToolOnlyQuestion, runMatchingAskTools } from "@/lib/ask/tools";

export type AskMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sourcesUsed?: AskSourceUsed[];
  charts?: AskChartPayload[];
};

export type AskPendingPhase =
  | "idle"
  | "searching"
  | "reranking"
  | "generating"
  | "computing";

type AskContextMatch = {
  title: string;
  page_ref: number | null;
  origin_type: string;
  location_label?: string;
};

function toApiMessages(messages: AskMessage[]) {
  return messages
    .filter((message) => message.content.trim().length > 0)
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));
}

function parseAskError(error: unknown): string {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return "Ask failed";

  const record = error as {
    formErrors?: string[];
    fieldErrors?: Record<string, string[] | undefined>;
  };

  const fieldMessage = Object.values(record.fieldErrors ?? {})
    .flat()
    .find((value) => typeof value === "string" && value.length > 0);

  return record.formErrors?.[0] ?? fieldMessage ?? "Ask failed";
}

export function useAskChat(workspaceId: string | null) {
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [pendingPhase, setPendingPhase] = useState<AskPendingPhase>("idle");
  const [askMode, setAskMode] = useState<"tools" | "knowledge">("knowledge");
  const [reasoningSteps, setReasoningSteps] = useState<AskReasoningStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [contextMatches, setContextMatches] = useState<AskContextMatch[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setPending(false);
    setPendingPhase("idle");
    setAskMode("knowledge");
    setReasoningSteps([]);
    setError(null);
    setContextMatches([]);
  }, []);

  useEffect(() => {
    reset();
  }, [workspaceId, reset]);

  const sendMessage = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!workspaceId || !text || pending) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userMessage: AskMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text,
      };

      const assistantId = `a-${Date.now()}`;
      const nextMessages = [...messages, userMessage];
      let sourcesUsed: AskSourceUsed[] = [];
      let charts: AskChartPayload[] = [];

      setMessages(nextMessages);
      setPending(true);
      // Client-side intent preview so we don't flash "Searching your library…" for 1+1=
      const previewTools = await runMatchingAskTools(text);
      const toolOnlyPreview = isToolOnlyQuestion(text, previewTools);
      setAskMode(toolOnlyPreview ? "tools" : "knowledge");
      setPendingPhase(toolOnlyPreview ? "computing" : "searching");
      setReasoningSteps([]);
      setError(null);
      setContextMatches([]);
      markAskEngagedToday();
      if (!toolOnlyPreview) beginAskOllamaWork();

      try {
        const response = await fetch("/app/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace_id: workspaceId,
            messages: toApiMessages(nextMessages),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          setError(parseAskError(data.error));
          return;
        }

        if (!response.body) {
          setError("Ask stream unavailable");
          return;
        }

        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: "" },
        ]);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let streamError: string | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) continue;

            const payload = JSON.parse(line.slice(5).trim()) as {
              type?: string;
              token?: string;
              message?: string;
              matches?: AskContextMatch[];
              label?: string;
              verdict?: "keep" | "skip";
              sources?: AskSourceUsed[];
              charts?: AskChartPayload[];
              fast_path?: string;
            };

            if (payload.type === "context") {
              if (payload.fast_path === "tools") {
                setPendingPhase("computing");
              } else if (Array.isArray(payload.matches)) {
                setContextMatches(payload.matches);
                setPendingPhase("reranking");
              }
            }

            if (payload.type === "charts" && Array.isArray(payload.charts)) {
              charts = payload.charts;
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId
                    ? { ...message, charts: payload.charts }
                    : message,
                ),
              );
            }

            if (payload.type === "reasoning_step" && payload.label && payload.verdict) {
              setPendingPhase("reranking");
              setReasoningSteps((prev) => [
                ...prev,
                { label: payload.label!, verdict: payload.verdict! },
              ]);
            }

            if (payload.type === "reasoning_done") {
              setPendingPhase("generating");
            }

            if (payload.type === "token" && payload.token) {
              setPendingPhase("generating");
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId
                    ? { ...message, content: message.content + payload.token }
                    : message,
                ),
              );
            }

            if (payload.type === "sources_used" && Array.isArray(payload.sources)) {
              sourcesUsed = payload.sources;
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId
                    ? { ...message, sourcesUsed: payload.sources }
                    : message,
                ),
              );
            }

            if (payload.type === "error") {
              streamError = payload.message ?? "Ask generation failed";
              setError(streamError);
            }
          }
        }

        if (streamError) {
          setMessages((prev) =>
            prev.filter(
              (message) =>
                message.id !== assistantId || message.content.trim().length > 0,
            ),
          );
        } else if (sourcesUsed.length > 0 || charts.length > 0) {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    ...(sourcesUsed.length > 0 ? { sourcesUsed } : {}),
                    ...(charts.length > 0 ? { charts } : {}),
                  }
                : message,
            ),
          );
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Ask failed");
        }
      } finally {
        if (!toolOnlyPreview) endAskOllamaWork();
        setPending(false);
        setPendingPhase("idle");
        setReasoningSteps([]);
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [messages, pending, workspaceId],
  );

  return {
    messages,
    pending,
    pendingPhase,
    askMode,
    reasoningSteps,
    error,
    contextMatches,
    sendMessage,
    reset,
  };
}
