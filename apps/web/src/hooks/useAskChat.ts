"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { markAskEngagedToday } from "@/lib/ask/engagement";
import type { AskReasoningStep } from "@/components/ask/AskReasoningTicker";
import type { AskSourceUsed } from "@/components/ask/AskSourcesLine";

export type AskMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sourcesUsed?: AskSourceUsed[];
};

export type AskPendingPhase = "idle" | "searching" | "reranking" | "generating";

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
  const [reasoningStep, setReasoningStep] = useState<AskReasoningStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contextMatches, setContextMatches] = useState<AskContextMatch[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setPending(false);
    setPendingPhase("idle");
    setReasoningStep(null);
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

      setMessages(nextMessages);
      setPending(true);
      setPendingPhase("searching");
      setReasoningStep(null);
      setError(null);
      setContextMatches([]);
      markAskEngagedToday();

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
        setPending(false);
        setPendingPhase("idle");
        return;
      }

      if (!response.body) {
        setError("Ask stream unavailable");
        setPending(false);
        setPendingPhase("idle");
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
          };

          if (payload.type === "context" && Array.isArray(payload.matches)) {
            setContextMatches(payload.matches);
            setPendingPhase("reranking");
          }

          if (payload.type === "reasoning_step" && payload.label && payload.verdict) {
            setPendingPhase("reranking");
            setReasoningStep({
              label: payload.label,
              verdict: payload.verdict,
            });
          }

          if (payload.type === "reasoning_done") {
            setReasoningStep(null);
            setPendingPhase("generating");
          }

          if (payload.type === "token" && payload.token) {
            setPendingPhase("generating");
            setReasoningStep(null);
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
      } else if (sourcesUsed.length > 0) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? { ...message, sourcesUsed }
              : message,
          ),
        );
      }

      setPending(false);
      setPendingPhase("idle");
      setReasoningStep(null);
    },
    [messages, pending, workspaceId],
  );

  return {
    messages,
    pending,
    pendingPhase,
    reasoningStep,
    error,
    contextMatches,
    sendMessage,
    reset,
  };
}
