"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ChatMessage } from "@/lib/chat-types";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { SuggestedPrompts } from "./SuggestedPrompts";
import { ScrollToBottom } from "./ScrollToBottom";
import { ChatSkeleton } from "@/components/ui/Skeleton";
import { DATE_GROUP_LABELS, getDateGroup, type RegenerateMode } from "@/lib/format";

interface ChatMessagesProps {
  messages: ChatMessage[];
  streamingContent?: string;
  streamingCitations?: ChatMessage["citations"];
  isSearching?: boolean;
  statusMessage?: string | null;
  statusPhase?: string | null;
  chunksFound?: number | null;
  pageCount?: number | null;
  onSuggestedPrompt?: (prompt: string) => void;
  onRegenerate?: (mode?: RegenerateMode) => void;
  onEditUser?: (messageId: string, content: string) => void;
  onRetry?: (content: string) => void;
  loadingMessages?: boolean;
  suggestedPrompts?: string[];
  wikiUrl?: string | null;
  emptyStateInput?: ReactNode;
}

const VIRTUAL_THRESHOLD = 100;
const ESTIMATED_ROW_HEIGHT = 120;
const OVERSCAN = 8;

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2" role="separator" aria-label={label}>
      <div className="flex-1 h-px bg-stroke-subtle" />
      <span className="text-[11px] font-medium text-text-muted shrink-0">{label}</span>
      <div className="flex-1 h-px bg-stroke-subtle" />
    </div>
  );
}

type RenderItem =
  | { type: "separator"; label: string; key: string }
  | { type: "message"; message: ChatMessage; index: number };

export function ChatMessages({
  messages,
  streamingContent,
  streamingCitations,
  isSearching,
  statusMessage,
  statusPhase,
  chunksFound,
  pageCount,
  onSuggestedPrompt,
  onRegenerate,
  onEditUser,
  onRetry,
  loadingMessages,
  suggestedPrompts,
  wikiUrl,
  emptyStateInput,
}: ChatMessagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [highlightedCitation, setHighlightedCitation] = useState<number | null>(null);
  const [completionAnnounce, setCompletionAnnounce] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const userAtBottomRef = useRef(true);
  const wasStreamingRef = useRef(false);

  const showWelcome = messages.length === 0 && !isSearching && !streamingContent && !loadingMessages;
  const showStreamingBlock = isSearching || !!streamingContent;
  const isPending = isSearching && !streamingContent;
  const isStreaming = !!streamingContent;
  const useVirtual = messages.length >= VIRTUAL_THRESHOLD && !showStreamingBlock;

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    userAtBottomRef.current = true;
    setShowScrollBtn(false);
  }, []);

  useEffect(() => {
    if (userAtBottomRef.current && !useVirtual) {
      scrollToBottom(false);
    }
  }, [messages, streamingContent, isSearching, statusMessage, scrollToBottom, useVirtual]);

  useEffect(() => {
    if (streamingContent) wasStreamingRef.current = true;
    if (!isSearching && wasStreamingRef.current) {
      setCompletionAnnounce(true);
      wasStreamingRef.current = false;
      const t = setTimeout(() => setCompletionAnnounce(false), 1500);
      return () => clearTimeout(t);
    }
  }, [isSearching, streamingContent]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onScroll() {
      if (!el) return;
      setScrollTop(el.scrollTop);
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const atBottom = distanceFromBottom < 80;
      userAtBottomRef.current = atBottom;
      setShowScrollBtn(!atBottom && (isSearching || !!streamingContent));
    }

    function onResize() {
      if (el) setViewportHeight(el.clientHeight);
    }

    onResize();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [isSearching, streamingContent]);

  const messagesWithSeparators = useMemo(() => {
    const items: RenderItem[] = [];
    let lastGroup: ReturnType<typeof getDateGroup> | null = null;

    messages.forEach((message, index) => {
      if (message.created_at) {
        const group = getDateGroup(message.created_at);
        if (group !== lastGroup) {
          items.push({ type: "separator", label: DATE_GROUP_LABELS[group], key: `sep-${group}-${message.id}` });
          lastGroup = group;
        }
      }
      items.push({ type: "message", message, index });
    });

    return items;
  }, [messages]);

  const virtualWindow = useMemo(() => {
    if (!useVirtual) return { start: 0, end: messagesWithSeparators.length };
    const startIdx = Math.max(0, Math.floor(scrollTop / ESTIMATED_ROW_HEIGHT) - OVERSCAN);
    const visible = Math.ceil(viewportHeight / ESTIMATED_ROW_HEIGHT) + OVERSCAN * 2;
    const endIdx = Math.min(messagesWithSeparators.length, startIdx + visible);
    return { start: startIdx, end: endIdx };
  }, [useVirtual, scrollTop, viewportHeight, messagesWithSeparators.length]);

  const topSpacer = virtualWindow.start * ESTIMATED_ROW_HEIGHT;
  const bottomSpacer = (messagesWithSeparators.length - virtualWindow.end) * ESTIMATED_ROW_HEIGHT;
  const visibleItems = useVirtual
    ? messagesWithSeparators.slice(virtualWindow.start, virtualWindow.end)
    : messagesWithSeparators;

  function handleCitationClick(index: number) {
    setHighlightedCitation(index);
    const el = document.getElementById(`citation-${index}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setHighlightedCitation(null), 2000);
  }

  function renderMessageItem(item: Extract<RenderItem, { type: "message" }>) {
    const { message, index: i } = item;
    const isLast = i === messages.length - 1;
    const isLastUser = isLast && message.role === "user";
    const isLastAssistant = isLast && message.role === "assistant" && !showStreamingBlock;
    const isLastInThread = isLast && !showStreamingBlock;

    return (
      <ChatMessageBubble
        key={message.id}
        message={message}
        highlightedCitation={highlightedCitation}
        onCitationClick={handleCitationClick}
        showDisclaimer={isLastAssistant}
        wikiUrl={wikiUrl}
        isLastInThread={isLastInThread}
        onRegenerate={message.role === "assistant" && isLastAssistant ? onRegenerate : undefined}
        onEditUser={message.role === "user" ? (content) => onEditUser?.(message.id, content) : undefined}
        onRetryUser={isLastUser && onRetry ? () => onRetry(message.content) : undefined}
        showRetryUser={isLastUser && !isSearching}
      />
    );
  }

  if (loadingMessages) {
    return (
      <div className="flex-1 overflow-y-auto py-8 min-h-0 w-full">
        <div className="chat-content-column px-4 md:px-6">
          <ChatSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto overflow-x-hidden pt-8 pb-4 relative min-h-0 w-full"
    >
      <div className="chat-content-column space-y-10 px-4 md:px-6">
        {showWelcome && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <h2 className="text-2xl font-semibold tracking-tight">¿Qué quieres saber?</h2>
            <p className="text-text-secondary text-sm mt-2 leading-relaxed">
              Respuestas con citas desde{" "}
              {pageCount != null ? (
                <>
                  <Link href="/admin" className="text-link hover:underline">
                    {pageCount} páginas
                  </Link>{" "}
                  indexadas
                </>
              ) : (
                "tu wiki"
              )}
              {wikiUrl ? " de Wiki.js" : ""}.
            </p>
            {emptyStateInput && <div className="w-full max-w-2xl mt-6">{emptyStateInput}</div>}
            {onSuggestedPrompt && (
              <SuggestedPrompts
                onSelect={onSuggestedPrompt}
                disabled={isSearching}
                prompts={suggestedPrompts}
                categorized
              />
            )}
          </div>
        )}

        {useVirtual && topSpacer > 0 && <div aria-hidden style={{ height: topSpacer }} />}

        {visibleItems.map((item) => {
          if (item.type === "separator") {
            return <DateSeparator key={item.key} label={item.label} />;
          }
          return renderMessageItem(item);
        })}

        {useVirtual && bottomSpacer > 0 && <div aria-hidden style={{ height: bottomSpacer }} />}

        {showStreamingBlock && (
          <ChatMessageBubble
            message={{
              id: "streaming",
              role: "assistant",
              content: streamingContent ?? "",
              citations: streamingCitations,
            }}
            isPending={isPending}
            pendingStatus={statusMessage}
            statusPhase={statusPhase}
            chunksFound={chunksFound}
            isStreaming={isStreaming}
            highlightedCitation={highlightedCitation}
            showCitations={!!streamingCitations?.length}
            onCitationClick={handleCitationClick}
            wikiUrl={wikiUrl}
            isLastInThread
          />
        )}

        <ScrollToBottom
          visible={showScrollBtn}
          onClick={() => scrollToBottom()}
          streaming={isStreaming}
        />
        <div ref={bottomRef} />

        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {completionAnnounce ? "Respuesta completada." : ""}
        </div>
      </div>
    </div>
  );
}
