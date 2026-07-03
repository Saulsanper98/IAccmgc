"use client";

import { useState } from "react";
import { IconThumbDown, IconThumbUp } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/ToastProvider";

export function MessageFeedback({
  messageId,
  compact = false,
}: {
  messageId: string;
  compact?: boolean;
}) {
  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const { toast } = useToast();

  async function submit(value: 1 | -1, withComment?: string) {
    if (submitting || rating !== null) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/chat/messages/${messageId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: value, comment: withComment || null }),
      });
      if (response.ok) {
        setRating(value);
        toast("Gracias por tu feedback", "success");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleNegative() {
    setShowComment(true);
  }

  return (
    <div className={compact ? "contents" : "mt-3 pt-2 border-t border-stroke-subtle"}>
      <div className="flex items-center gap-0.5">
        {!compact && <span className="text-xs text-text-muted mr-1">¿Útil?</span>}
        <button
          type="button"
          onClick={() => submit(1)}
          disabled={submitting || rating !== null}
          className={`btn-icon !min-h-[32px] !min-w-[32px] !rounded-lg transition-colors ${
            rating === 1 ? "text-status-ok" : "text-text-secondary"
          }`}
          aria-label="Respuesta útil"
          title="Útil"
        >
          <IconThumbUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleNegative}
          disabled={submitting || rating !== null}
          className={`btn-icon !min-h-[32px] !min-w-[32px] !rounded-lg transition-colors ${
            rating === -1 ? "text-status-error" : "text-text-secondary"
          }`}
          aria-label="Respuesta no útil"
          title="No útil"
        >
          <IconThumbDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {showComment && rating === null && (
        <div className="mt-2 flex gap-2 w-full">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="¿Qué faltó o estuvo mal?"
            className="input-field text-xs flex-1"
            maxLength={500}
          />
          <button
            type="button"
            className="btn-ghost text-xs shrink-0"
            onClick={() => submit(-1, comment)}
            disabled={submitting}
          >
            Enviar
          </button>
        </div>
      )}
    </div>
  );
}
