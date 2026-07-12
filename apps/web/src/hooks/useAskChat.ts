"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AskMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type AskContextMatch = {
  title: string;
  page_ref: number | null;
  origin_type: string;
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
  const [error, setError] = useState<string | null>(null);
  const [contextMatches, setContextMatches] = useState<AskContextMatch[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setPending(false);
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

      setMessages(nextMessages);
      setPending(true);
      setError(null);
      setContextMatches([]);

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
        return;
      }

      if (!response.body) {
        setError("Ask stream unavailable");
        setPending(false);
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
          };

          if (payload.type === "context" && Array.isArray(payload.matches)) {
            setContextMatches(payload.matches);
          }

          if (payload.type === "token" && payload.token) {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantId
                  ? { ...message, content: message.content + payload.token }
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
      }

      setPending(false);
    },
    [messages, pending, workspaceId],
  );

  return {
    messages,
    pending,
    error,
    contextMatches,
    sendMessage,
    reset,
  };
}
