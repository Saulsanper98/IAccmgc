"use client";

import type { Citation } from "@/lib/chat-types";
import clsx from "clsx";

interface ChatSourcesPanelProps {
  citations: Citation[];
  highlightedIndex?: number | null;
  onCitationClick?: (index: number) => void;
}

export function ChatSourcesPanel({
  citations,
  highlightedIndex,
  onCitationClick,
}: ChatSourcesPanelProps) {
  if (citations.length === 0) return null;

  return (
    <aside
      className="hidden xl:flex flex-col shrink-0 w-72 border-l border-stroke-subtle bg-surface-0/80 no-print"
      aria-label="Fuentes citadas"
    >
      <div className="sticky top-0 z-10 px-4 py-3 border-b border-stroke-subtle surface-glass">
        <h2 className="text-xs font-medium uppercase tracking-wide text-text-muted">
          Fuentes ({citations.length})
        </h2>
      </div>
      <ol className="flex-1 overflow-y-auto p-3 space-y-2">
        {citations.map((citation, index) => (
          <li key={`${citation.chunk_id}-${index}`}>
            <button
              type="button"
              onClick={() => onCitationClick?.(index + 1)}
              className={clsx(
                "w-full text-left rounded-lg border p-3 transition-colors text-sm",
                highlightedIndex === index + 1
                  ? "border-link bg-link/10"
                  : "border-stroke-subtle hover:bg-surface-1",
              )}
            >
              <span className="text-[10px] font-medium text-text-muted tabular-nums">
                [{index + 1}]
              </span>
              <p className="font-medium truncate mt-0.5">{citation.page_title}</p>
              {citation.excerpt && (
                <p className="text-xs text-text-muted line-clamp-3 mt-1">{citation.excerpt}</p>
              )}
              {citation.wiki_url && (
                <a
                  href={citation.wiki_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-link hover:underline mt-2 inline-block"
                  onClick={(e) => e.stopPropagation()}
                >
                  Abrir en wiki →
                </a>
              )}
            </button>
          </li>
        ))}
      </ol>
    </aside>
  );
}
