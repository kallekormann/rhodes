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
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Ask failed");
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
            setError(payload.message ?? "Ask generation failed");
          }
        }
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
