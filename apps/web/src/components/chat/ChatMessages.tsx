"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, Citation } from "@/lib/chat-types";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { ChatSourcesPanel } from "./ChatSourcesPanel";
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
  onRegenerate?: (mode?: RegenerateMode) => void;
  onEditUser?: (messageId: string, content: string) => void;
  onRetry?: (content: string) => void;
  loadingMessages?: boolean;
  wikiUrl?: string | null;
  conversationId?: string;
}

const VIRTUAL_THRESHOLD = 100;
const DEFAULT_ROW_HEIGHT = 180;
const SEPARATOR_HEIGHT = 44;
const OVERSCAN = 6;

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2" role="separator" aria-label={label}>
      <div className="flex-1 h-px bg-stroke-subtle" />
      <span className="meta-caption font-medium shrink-0">{label}</span>
      <div className="flex-1 h-px bg-stroke-subtle" />
    </div>
  );
}

type RenderItem =
  | { type: "separator"; label: string; key: string }
  | { type: "message"; message: ChatMessage; index: number; key: string };

function itemHeight(item: RenderItem, heights: Map<string, number>): number {
  const measured = heights.get(item.key);
  if (measured != null) return measured;
  return item.type === "separator" ? SEPARATOR_HEIGHT : DEFAULT_ROW_HEIGHT;
}

export function ChatMessages({
  messages,
  streamingContent,
  streamingCitations,
  isSearching,
  statusMessage,
  statusPhase,
  chunksFound,
  onRegenerate,
  onEditUser,
  onRetry,
  loadingMessages,
  wikiUrl,
  conversationId,
}: ChatMessagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const rowHeightsRef = useRef<Map<string, number>>(new Map());
  const [, bumpHeights] = useState(0);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [highlightedCitation, setHighlightedCitation] = useState<number | null>(null);
  const [completionAnnounce, setCompletionAnnounce] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const userAtBottomRef = useRef(true);
  const wasStreamingRef = useRef(false);

  const showStreamingBlock = isSearching || !!streamingContent;
  const isPending = isSearching && !streamingContent;
  const isStreaming = !!streamingContent;
  const useVirtual = messages.length >= VIRTUAL_THRESHOLD && !showStreamingBlock;

  const panelCitations = useMemo(() => {
    const seen = new Set<string>();
    const result: Citation[] = [];
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      for (const citation of message.citations ?? []) {
        if (seen.has(citation.chunk_id)) continue;
        seen.add(citation.chunk_id);
        result.push(citation);
      }
    }
    if (streamingCitations) {
      for (const citation of streamingCitations) {
        if (seen.has(citation.chunk_id)) continue;
        seen.add(citation.chunk_id);
        result.push(citation);
      }
    }
    return result;
  }, [messages, streamingCitations]);

  const measureRow = useCallback((key: string, node: HTMLDivElement | null) => {
    if (!node) return;
    const height = node.getBoundingClientRect().height;
    if (height > 0 && rowHeightsRef.current.get(key) !== height) {
      rowHeightsRef.current.set(key, height);
      bumpHeights((v) => v + 1);
    }
  }, []);

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
      items.push({ type: "message", message, index, key: message.id });
    });

    return items;
  }, [messages]);

  const virtualWindow = useMemo(() => {
    if (!useVirtual) return { start: 0, end: messagesWithSeparators.length, topSpacer: 0, bottomSpacer: 0 };

    const heights = rowHeightsRef.current;
    let offset = 0;
    let startIdx = 0;

    for (let i = 0; i < messagesWithSeparators.length; i++) {
      const h = itemHeight(messagesWithSeparators[i], heights);
      if (offset + h > scrollTop - OVERSCAN * DEFAULT_ROW_HEIGHT) {
        startIdx = Math.max(0, i - OVERSCAN);
        break;
      }
      offset += h;
      if (i === messagesWithSeparators.length - 1) startIdx = messagesWithSeparators.length;
    }

    let topSpacer = 0;
    for (let i = 0; i < startIdx; i++) {
      topSpacer += itemHeight(messagesWithSeparators[i], heights);
    }

    let visibleHeight = 0;
    let endIdx = startIdx;
    const target = viewportHeight + OVERSCAN * DEFAULT_ROW_HEIGHT;
    for (let i = startIdx; i < messagesWithSeparators.length; i++) {
      visibleHeight += itemHeight(messagesWithSeparators[i], heights);
      endIdx = i + 1;
      if (visibleHeight >= target) break;
    }

    let bottomSpacer = 0;
    for (let i = endIdx; i < messagesWithSeparators.length; i++) {
      bottomSpacer += itemHeight(messagesWithSeparators[i], heights);
    }

    return { start: startIdx, end: endIdx, topSpacer, bottomSpacer };
  }, [useVirtual, scrollTop, viewportHeight, messagesWithSeparators]);

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
        conversationId={conversationId}
        onRegenerate={message.role === "assistant" && isLastAssistant ? onRegenerate : undefined}
        onEditUser={message.role === "user" ? (content) => onEditUser?.(message.id, content) : undefined}
        onRetryUser={isLastUser && onRetry ? () => onRetry(message.content) : undefined}
        showRetryUser={isLastUser && !isSearching}
      />
    );
  }

  function renderItem(item: RenderItem) {
    const content =
      item.type === "separator" ? (
        <DateSeparator label={item.label} />
      ) : (
        renderMessageItem(item)
      );

    if (!useVirtual) return content;

    return (
      <div key={item.key} ref={(node) => measureRow(item.key, node)}>
        {content}
      </div>
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
    <div className="flex flex-1 min-h-0 min-w-0">
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto overflow-x-hidden pt-8 pb-4 relative min-h-0 w-full"
    >
      <div
        className={`chat-content-column space-y-10 px-4 md:px-6${showScrollBtn ? " pb-16" : ""}`}
      >
        {useVirtual && virtualWindow.topSpacer > 0 && (
          <div aria-hidden style={{ height: virtualWindow.topSpacer }} />
        )}

        {visibleItems.map((item) => renderItem(item))}

        {useVirtual && virtualWindow.bottomSpacer > 0 && (
          <div aria-hidden style={{ height: virtualWindow.bottomSpacer }} />
        )}

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
            conversationId={conversationId}
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
    <ChatSourcesPanel
      citations={panelCitations}
      highlightedIndex={highlightedCitation}
      onCitationClick={handleCitationClick}
    />
    </div>
  );
}
