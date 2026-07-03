"use client";

import { useState } from "react";
import type { Citation } from "@/lib/chat-types";
import { stripHtml } from "@/lib/strip-html";
import { IconChevronDown, IconExternalLink } from "@/components/ui/Icons";
import clsx from "clsx";

const COLLAPSE_THRESHOLD = 8;

function wikiOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function isExplicitCitation(citation: Citation, citedChunkIds?: string[]): boolean {
  if (!citedChunkIds?.length) return true;
  return citedChunkIds.includes(citation.chunk_id);
}

function CitationChip({
  citation,
  onCitationClick,
  highlightedIndex,
  prominent,
  isExplicit,
}: {
  citation: Citation;
  onCitationClick?: (index: number) => void;
  highlightedIndex?: number | null;
  prominent?: boolean;
  isExplicit?: boolean;
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const excerpt = stripHtml(citation.excerpt);
  const tooltip = citation.heading_path
    ? `${citation.heading_path}\n\n${excerpt}`
    : excerpt;

  return (
    <div className="relative">
      <a
        id={`citation-${citation.index}`}
        href={citation.wiki_url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (onCitationClick) {
            e.preventDefault();
            onCitationClick(citation.index);
          }
        }}
        onMouseEnter={() => setPopoverOpen(true)}
        onMouseLeave={() => setPopoverOpen(false)}
        onFocus={() => setPopoverOpen(true)}
        onBlur={() => setPopoverOpen(false)}
        className={clsx(
          "citation-chip inline-flex items-center gap-2 max-w-full sm:max-w-[280px] px-3.5 py-2 rounded-xl text-xs transition-colors scroll-mt-24",
          prominent
            ? "bg-surface-2 border border-stroke-default hover:border-link/40 hover:bg-surface-2/80"
            : "bg-surface-1 border border-stroke-subtle hover:bg-surface-2",
          highlightedIndex === citation.index && "ring-1 ring-link border-link/40",
          isExplicit === false && "border-dashed opacity-90",
        )}
        title={tooltip}
        aria-describedby={popoverOpen ? `citation-popover-${citation.index}` : undefined}
      >
        <span className="text-link font-medium tabular-nums shrink-0">[{citation.index}]</span>
        <span className="truncate font-medium text-text-primary">{citation.page_title}</span>
        {isExplicit === false && (
          <span className="text-[10px] text-text-muted shrink-0" title="Contexto RAG">
            ctx
          </span>
        )}
        <IconExternalLink className="w-3 h-3 text-text-muted shrink-0" />
      </a>

      {popoverOpen && (
        <div
          id={`citation-popover-${citation.index}`}
          role="tooltip"
          className="absolute left-0 bottom-full mb-2 z-30 w-72 max-w-[calc(100vw-2rem)] p-3 rounded-xl border border-stroke-default bg-surface-1 shadow-glass text-xs pointer-events-none"
        >
          {citation.heading_path && (
            <p className="font-medium text-text-primary mb-1 truncate">{citation.heading_path}</p>
          )}
          <p className="text-text-secondary line-clamp-4 leading-relaxed">{excerpt}</p>
        </div>
      )}
    </div>
  );
}

export function CitationChips({
  citations,
  onCitationClick,
  highlightedIndex,
  prominent = false,
  citedChunkIds,
}: {
  citations: Citation[];
  onCitationClick?: (index: number) => void;
  highlightedIndex?: number | null;
  prominent?: boolean;
  citedChunkIds?: string[];
}) {
  const [expanded, setExpanded] = useState(false);

  if (!citations.length) return null;

  const shouldCollapse = citations.length >= COLLAPSE_THRESHOLD;
  const visible = shouldCollapse && !expanded ? citations.slice(0, 6) : citations;
  const hiddenCount = citations.length - visible.length;
  const canDifferentiate = citedChunkIds != null && citedChunkIds.length > 0;

  return (
    <div className={clsx(prominent ? "mt-4 pt-3 border-t border-stroke-subtle" : "mt-4 pt-3 border-t border-stroke-subtle")}>
      <p className="text-xs font-medium text-text-secondary mb-2.5">
        Fuentes · {citations.length}
      </p>
      <div className="flex flex-wrap gap-2 sm:gap-2.5">
        {visible.map((citation) => (
          <CitationChip
            key={citation.chunk_id}
            citation={citation}
            onCitationClick={onCitationClick}
            highlightedIndex={highlightedIndex}
            prominent={prominent}
            isExplicit={canDifferentiate ? isExplicitCitation(citation, citedChunkIds) : undefined}
          />
        ))}
      </div>
      {shouldCollapse && !expanded && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2.5 inline-flex items-center gap-1 text-xs text-link hover:underline"
        >
          <IconChevronDown className="w-3.5 h-3.5" />
          Ver {hiddenCount} fuente{hiddenCount === 1 ? "" : "s"} más
        </button>
      )}
      {shouldCollapse && expanded && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-2.5 inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary"
        >
          Mostrar menos
        </button>
      )}
    </div>
  );
}

/** @deprecated Use CitationChips */
export function CitationCards(props: Parameters<typeof CitationChips>[0]) {
  return <CitationChips {...props} />;
}

export { wikiOrigin };
