"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChatMessage, Citation, ConversationSummary } from "@/lib/chat-types";
import { contextualPrompts } from "@/lib/suggested-prompts";
import { useSwipeFromEdge } from "@/hooks/useSwipeFromEdge";
import { ChatInput } from "./ChatInput";
import { ChatMessages } from "./ChatMessages";
import { ChatSidebar } from "./ChatSidebar";
import { ChatHeader } from "./ChatHeader";
import { exportConversationMarkdown, friendlyError, REGENERATE_SUFFIXES, type RegenerateMode } from "@/lib/format";
import { truncateChatTitle } from "@/lib/chat-status";
import { useToast } from "@/components/ui/ToastProvider";

interface ChatWorkspaceProps {
  conversationId?: string;
  initialConversations: ConversationSummary[];
  initialMessages?: ChatMessage[];
  pageCount?: number | null;
  wikiUrl?: string | null;
}

const prefetchCache = new Map<string, ChatMessage[]>();

export function ChatWorkspace({
  conversationId,
  initialConversations,
  initialMessages = [],
  pageCount,
  wikiUrl,
}: ChatWorkspaceProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [conversations, setConversations] = useState(initialConversations);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [streamingContent, setStreamingContent] = useState<string | undefined>();
  const [streamingCitations, setStreamingCitations] = useState<Citation[] | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusPhase, setStatusPhase] = useState<string | null>(null);
  const [chunksFound, setChunksFound] = useState<number | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(conversationId);
  const [editDraft, setEditDraft] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [optimisticTitle, setOptimisticTitle] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const loadedConversationRef = useRef<string | undefined>(conversationId);
  const abortRef = useRef<AbortController | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);
  const lastFailedMessageRef = useRef<string | null>(null);
  const queryProcessedRef = useRef(false);

  useSwipeFromEdge(useCallback(() => setHistoryOpen(true), []));

  useEffect(() => {
    setActiveConversationId(conversationId);
    setOptimisticTitle(null);
  }, [conversationId]);

  useEffect(() => {
    if (conversationId === loadedConversationRef.current) {
      if (initialMessages.length > 0) {
        setMessages(initialMessages);
      }
      return;
    }
    if (!conversationId && loadedConversationRef.current && busy) return;

    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;

    loadedConversationRef.current = conversationId;

    if (!conversationId) {
      setMessages([]);
      setStreamingContent(undefined);
      setStreamingCitations(undefined);
      setError(null);
      setStatusMessage(null);
      setStatusPhase(null);
      setChunksFound(null);
      return;
    }

    const cached = prefetchCache.get(conversationId);
    if (cached) {
      setMessages(cached);
      setLoadingMessages(false);
    } else {
      setLoadingMessages(true);
    }
    setError(null);
    setStatusMessage(null);
    setStreamingContent(undefined);
    setStreamingCitations(undefined);

    fetch(`/api/chat/conversations/${conversationId}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("No se pudo cargar la conversación");
        return res.json();
      })
      .then((data) => {
        const loaded = data.messages ?? [];
        prefetchCache.set(conversationId, loaded);
        setMessages(loaded);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setMessages(initialMessages);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingMessages(false);
      });

    return () => controller.abort();
  }, [conversationId, initialMessages, busy]);

  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  useEffect(() => {
    function onOffline() {
      setError("Sin conexión. Comprueba tu red.");
    }
    window.addEventListener("offline", onOffline);
    return () => window.removeEventListener("offline", onOffline);
  }, []);

  const refreshConversations = useCallback(async () => {
    const response = await fetch("/api/chat/conversations");
    if (response.ok) {
      const data = await response.json();
      setConversations(data.items ?? []);
    }
  }, []);

  const prefetchConversation = useCallback((id: string) => {
    if (prefetchCache.has(id) || id === activeConversationId) return;
    void fetch(`/api/chat/conversations/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.messages) prefetchCache.set(id, data.messages);
      })
      .catch(() => {});
  }, [activeConversationId]);

  const storedTitle = conversations.find((c) => c.id === activeConversationId)?.title;
  const activeTitle =
    storedTitle && storedTitle !== "Nueva conversación"
      ? storedTitle
      : optimisticTitle ?? storedTitle ?? undefined;

  function handleNewChat() {
    abortRef.current?.abort();
    loadAbortRef.current?.abort();
    setHistoryOpen(false);
    router.push("/chat");
  }

  async function handleDelete(id: string) {
    await fetch(`/api/chat/conversations/${id}`, { method: "DELETE" });
    prefetchCache.delete(id);
    await refreshConversations();
    toast("Conversación eliminada", "info");
    if (activeConversationId === id) {
      router.push("/chat");
    }
  }

  async function handleRename(id: string, title: string) {
    const response = await fetch(`/api/chat/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (response.ok) {
      await refreshConversations();
      toast("Conversación renombrada", "success");
    }
  }

  function handleStop() {
    abortRef.current?.abort();
    setBusy(false);
    setStatusMessage(null);
    setStatusPhase(null);
    setChunksFound(null);
    toast("Generación cancelada", "info");
  }

  function optimisticSidebarUpdate(convId: string, content: string) {
    const now = new Date().toISOString();
    const title = truncateChatTitle(content);
    setConversations((prev) => {
      const existing = prev.find((c) => c.id === convId);
      if (existing) {
        return [
          { ...existing, title, updated_at: now },
          ...prev.filter((c) => c.id !== convId),
        ];
      }
      return [
        { id: convId, title, created_at: now, updated_at: now },
        ...prev,
      ];
    });
  }

  async function handleSend(content: string) {
    let convId = activeConversationId ?? conversationId;

    if (!convId) {
      const createRes = await fetch("/api/chat/conversations", { method: "POST" });
      if (!createRes.ok) {
        setError("No se pudo crear la conversación");
        return;
      }
      const created = await createRes.json();
      convId = created.id as string;
      setActiveConversationId(convId);
      loadedConversationRef.current = convId;
      window.history.replaceState(null, "", `/chat/${convId}`);
    }

    optimisticSidebarUpdate(convId, content);

    const optimisticUser: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };

    setBusy(true);
    setError(null);
    setStatusMessage("Preparando consulta…");
    setStatusPhase("started");
    setChunksFound(null);
    setStreamingContent(undefined);
    setStreamingCitations(undefined);
    setEditDraft("");
    setMessages((prev) => [...prev, optimisticUser]);

    const currentTitle = conversations.find((c) => c.id === convId)?.title;
    if (!currentTitle || currentTitle === "Nueva conversación") {
      setOptimisticTitle(truncateChatTitle(content));
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`/api/chat/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const detail = response.ok ? "Sin cuerpo de respuesta" : await response.text();
        throw new Error(friendlyError(detail));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";
      let citations: Citation[] = [];
      let citedChunkIds: string[] = [];
      let assistantId = "";
      let latencyMs: number | null = null;
      let model: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          if (!part.trim()) continue;
          const lines = part.split("\n");
          let event = "message";
          let data = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) event = line.slice(7).trim();
            if (line.startsWith("data: ")) data = line.slice(6);
          }
          if (!data) continue;

          const payload = JSON.parse(data) as Record<string, unknown>;
          if (event === "token") {
            assistantContent += (payload.content as string) ?? "";
            setStreamingContent(assistantContent);
            setStatusMessage(null);
            setStatusPhase("generating");
          } else if (event === "status") {
            setStatusMessage((payload.message as string) ?? null);
            setStatusPhase((payload.phase as string) ?? null);
            if (payload.chunks_found != null) {
              setChunksFound(payload.chunks_found as number);
            }
          } else if (event === "citations") {
            citations = (payload.citations as Citation[]) ?? [];
            citedChunkIds = (payload.cited_chunk_ids as string[]) ?? citedChunkIds;
            setStreamingCitations(citations);
          } else if (event === "done") {
            assistantId = (payload.message_id as string) ?? "";
            latencyMs = (payload.latency_ms as number) ?? null;
            model = (payload.model as string) ?? null;
            if (payload.cited_chunk_ids) {
              citedChunkIds = payload.cited_chunk_ids as string[];
            }
          } else if (event === "error") {
            throw new Error((payload.message as string) ?? "Error en el stream");
          }
        }
      }

      setStreamingContent(undefined);
      setStreamingCitations(undefined);
      setStatusMessage(null);
      setStatusPhase(null);
      setChunksFound(null);
      setMessages((prev) => {
        const next = [
          ...prev.filter((m) => m.id !== optimisticUser.id),
          optimisticUser,
          {
            id: assistantId || `assistant-${Date.now()}`,
            role: "assistant" as const,
            content: assistantContent,
            citations,
            cited_chunk_ids: citedChunkIds.length ? citedChunkIds : undefined,
            latency_ms: latencyMs,
            model,
            created_at: new Date().toISOString(),
          },
        ];
        if (convId) prefetchCache.set(convId, next);
        return next;
      });
      await refreshConversations();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setStreamingContent(undefined);
      setStatusMessage(null);
      setStatusPhase(null);
      setChunksFound(null);
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setError(msg);
      lastFailedMessageRef.current = content;
      toast(msg, "error");
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function handleRetry(content: string) {
    if (busy) return;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "user" && last.content === content) {
        return prev.slice(0, -1);
      }
      return prev;
    });
    setError(null);
    void handleSend(content);
  }

  function handleRegenerate(mode: RegenerateMode = "default") {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser && !busy) {
      setMessages((prev) => {
        const idx = prev.map((m) => m.role).lastIndexOf("assistant");
        return idx >= 0 ? prev.slice(0, idx) : prev;
      });
      let content = lastUser.content;
      if (mode !== "default") {
        content += REGENERATE_SUFFIXES[mode];
      }
      void handleSend(content);
    }
  }

  function handleEditUser(messageId: string, content: string) {
    if (busy) return;
    setEditDraft("");
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === messageId);
      if (idx < 0) return prev;
      return prev.slice(0, idx);
    });
    void handleSend(content);
  }

  function handleExport() {
    const md = exportConversationMarkdown(activeTitle ?? "Conversación", messages);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(activeTitle ?? "chat").slice(0, 40)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Conversación exportada", "success");
  }

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) setHistoryOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (queryProcessedRef.current || busy || messages.length > 0) return;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q?.trim()) {
      queryProcessedRef.current = true;
      void handleSend(q.trim());
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [busy, messages.length]);

  const isEmpty = messages.length === 0 && !busy && !loadingMessages;
  const welcomePrompts = contextualPrompts(pageCount);

  return (
    <>
      <ChatSidebar
        conversations={conversations}
        activeId={activeConversationId}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onNewChat={handleNewChat}
        onDelete={(id) => void handleDelete(id)}
        onRename={(id, title) => void handleRename(id, title)}
        onPrefetch={prefetchConversation}
      />

      <div className="chat-layout-full">
        <ChatHeader
          title={activeTitle}
          pageCount={pageCount}
          hasMessages={messages.length > 0}
          historyOpen={historyOpen}
          onToggleHistory={() => setHistoryOpen((v) => !v)}
          onExport={messages.length > 0 ? handleExport : undefined}
          loading={loadingMessages}
        />

        {error && (
          <div
            className="mx-6 mt-4 surface-card p-3 text-status-error text-sm flex items-center justify-between gap-3 z-20"
            role="alert"
            aria-live="assertive"
          >
            <span>{error}</span>
            <div className="flex gap-2 shrink-0">
              {lastFailedMessageRef.current && (
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  onClick={() => {
                    setError(null);
                    void handleSend(lastFailedMessageRef.current!);
                  }}
                >
                  Reintentar
                </button>
              )}
              <button type="button" className="btn-ghost text-xs" onClick={() => setError(null)}>
                Cerrar
              </button>
            </div>
          </div>
        )}

        <ChatMessages
          messages={messages}
          streamingContent={streamingContent}
          streamingCitations={streamingCitations}
          isSearching={busy}
          statusMessage={statusMessage}
          statusPhase={statusPhase}
          chunksFound={chunksFound}
          pageCount={pageCount}
          wikiUrl={wikiUrl}
          loadingMessages={loadingMessages}
          suggestedPrompts={welcomePrompts}
          onSuggestedPrompt={(p) => void handleSend(p)}
          onRegenerate={handleRegenerate}
          onEditUser={handleEditUser}
          onRetry={handleRetry}
          emptyStateInput={
            isEmpty ? (
              <ChatInput
                onSend={handleSend}
                onStop={handleStop}
                disabled={busy}
                busy={busy}
                initialValue={editDraft}
                conversationId={activeConversationId}
                size="large"
                centered
              />
            ) : undefined
          }
        />

        {!isEmpty && (
          <ChatInput
            onSend={handleSend}
            onStop={handleStop}
            disabled={busy}
            busy={busy}
            initialValue={editDraft}
            conversationId={activeConversationId}
          />
        )}
      </div>
    </>
  );
}
