"use client";

import { useState } from "react";
import { IconThumbDown, IconThumbUp } from "@/components/ui/Icons";

type FeedbackRating = "up" | "down";

export function MessageFeedback({
  messageId,
  compact = false,
}: {
  messageId: string;
  compact?: boolean;
}) {
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showDownPanel, setShowDownPanel] = useState(false);
  const [correction, setCorrection] = useState("");
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [showCorrectionNotice, setShowCorrectionNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(nextRating: FeedbackRating, nextCorrection?: string) {
    if (submitting || rating !== null) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: { rating: FeedbackRating; correction?: string } = { rating: nextRating };
      const trimmed = nextCorrection?.trim();
      if (trimmed) body.correction = trimmed;

      const response = await fetch(`/api/chat/messages/${messageId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "No se pudo enviar el feedback");
      }
      setRating(nextRating);
      setShowDownPanel(false);
      setShowCorrectionNotice(nextRating === "down" && Boolean(trimmed));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar feedback");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={compact ? "contents" : "mt-3 pt-2 border-t border-stroke-subtle"}>
      <div className="flex items-center gap-1 flex-wrap">
        {!compact && <span className="text-xs text-text-muted mr-1">¿Útil?</span>}
        <button
          type="button"
          onClick={() => void submit("up")}
          disabled={submitting || rating !== null}
          className={`btn-icon !min-h-[32px] !min-w-[32px] !rounded-lg transition-colors ${
            rating === "up" ? "text-status-ok" : "text-text-secondary"
          }`}
          aria-label="Respuesta útil"
          title="Útil"
        >
          <IconThumbUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setShowDownPanel((v) => !v)}
          disabled={submitting || rating !== null}
          className={`btn-icon !min-h-[32px] !min-w-[32px] !rounded-lg transition-colors ${
            rating === "down" ? "text-status-error" : "text-text-secondary"
          }`}
          aria-label="Respuesta no útil"
          title="No útil"
          aria-expanded={showDownPanel}
        >
          <IconThumbDown className="w-3.5 h-3.5" />
        </button>
        {rating === "up" && (
          <span className="text-[11px] text-text-muted meta-caption" role="status">
            Gracias
          </span>
        )}
      </div>

      {showDownPanel && rating === null && (
        <div className="mt-2 space-y-2 w-full min-w-[14rem]">
          <textarea
            value={correction}
            onChange={(e) => {
              setCorrection(e.target.value);
              if (correctionError) setCorrectionError(null);
            }}
            placeholder="¿Cuál habría sido la respuesta correcta?"
            className="input-field text-xs w-full min-h-[72px] resize-y"
            maxLength={8000}
            rows={3}
          />
          {correctionError && (
            <p className="text-[11px] text-status-error" role="alert">
              {correctionError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() => {
                setShowDownPanel(false);
                setCorrection("");
                setCorrectionError(null);
              }}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn-primary text-xs"
              onClick={() => {
                if (!correction.trim()) {
                  setCorrectionError("Indica la respuesta correcta antes de enviar.");
                  return;
                }
                void submit("down", correction);
              }}
              disabled={submitting}
            >
              Enviar
            </button>
          </div>
        </div>
      )}

      {showCorrectionNotice && (
        <p className="text-[11px] text-text-muted mt-2 meta-caption" role="status">
          Tu corrección quedará pendiente de revisión por un administrador.
        </p>
      )}

      {error && (
        <p className="text-[11px] text-status-error mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
