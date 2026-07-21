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
import { lockVault, unlockVault } from "@/lib/offline/ask-vault";
import {
  countUserMessages,
  deleteConversation,
  listConversations,
  loadConversationMessages,
  migrateLegacyAskThreads,
  saveConversation,
  type ConversationListItem,
  type PersistedAskMessage,
} from "@/lib/offline/conversations";
import {
  getActiveConversationId,
  setActiveConversationId,
} from "@/lib/offline/db";

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

export type AskChatView = "chat" | "history";

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

function toPersistedMessages(messages: AskMessage[]): PersistedAskMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
  }));
}

function clearTransientState(setters: {
  setPending: (v: boolean) => void;
  setPendingPhase: (v: AskPendingPhase) => void;
  setAskMode: (v: "tools" | "knowledge") => void;
  setReasoningSteps: (v: AskReasoningStep[]) => void;
  setError: (v: string | null) => void;
  setContextMatches: (v: AskContextMatch[]) => void;
}) {
  setters.setPending(false);
  setters.setPendingPhase("idle");
  setters.setAskMode("knowledge");
  setters.setReasoningSteps([]);
  setters.setError(null);
  setters.setContextMatches([]);
}

export function useAskChat(workspaceId: string | null, userId?: string | null) {
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [pendingPhase, setPendingPhase] = useState<AskPendingPhase>("idle");
  const [askMode, setAskMode] = useState<"tools" | "knowledge">("knowledge");
  const [reasoningSteps, setReasoningSteps] = useState<AskReasoningStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [contextMatches, setContextMatches] = useState<AskContextMatch[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<AskChatView>("chat");
  const [conversations, setConversations] = useState<ConversationListItem[]>(
    [],
  );
  const [activeConversationId, setActiveConversationIdState] = useState<
    string | null
  >(null);

  const abortRef = useRef<AbortController | null>(null);
  const persistTimerRef = useRef<number | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const messagesRef = useRef<AskMessage[]>([]);

  useEffect(() => {
    activeIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const refreshConversationList = useCallback(async () => {
    if (!workspaceId || !userId) {
      setConversations([]);
      return;
    }
    try {
      const rows = await listConversations(userId, workspaceId, "ask");
      setConversations(rows);
    } catch {
      setConversations([]);
    }
  }, [workspaceId, userId]);

  const resetSessionUi = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setActiveConversationIdState(null);
    activeIdRef.current = null;
    setView("chat");
    setConversations([]);
    clearTransientState({
      setPending,
      setPendingPhase,
      setAskMode,
      setReasoningSteps,
      setError,
      setContextMatches,
    });
    setHydrated(false);
  }, []);

  useEffect(() => {
    resetSessionUi();
  }, [workspaceId, userId, resetSessionUi]);

  useEffect(() => {
    if (!workspaceId || !userId) {
      setHydrated(true);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await unlockVault(userId);
        if (cancelled) return;

        const migratedId = await migrateLegacyAskThreads(userId, workspaceId);
        if (cancelled) return;

        let activeId =
          migratedId ?? (await getActiveConversationId(workspaceId, "ask"));

        if (activeId) {
          try {
            const stored = await loadConversationMessages(activeId);
            if (cancelled) return;
            if (countUserMessages(stored) === 0) {
              await deleteConversation(activeId);
              activeId = null;
              await setActiveConversationId(workspaceId, null, "ask");
            } else {
              setActiveConversationIdState(activeId);
              setMessages(
                stored.map((message) => ({
                  id: message.id,
                  role: message.role,
                  content: message.content,
                })),
              );
            }
          } catch {
            activeId = null;
            await setActiveConversationId(workspaceId, null, "ask");
          }
        }

        if (!cancelled) {
          await refreshConversationList();
        }
      } catch {
        // IndexedDB / crypto unavailable — Ask still works in-memory.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, userId, refreshConversationList]);

  useEffect(() => {
    if (!hydrated || !workspaceId || !userId || pending) return;

    const persisted = toPersistedMessages(messages);
    const userCount = countUserMessages(persisted);

    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
    }

    persistTimerRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          if (userCount === 0) {
            if (activeIdRef.current) {
              await deleteConversation(activeIdRef.current);
              await setActiveConversationId(workspaceId, null, "ask");
              setActiveConversationIdState(null);
              activeIdRef.current = null;
              await refreshConversationList();
            }
            return;
          }

          let id = activeIdRef.current;
          if (!id) {
            id = crypto.randomUUID();
            setActiveConversationIdState(id);
            activeIdRef.current = id;
            await setActiveConversationId(workspaceId, id, "ask");
          }

          await saveConversation({
            id,
            userId,
            workspaceId,
            messages: persisted,
          });
          await refreshConversationList();
        } catch {
          // Private mode / locked vault — ignore persist failures.
        }
      })();
    }, 300);

    return () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
      }
    };
  }, [
    messages,
    hydrated,
    workspaceId,
    userId,
    pending,
    refreshConversationList,
  ]);

  const discardEmptyDraft = useCallback(async () => {
    if (!workspaceId) return;
    const current = toPersistedMessages(messagesRef.current);
    if (countUserMessages(current) > 0) return;

    const id = activeIdRef.current;
    if (id) {
      try {
        await deleteConversation(id);
        await setActiveConversationId(workspaceId, null, "ask");
      } catch {
        // ignore
      }
    }
    setActiveConversationIdState(null);
    activeIdRef.current = null;
    setMessages([]);
  }, [workspaceId]);

  const openHistory = useCallback(async () => {
    abortRef.current?.abort();
    await discardEmptyDraft();
    clearTransientState({
      setPending,
      setPendingPhase,
      setAskMode,
      setReasoningSteps,
      setError,
      setContextMatches,
    });
    await refreshConversationList();
    setView("history");
  }, [discardEmptyDraft, refreshConversationList]);

  const closeHistory = useCallback(() => {
    setView("chat");
  }, []);

  const startNewChat = useCallback(async () => {
    abortRef.current?.abort();
    await discardEmptyDraft();
    clearTransientState({
      setPending,
      setPendingPhase,
      setAskMode,
      setReasoningSteps,
      setError,
      setContextMatches,
    });
    setMessages([]);
    setActiveConversationIdState(null);
    activeIdRef.current = null;
    if (workspaceId) {
      try {
        await setActiveConversationId(workspaceId, null, "ask");
      } catch {
        // ignore
      }
    }
    setView("chat");
  }, [discardEmptyDraft, workspaceId]);

  const openConversation = useCallback(
    async (conversationId: string) => {
      if (!workspaceId) return;
      abortRef.current?.abort();
      await discardEmptyDraft();
      clearTransientState({
        setPending,
        setPendingPhase,
        setAskMode,
        setReasoningSteps,
        setError,
        setContextMatches,
      });

      try {
        const stored = await loadConversationMessages(conversationId);
        setActiveConversationIdState(conversationId);
        activeIdRef.current = conversationId;
        setMessages(
          stored.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
          })),
        );
        await setActiveConversationId(workspaceId, conversationId, "ask");
        setView("chat");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not open conversation",
        );
        setView("history");
      }
    },
    [discardEmptyDraft, workspaceId],
  );

  const removeConversation = useCallback(
    async (conversationId: string) => {
      try {
        await deleteConversation(conversationId);
        if (activeIdRef.current === conversationId) {
          setActiveConversationIdState(null);
          activeIdRef.current = null;
          setMessages([]);
          if (workspaceId) {
            await setActiveConversationId(workspaceId, null, "ask");
          }
        }
        await refreshConversationList();
      } catch {
        setError("Could not delete conversation");
      }
    },
    [refreshConversationList, workspaceId],
  );

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

      setView("chat");
      setMessages(nextMessages);
      setPending(true);
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
        let generatingWatchdog: ReturnType<typeof setTimeout> | null = null;

        const armGeneratingWatchdog = () => {
          if (generatingWatchdog) clearTimeout(generatingWatchdog);
          generatingWatchdog = setTimeout(() => {
            streamError = "Answer timed out waiting for Rhodes";
            setError(streamError);
            void reader.cancel().catch(() => undefined);
            controller.abort();
          }, 120_000);
        };

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

            if (
              payload.type === "reasoning_step" &&
              payload.label &&
              payload.verdict
            ) {
              setPendingPhase("reranking");
              setReasoningSteps((prev) => [
                ...prev,
                { label: payload.label!, verdict: payload.verdict! },
              ]);
            }

            if (payload.type === "reasoning_done") {
              setPendingPhase("generating");
              armGeneratingWatchdog();
            }

            if (payload.type === "token" && payload.token) {
              if (generatingWatchdog) {
                clearTimeout(generatingWatchdog);
                generatingWatchdog = null;
              }
              setPendingPhase("generating");
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId
                    ? { ...message, content: message.content + payload.token }
                    : message,
                ),
              );
            }

            if (
              payload.type === "sources_used" &&
              Array.isArray(payload.sources)
            ) {
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

        if (generatingWatchdog) clearTimeout(generatingWatchdog);

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
        if (controller.signal.aborted) {
          setMessages((prev) =>
            prev.filter(
              (message) =>
                message.id !== assistantId || message.content.trim().length > 0,
            ),
          );
        } else {
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

  const isBlankChat =
    view === "chat" &&
    activeConversationId === null &&
    countUserMessages(toPersistedMessages(messages)) === 0;

  return {
    messages,
    pending,
    pendingPhase,
    askMode,
    reasoningSteps,
    error,
    contextMatches,
    view,
    conversations,
    activeConversationId,
    isBlankChat,
    hydrated,
    sendMessage,
    openHistory,
    closeHistory,
    startNewChat,
    openConversation,
    deleteConversation: removeConversation,
    /** Clears React Ask state; call with lockVault on logout. */
    reset: () => {
      resetSessionUi();
      lockVault();
    },
  };
}
