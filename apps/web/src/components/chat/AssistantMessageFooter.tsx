"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconInfo,
  IconLink,
  IconRefresh,
} from "@/components/ui/Icons";
import { useToast } from "@/components/ui/ToastProvider";
import { MessageFeedback } from "./MessageFeedback";
import { exportMessageMarkdown, formatLatency, type RegenerateMode } from "@/lib/format";

const REGENERATE_OPTIONS: { mode: RegenerateMode; label: string; description: string }[] = [
  { mode: "default", label: "Regenerar", description: "Misma pregunta, nueva respuesta" },
  { mode: "concise", label: "Más breve", description: "Respuesta concisa" },
  { mode: "detailed", label: "Más detallada", description: "Amplía el contexto" },
  { mode: "sources-only", label: "Solo fuentes", description: "Basada en citas" },
];

export function AssistantMessageFooter({
  messageId,
  content,
  conversationId,
  onRegenerate,
  latencyMs,
  model,
}: {
  messageId: string;
  content: string;
  conversationId?: string;
  onRegenerate?: (mode?: RegenerateMode) => void;
  latencyMs?: number | null;
  model?: string | null;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuOpensDown, setMenuOpensDown] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  function toggleMenu() {
    setMenuOpen((prev) => {
      const next = !prev;
      if (next && menuButtonRef.current) {
        const rect = menuButtonRef.current.getBoundingClientRect();
        setMenuOpensDown(rect.top < 160);
      }
      return next;
    });
  }

  async function copy() {
    if (!content.trim()) {
      toast("No hay contenido para copiar", "error");
      return;
    }
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast("Respuesta copiada", "success");
    setTimeout(() => setCopied(false), 2000);
  }

  async function copyLink() {
    const base = conversationId
      ? `${window.location.origin}/chat/${conversationId}`
      : `${window.location.origin}${window.location.pathname}`;
    const url = `${base}#msg-${messageId}`;
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    toast("Enlace copiado", "success");
    setTimeout(() => setLinkCopied(false), 2000);
  }

  function exportMd() {
    const md = exportMessageMarkdown("assistant", content, { model, latencyMs });
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `respuesta-${messageId.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Mensaje exportado", "success");
  }

  const hasDetails = latencyMs != null || model;

  return (
    <div className="mt-3 pt-2 border-t border-stroke-subtle/60">
      <div className="flex items-center gap-0.5 transition-opacity duration-150">
        <MessageFeedback messageId={messageId} compact />

        <button
          type="button"
          onClick={() => void copy()}
          className="btn-icon !min-h-[32px] !min-w-[32px] !rounded-lg"
          aria-label={copied ? "Copiado" : "Copiar respuesta"}
          title="Copiar"
        >
          {copied ? (
            <IconCheck className="w-3.5 h-3.5 text-status-ok" />
          ) : (
            <IconCopy className="w-3.5 h-3.5" />
          )}
        </button>

        <button
          type="button"
          onClick={() => void copyLink()}
          className="btn-icon !min-h-[32px] !min-w-[32px] !rounded-lg"
          aria-label={linkCopied ? "Enlace copiado" : "Copiar enlace al mensaje"}
          title="Copiar enlace"
        >
          {linkCopied ? (
            <IconCheck className="w-3.5 h-3.5 text-status-ok" />
          ) : (
            <IconLink className="w-3.5 h-3.5" />
          )}
        </button>

        <button
          type="button"
          onClick={exportMd}
          className="btn-icon !min-h-[32px] !min-w-[32px] !rounded-lg"
          aria-label="Exportar mensaje"
          title="Exportar markdown"
        >
          <IconDownload className="w-3.5 h-3.5" />
        </button>

        {onRegenerate && (
          <div className="relative" ref={menuRef}>
            <button
              ref={menuButtonRef}
              type="button"
              onClick={toggleMenu}
              className="btn-icon !min-h-[32px] !min-w-[32px] !rounded-lg"
              aria-label="Regenerar respuesta"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              title="Regenerar"
            >
              <IconRefresh className="w-3.5 h-3.5" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className={clsx(
                  "absolute left-0 z-30 min-w-[200px] py-1 rounded-xl border border-stroke-default bg-surface-1 shadow-glass",
                  menuOpensDown ? "top-full mt-1" : "bottom-full mb-1",
                )}
              >
                {REGENERATE_OPTIONS.map((opt) => (
                  <button
                    key={opt.mode}
                    type="button"
                    role="menuitem"
                    className="w-full text-left px-3 py-2 hover:bg-surface-2 transition-colors"
                    onClick={() => {
                      setMenuOpen(false);
                      onRegenerate(opt.mode);
                    }}
                  >
                    <span className="block text-xs font-medium text-text-primary">{opt.label}</span>
                    <span className="block text-[10px] text-text-muted mt-0.5">{opt.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {hasDetails && (
        <details className="mt-2 group/details" aria-label="Detalles de la respuesta del asistente">
          <summary className="meta-caption cursor-pointer hover:text-text-secondary list-none flex items-center gap-1.5">
            <IconInfo className="w-3.5 h-3.5 shrink-0" />
            <span>Detalles de la respuesta</span>
            <span className="group-open/details:rotate-90 transition-transform inline-block ml-auto">▸</span>
          </summary>
          <dl className="mt-1.5 pl-3 meta-caption space-y-0.5 border-l border-stroke-subtle">
            {latencyMs != null && (
              <div className="flex gap-2">
                <dt className="shrink-0">Latencia</dt>
                <dd>{formatLatency(latencyMs)}</dd>
              </div>
            )}
            {model && (
              <div className="flex gap-2">
                <dt className="shrink-0">Modelo</dt>
                <dd className="truncate">{model}</dd>
              </div>
            )}
          </dl>
        </details>
      )}
    </div>
  );
}
