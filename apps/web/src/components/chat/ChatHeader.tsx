"use client";

import { IconDownload, IconMenu, IconSparkles } from "@/components/ui/Icons";
import { useNavShell } from "@/components/layout/NavShellContext";
import { ChatHistoryToggle } from "./ChatSidebar";

interface ChatHeaderProps {
  title?: string;
  pageCount?: number | null;
  hasMessages?: boolean;
  historyOpen?: boolean;
  onToggleHistory?: () => void;
  onExport?: () => void;
  loading?: boolean;
}

export function ChatHeader({
  title,
  pageCount,
  hasMessages = false,
  historyOpen = false,
  onToggleHistory,
  onExport,
  loading,
}: ChatHeaderProps) {
  const { openMobileNav, openInstructions } = useNavShell();
  const showPageCount = !hasMessages && pageCount != null;

  return (
    <header className="sticky top-0 z-10 shrink-0 border-b border-stroke-subtle no-print bg-surface-0/80 backdrop-blur-xl">
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

        <div className="flex-1 min-w-0 text-center px-2">
          <h1 className="text-sm font-medium truncate tracking-tight">
            {loading ? "Cargando…" : title || "Chat"}
          </h1>
          {showPageCount && (
            <p className="text-xs text-text-muted truncate mt-0.5">
              {pageCount} páginas indexadas
            </p>
          )}
        </div>

        <div className="flex items-center gap-0.5 justify-end shrink-0 min-w-[4.5rem] sm:min-w-[5.5rem]">
          <button
            type="button"
            onClick={openInstructions}
            className="btn-icon !rounded-lg"
            title="Instrucciones del asistente"
            aria-label="Instrucciones del asistente"
          >
            <IconSparkles className="w-4 h-4" />
          </button>
          {onExport ? (
            <button
              type="button"
              onClick={onExport}
              className="btn-icon !rounded-lg"
              title="Exportar conversación"
              aria-label="Exportar conversación"
            >
              <IconDownload className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
