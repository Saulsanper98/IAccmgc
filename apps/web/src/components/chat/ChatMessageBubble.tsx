"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, Citation } from "@/lib/chat-types";
import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import { CitationChips } from "./CitationCards";
import { AssistantMessageFooter } from "./AssistantMessageFooter";
import { ValidatedQaBadge } from "./ValidatedQaBadge";
import { UserMessageActions } from "./MessageActions";
import { ChatPhaseStepper, RagProgressIndicator } from "./ChatPhaseStepper";
import { formatRelativeTime, type RegenerateMode } from "@/lib/format";
import { useLazyMount } from "@/hooks/useLazyMount";
import clsx from "clsx";

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  isPending?: boolean;
  pendingStatus?: string | null;
  statusPhase?: string | null;
  chunksFound?: number | null;
  showCitations?: boolean;
  highlightedCitation?: number | null;
  onCitationClick?: (index: number) => void;
  onRegenerate?: (mode?: RegenerateMode) => void;
  onEditUser?: (content: string) => void;
  onRetryUser?: () => void;
  showRetryUser?: boolean;
  showDisclaimer?: boolean;
  wikiUrl?: string | null;
  isLastInThread?: boolean;
  conversationId?: string;
}

export function ChatMessageBubble({
  message,
  isStreaming,
  isPending,
  pendingStatus,
  statusPhase,
  chunksFound,
  showCitations = true,
  highlightedCitation,
  onCitationClick,
  onRegenerate,
  onEditUser,
  onRetryUser,
  showRetryUser,
  showDisclaimer,
  wikiUrl,
  isLastInThread,
  conversationId,
}: ChatMessageBubbleProps) {
  const isUser = message.role === "user";
  const citations = message.citations ?? [];
  const showCitationBlock = !isUser && showCitations && citations.length > 0;
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const { ref: lazyRef, mounted: lazyMounted } = useLazyMount();
  const renderMarkdown = isStreaming || isPending || lazyMounted;

  const wikiHomeUrl =
    wikiUrl ??
    (citations[0]?.wiki_url
      ? (() => {
          try {
            return new URL(citations[0].wiki_url).origin;
          } catch {
            return null;
          }
        })()
      : null);

  const resizeEditArea = useCallback(() => {
    const el = editRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    if (editing) {
      editRef.current?.focus();
      resizeEditArea();
    }
  }, [editing, resizeEditArea]);

  useEffect(() => {
    if (!editing) setEditValue(message.content);
  }, [message.content, editing]);

  function handleResendEdit() {
    const trimmed = editValue.trim();
    if (!trimmed || !onEditUser) return;
    setEditing(false);
    onEditUser(trimmed);
  }

  return (
    <div
      id={message.id !== "streaming" ? `msg-${message.id}` : undefined}
      className={clsx("group w-full scroll-mt-24", isUser && !editing ? "flex justify-end" : "")}
    >
      <div
        className={clsx(
          "min-w-0 w-full",
          isUser && !editing && "max-w-[85%] ml-auto",
          isUser && editing && "max-w-2xl ml-auto",
        )}
      >
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1">
            <img src="/favicon.svg" alt="" width={14} height={14} className="rounded-sm shrink-0" aria-hidden />
            <p className="meta-caption font-medium">WikiBridge</p>
          </div>
        )}

        {isUser && editing ? (
          <div className="rounded-2xl border border-stroke-default bg-surface-1 p-4 shadow-sm">
            <p className="text-xs font-medium text-text-muted mb-3">Editar y reenviar</p>
            <textarea
              ref={editRef}
              value={editValue}
              onChange={(e) => {
                setEditValue(e.target.value);
                resizeEditArea();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleResendEdit();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setEditing(false);
                  setEditValue(message.content);
                }
              }}
              className="input-field w-full resize-none text-sm min-h-[72px] max-h-[200px] rounded-xl bg-surface-0 border-stroke-subtle focus:border-link leading-relaxed"
              rows={3}
              aria-label="Editar mensaje"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-stroke-subtle">
              <p className="meta-caption text-text-muted">
                <kbd className="px-1 py-0.5 rounded bg-surface-2 text-[10px]">Esc</kbd> cancelar ·{" "}
                <kbd className="px-1 py-0.5 rounded bg-surface-2 text-[10px]">Ctrl</kbd>
                {"+"}
                <kbd className="px-1 py-0.5 rounded bg-surface-2 text-[10px]">Enter</kbd> reenviar
              </p>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    setEditing(false);
                    setEditValue(message.content);
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary btn-sm btn-pill"
                  onClick={handleResendEdit}
                  disabled={!editValue.trim() || editValue.trim() === message.content.trim()}
                >
                  Reenviar
                </button>
              </div>
            </div>
          </div>
        ) : (
        <div
          className={clsx(
            isUser
              ? "inline-block text-left rounded-2xl rounded-br-md px-4 py-3 bg-surface-2 border border-stroke-subtle min-w-[4.5rem]"
              : "text-left px-0 py-0.5",
          )}
        >
          {isUser ? (
              <p className="message-body whitespace-pre-wrap">{message.content}</p>
          ) : (
            <>
              {isPending && !message.content && (
                <div aria-busy="true">
                  <ChatPhaseStepper currentPhase={statusPhase} statusMessage={pendingStatus} />
                  <RagProgressIndicator chunksFound={chunksFound} statusMessage={pendingStatus} />
                </div>
              )}

              {!!message.content && (
                <div ref={lazyRef}>
                  {renderMarkdown ? (
                    <MarkdownContent
                      content={message.content}
                      onCitationClick={onCitationClick}
                      citations={citations as Citation[]}
                    />
                  ) : (
                    <div className="h-16 rounded-lg bg-surface-2/60 animate-pulse" aria-hidden />
                  )}
                  {isStreaming && (
                    <span
                      className="inline-block w-0.5 h-4 ml-0.5 bg-text-secondary motion-safe:animate-pulse align-middle"
                      aria-hidden
                    />
                  )}
                </div>
              )}

              {showCitationBlock && (
                <CitationChips
                  citations={citations as Citation[]}
                  highlightedIndex={highlightedCitation}
                  onCitationClick={onCitationClick}
                  prominent
                  citedChunkIds={message.cited_chunk_ids}
                />
              )}

              {showDisclaimer && !showCitationBlock && !isStreaming && !isPending && wikiHomeUrl && (
                <p className="text-[11px] text-text-muted mt-4 opacity-70 meta-caption">
                  Verifica en las{" "}
                  <a
                    href={wikiHomeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link hover:underline"
                  >
                    fuentes de Wiki.js
                  </a>
                </p>
              )}

              {message.used_validated_qa && message.used_validated_qa.length > 0 && !isStreaming && !isPending && (
                <ValidatedQaBadge items={message.used_validated_qa} />
              )}

              {message.id && message.id !== "streaming" && !isStreaming && !isPending && (
                <AssistantMessageFooter
                  messageId={message.id}
                  content={message.content}
                  conversationId={conversationId}
                  onRegenerate={onRegenerate}
                  latencyMs={message.latency_ms}
                  model={message.model}
                />
              )}
            </>
          )}
        </div>
        )}

        {isUser && !editing && (
          <UserMessageActions
            content={message.content}
            messageId={message.id}
            conversationId={conversationId}
            onEdit={onEditUser ? () => onEditUser(message.content) : undefined}
            onStartEdit={() => {
              setEditValue(message.content);
              setEditing(true);
            }}
            onRetry={onRetryUser}
            showRetry={showRetryUser}
            isEditing={editing}
          />
        )}

        {message.created_at && !isPending && (
          <time
            className={clsx(
              "meta-caption block transition-opacity duration-150",
              isUser ? "text-right mt-1.5 opacity-50 group-hover:opacity-100" : "mt-2 opacity-60 group-hover:opacity-100",
              isLastInThread && "mb-6",
            )}
            dateTime={message.created_at}
            title={new Date(message.created_at).toLocaleString("es-ES")}
          >
            {formatRelativeTime(message.created_at)}
          </time>
        )}
      </div>
    </div>
  );
}
