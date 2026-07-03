"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconArrowUp, IconStop } from "@/components/ui/Icons";
import clsx from "clsx";

const MAX_CHARS = 8000;
const MAX_TEXTAREA_HEIGHT = 160;
const DRAFT_KEY_PREFIX = "wikibridge-chat-draft";

function draftKey(conversationId?: string) {
  return `${DRAFT_KEY_PREFIX}:${conversationId ?? "new"}`;
}

interface ChatInputProps {
  onSend: (content: string) => Promise<void>;
  onStop?: () => void;
  disabled?: boolean;
  busy?: boolean;
  initialValue?: string;
  conversationId?: string;
  size?: "default" | "large";
  centered?: boolean;
}

export function ChatInput({
  onSend,
  onStop,
  disabled,
  busy,
  initialValue = "",
  conversationId,
  size = "default",
  centered = false,
}: ChatInputProps) {
  const [content, setContent] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const skipDraftSave = useRef(false);

  useEffect(() => {
    if (initialValue) {
      setContent(initialValue);
      skipDraftSave.current = true;
    }
  }, [initialValue]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initialValue) return;
    try {
      const saved = sessionStorage.getItem(draftKey(conversationId));
      if (saved) setContent(saved);
    } catch {
      /* ignore */
    }
  }, [conversationId, initialValue]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (skipDraftSave.current) {
      skipDraftSave.current = false;
      return;
    }
    try {
      if (content.trim()) {
        sessionStorage.setItem(draftKey(conversationId), content);
      } else {
        sessionStorage.removeItem(draftKey(conversationId));
      }
    } catch {
      /* ignore */
    }
  }, [content, conversationId]);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [content, resizeTextarea]);

  async function handleSubmit(event?: React.FormEvent) {
    event?.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || disabled || busy) return;

    setContent("");
    try {
      sessionStorage.removeItem(draftKey(conversationId));
    } catch {
      /* ignore */
    }
    await onSend(trimmed);
    textareaRef.current?.focus();
  }

  const charCount = content.length;
  const nearLimit = charCount > MAX_CHARS * 0.9;
  const isGenerating = Boolean(busy);

  const isLarge = size === "large";

  return (
    <form
      onSubmit={handleSubmit}
      className={clsx(
        "shrink-0 no-print w-full",
        centered
          ? "py-0 px-0 bg-transparent border-0"
          : "border-t border-stroke-subtle py-4 bg-surface-0/80 backdrop-blur-xl chat-input-shadow pb-safe px-4 md:px-6",
        isGenerating && "opacity-95",
      )}
    >
      <div className={clsx("chat-content-column mx-auto flex gap-3 items-end w-full", isLarge && "max-w-2xl")}>
        <div className="flex-1 min-w-0 relative">
          {isGenerating && (
            <div
              className="absolute inset-0 rounded-2xl bg-surface-1/40 pointer-events-none z-[1] border border-stroke-subtle/50"
              aria-hidden
            />
          )}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleSubmit();
                return;
              }
              if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                void handleSubmit();
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setContent("");
                try {
                  sessionStorage.removeItem(draftKey(conversationId));
                } catch {
                  /* ignore */
                }
              }
            }}
            placeholder={isGenerating ? "Generando respuesta…" : "Escribe tu pregunta sobre la documentación…"}
            rows={1}
            disabled={isGenerating}
            aria-busy={isGenerating}
            className={clsx(
              "input-field w-full resize-none rounded-2xl bg-surface-1 border-stroke-default",
              "max-h-[160px] overflow-y-auto",
              isLarge ? "min-h-[56px] text-base px-4 py-3" : "min-h-[44px]",
              isGenerating && "cursor-not-allowed text-text-muted",
            )}
            aria-label="Escribe tu pregunta"
          />
          <div className="flex justify-between mt-1.5 px-1 gap-2">
            <span className="text-[10px] text-text-muted hidden sm:inline">
              <kbd className="px-1 py-0.5 rounded bg-surface-2 text-[9px]">Shift</kbd>
              {" + "}
              <kbd className="px-1 py-0.5 rounded bg-surface-2 text-[9px]">Enter</kbd>
              {" nueva línea"}
            </span>
            {nearLimit && (
              <span
                className="text-[10px] tabular-nums text-status-warn ml-auto"
                aria-live="polite"
              >
                {charCount}/{MAX_CHARS}
              </span>
            )}
          </div>
        </div>

        <div className="relative shrink-0 self-end w-11 h-11">
          <button
            type="button"
            onClick={onStop}
            className={clsx(
              "absolute inset-0 btn-ghost !min-h-[44px] !min-w-[44px] !rounded-full border-status-error/40 text-status-error",
              "transition-all duration-200",
              isGenerating && onStop ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none",
            )}
            aria-label="Detener generación"
            tabIndex={isGenerating && onStop ? 0 : -1}
          >
            <IconStop className="w-4 h-4" />
          </button>
          <button
            type="submit"
            disabled={isGenerating || !content.trim()}
            className={clsx(
              "absolute inset-0 btn-primary !min-h-[44px] !min-w-[44px] !rounded-full !p-0",
              "transition-all duration-200",
              isGenerating ? "opacity-0 scale-90 pointer-events-none" : "opacity-100 scale-100",
            )}
            aria-label="Enviar mensaje"
            tabIndex={isGenerating ? -1 : 0}
          >
            <IconArrowUp className="w-5 h-5" />
          </button>
        </div>
      </div>
    </form>
  );
}
