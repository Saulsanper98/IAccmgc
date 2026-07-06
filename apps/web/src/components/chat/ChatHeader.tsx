"use client";

import { IconCopy, IconDownload, IconMenu, IconPlus, IconSparkles } from "@/components/ui/Icons";
import { useNavShell } from "@/components/layout/NavShellContext";
import { ChatHistoryToggle } from "./ChatSidebar";

interface ChatHeaderProps {
  title?: string;
  pageCount?: number | null;
  hasMessages?: boolean;
  welcomeMode?: boolean;
  historyOpen?: boolean;
  onToggleHistory?: () => void;
  onNewChat?: () => void;
  onExport?: () => void;
  onCopyMarkdown?: () => void;
  onPrint?: () => void;
  loading?: boolean;
}

export function ChatHeader({
  title,
  pageCount,
  hasMessages = false,
  welcomeMode = false,
  historyOpen = false,
  onToggleHistory,
  onNewChat,
  onExport,
  onCopyMarkdown,
  onPrint,
  loading,
}: ChatHeaderProps) {
  const { openMobileNav, openInstructions } = useNavShell();
  const showPageCountSubtitle = !welcomeMode && !hasMessages && pageCount != null;
  const showCompactPageBadge = hasMessages && pageCount != null;

  return (
    <header className="sticky top-0 z-10 shrink-0 no-print bg-surface-0">
      <div className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-3 w-full">
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={openMobileNav}
            className="btn-icon !rounded-lg md:hidden"
            aria-label="Menú de navegación"
          >
            <IconMenu className="w-4 h-4" />
          </button>
          {onToggleHistory && (
            <ChatHistoryToggle onClick={onToggleHistory} active={historyOpen} />
          )}
        </div>

        {!welcomeMode && (
          <div className="flex-1 min-w-0 text-center px-2">
            <div className="flex items-center justify-center gap-2 min-w-0">
              {(loading || title) && (
                <h1 className="text-sm font-medium truncate tracking-tight">
                  {loading ? "Cargando…" : title}
                </h1>
              )}
              {showCompactPageBadge && (
                <span
                  className="shrink-0 text-[10px] tabular-nums px-1.5 py-0.5 rounded-full border border-stroke-subtle text-text-muted meta-caption"
                  title={`${pageCount} páginas indexadas`}
                >
                  {pageCount}
                </span>
              )}
            </div>
            {showPageCountSubtitle && (
              <p className="text-xs text-text-muted truncate mt-0.5">
                {pageCount} páginas indexadas
              </p>
            )}
          </div>
        )}

        {welcomeMode && <div className="flex-1 min-w-0" aria-hidden />}

        <div className="flex items-center gap-0.5 justify-end shrink-0 min-w-[4.5rem] sm:min-w-[5.5rem]">
          {onNewChat && (
            <button
              type="button"
              onClick={onNewChat}
              className="btn-icon !rounded-lg hidden sm:inline-flex"
              title="Nueva conversación"
              aria-label="Nueva conversación"
            >
              <IconPlus className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={openInstructions}
            className="btn-icon !rounded-lg"
            title="Instrucciones del asistente"
            aria-label="Instrucciones del asistente"
          >
            <IconSparkles className="w-4 h-4" />
          </button>
          {onCopyMarkdown ? (
            <button
              type="button"
              onClick={onCopyMarkdown}
              className="btn-icon !rounded-lg"
              title="Copiar conversación en markdown"
              aria-label="Copiar conversación en markdown"
            >
              <IconCopy className="w-4 h-4" />
            </button>
          ) : null}
          {onExport ? (
            <button
              type="button"
              onClick={onExport}
              className="btn-icon !rounded-lg"
              title="Descargar conversación"
              aria-label="Descargar conversación en markdown"
            >
              <IconDownload className="w-4 h-4" />
            </button>
          ) : null}
          {onPrint ? (
            <button
              type="button"
              onClick={onPrint}
              className="btn-icon !rounded-lg hidden sm:inline-flex"
              title="Imprimir conversación"
              aria-label="Imprimir conversación"
            >
              <span className="text-xs font-medium">PDF</span>
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
