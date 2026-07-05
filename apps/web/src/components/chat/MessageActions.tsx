"use client";

import { useState } from "react";
import { IconCheck, IconCopy, IconEdit, IconLink, IconRefresh } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/ToastProvider";

interface MessageActionsProps {
  content: string;
  onRegenerate?: () => void;
  onRetry?: () => void;
  messageId?: string;
  conversationId?: string;
}

function buildMessageLink(conversationId?: string, messageId?: string): string | null {
  if (!messageId || typeof window === "undefined") return null;
  const base = conversationId
    ? `${window.location.origin}/chat/${conversationId}`
    : `${window.location.origin}${window.location.pathname}`;
  return `${base}#msg-${messageId}`;
}

export function MessageActions({
  content,
  onRegenerate,
  onRetry,
  messageId,
  conversationId,
}: MessageActionsProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const messageLink = buildMessageLink(conversationId, messageId);

  async function copy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!content.trim()) {
      toast("No hay contenido para copiar", "error");
      return;
    }
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast("Respuesta copiada al portapapeles", "success");
    setTimeout(() => setCopied(false), 2000);
  }

  async function copyLink(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!messageLink) return;
    await navigator.clipboard.writeText(messageLink);
    setLinkCopied(true);
    toast("Enlace copiado", "success");
    setTimeout(() => setLinkCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-1 mt-2 flex-wrap opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
      <button
        type="button"
        onClick={copy}
        className="btn-ghost px-2 py-1 text-xs inline-flex items-center gap-1"
        aria-label="Copiar respuesta"
        title="Copiar solo esta respuesta"
      >
        {copied ? <IconCheck className="w-3.5 h-3.5 text-status-ok" /> : <IconCopy className="w-3.5 h-3.5" />}
        Copiar
      </button>
      {messageLink && (
        <button
          type="button"
          onClick={copyLink}
          className="btn-ghost px-2 py-1 text-xs inline-flex items-center gap-1"
          aria-label="Copiar enlace al mensaje"
          title="Copiar enlace al mensaje"
        >
          {linkCopied ? <IconCheck className="w-3.5 h-3.5 text-status-ok" /> : <IconLink className="w-3.5 h-3.5" />}
          Enlace
        </button>
      )}
      {onRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          className="btn-ghost px-2 py-1 text-xs inline-flex items-center gap-1"
          aria-label="Regenerar respuesta"
          title="Volver a generar la respuesta"
        >
          <IconRefresh className="w-3.5 h-3.5" />
          Regenerar
        </button>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn-ghost px-2 py-1 text-xs inline-flex items-center gap-1 text-status-warn"
          aria-label="Reintentar pregunta"
          title="Reenviar la pregunta"
        >
          <IconRefresh className="w-3.5 h-3.5" />
          Reintentar
        </button>
      )}
    </div>
  );
}

export function UserMessageActions({
  content,
  onEdit,
  onRetry,
  showRetry,
  isEditing,
  onStartEdit,
  messageId,
  conversationId,
}: {
  content: string;
  onEdit?: () => void;
  onRetry?: () => void;
  showRetry?: boolean;
  isEditing?: boolean;
  onStartEdit?: () => void;
  messageId?: string;
  conversationId?: string;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const messageLink = buildMessageLink(conversationId, messageId);

  async function copy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast("Pregunta copiada", "success");
    setTimeout(() => setCopied(false), 2000);
  }

  async function copyLink(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!messageLink) return;
    await navigator.clipboard.writeText(messageLink);
    setLinkCopied(true);
    toast("Enlace copiado", "success");
    setTimeout(() => setLinkCopied(false), 2000);
  }

  if (isEditing) return null;

  return (
    <div className="flex justify-end gap-0.5 mt-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity duration-150">
      {showRetry && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn-ghost px-2 py-1 text-xs inline-flex items-center gap-1 text-status-warn"
          aria-label="Reintentar pregunta"
          title="Reenviar esta pregunta"
        >
          <IconRefresh className="w-3 h-3" />
          Reintentar
        </button>
      )}
      <button
        type="button"
        onClick={copy}
        className="btn-icon !min-h-[32px] !min-w-[32px] !rounded-lg"
        aria-label="Copiar pregunta"
        title="Copiar"
      >
        {copied ? (
          <IconCheck className="w-3.5 h-3.5 text-status-ok" />
        ) : (
          <IconCopy className="w-3.5 h-3.5" />
        )}
      </button>
      {messageLink && (
        <button
          type="button"
          onClick={copyLink}
          className="btn-icon !min-h-[32px] !min-w-[32px] !rounded-lg"
          aria-label="Copiar enlace al mensaje"
          title="Copiar enlace"
        >
          {linkCopied ? (
            <IconCheck className="w-3.5 h-3.5 text-status-ok" />
          ) : (
            <IconLink className="w-3.5 h-3.5" />
          )}
        </button>
      )}
      {(onEdit || onStartEdit) && (
        <button
          type="button"
          onClick={onStartEdit ?? onEdit}
          className="btn-icon !min-h-[32px] !min-w-[32px] !rounded-lg"
          aria-label="Editar"
          title="Editar"
        >
          <IconEdit className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
