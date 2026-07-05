"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import clsx from "clsx";
import { IconCheck, IconChevronDown, IconCopy } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/ToastProvider";
import type { Citation } from "@/lib/chat-types";
import { stripHtml } from "@/lib/strip-html";

interface MarkdownContentProps {
  content: string;
  className?: string;
  onCitationClick?: (index: number) => void;
  citations?: Citation[];
}

function languageLabel(className?: string): string | null {
  if (!className) return null;
  const match = className.match(/language-(\w+)/);
  return match ? match[1] : null;
}

const CODE_COLLAPSE_LINES = 20;

function CodeBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const code = String(children).replace(/\n$/, "");
  const lang = languageLabel(className);
  const lineCount = code.split("\n").length;
  const isLong = lineCount > CODE_COLLAPSE_LINES;

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast("Código copiado", "success");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative group my-3 max-w-full rounded-md bg-surface-1/80 overflow-hidden border border-stroke-subtle">
      {lang && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-stroke-subtle bg-surface-2/60">
          <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">{lang}</span>
          {isLong && (
            <span className="text-[10px] text-text-muted tabular-nums">{lineCount} líneas</span>
          )}
        </div>
      )}
      <pre
        className={clsx(
          "hljs overflow-x-auto m-0 p-3 pr-11 text-xs leading-relaxed",
          isLong && !expanded && "max-h-[320px] overflow-y-hidden",
          (!isLong || expanded) && "max-h-[420px] overflow-y-auto",
          className,
        )}
      >
        <code>{children}</code>
      </pre>
      {isLong && !expanded && (
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface-1 to-transparent pointer-events-none" />
      )}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full py-1.5 text-[11px] text-link hover:bg-surface-2/60 border-t border-stroke-subtle inline-flex items-center justify-center gap-1"
        >
          <IconChevronDown className={clsx("w-3.5 h-3.5 transition-transform", expanded && "rotate-180")} />
          {expanded ? "Mostrar menos" : `Mostrar ${lineCount - CODE_COLLAPSE_LINES} líneas más`}
        </button>
      )}
      <button
        type="button"
        onClick={copy}
        className={clsx(
          "absolute top-1.5 right-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-md",
          "bg-surface-2/95 text-text-secondary transition-colors",
          "hover:bg-surface-2 hover:text-text-primary",
          "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100",
          lang && "top-9",
        )}
        aria-label={copied ? "Copiado" : "Copiar código"}
      >
        {copied ? <IconCheck className="w-3.5 h-3.5 text-status-ok" /> : <IconCopy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function CitationMarker({
  index,
  onCitationClick,
  citation,
}: {
  index: number;
  onCitationClick: (index: number) => void;
  citation?: Citation;
}) {
  const [open, setOpen] = useState(false);
  const excerpt = citation ? stripHtml(citation.excerpt) : null;

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => onCitationClick(index)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="text-link font-mono text-xs hover:underline mx-0.5"
        aria-label={`Ir a fuente ${index}`}
      >
        [{index}]
      </button>
      {open && citation && (
        <span
          role="tooltip"
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 z-30 w-64 p-2.5 rounded-lg border border-stroke-default bg-surface-1 shadow-glass text-left pointer-events-none"
        >
          <span className="block text-xs font-medium text-text-primary truncate">{citation.page_title}</span>
          {citation.heading_path && (
            <span className="block text-[10px] text-text-muted truncate mt-0.5">{citation.heading_path}</span>
          )}
          {excerpt && (
            <span className="block text-[11px] text-text-secondary line-clamp-3 mt-1 leading-relaxed">{excerpt}</span>
          )}
        </span>
      )}
    </span>
  );
}

export function MarkdownContent({ content, className, onCitationClick, citations }: MarkdownContentProps) {
  const citationByIndex = new Map(citations?.map((c) => [c.index, c]) ?? []);

  return (
    <div className={clsx("prose-wikibridge message-body", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">
              {children}
            </a>
          ),
          code: ({ className: codeClass, children, ...props }) => {
            const isBlock = codeClass?.includes("language-");
            if (isBlock) {
              return <CodeBlock className={codeClass}>{children}</CodeBlock>;
            }
            return (
              <code
                className="px-1.5 py-0.5 rounded-md bg-surface-2/90 text-link text-[0.9em] font-normal"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          p: ({ children }) => {
            if (typeof children === "string" || Array.isArray(children)) {
              const parts = processCitationMarkers(children, onCitationClick, citationByIndex);
              return <p className="mb-3 last:mb-0 leading-relaxed">{parts}</p>;
            }
            return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>;
          },
          h1: ({ children }) => <h1 className="text-lg font-semibold mt-4 mb-2 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-semibold mt-4 mb-2 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-1.5 first:mt-0">{children}</h3>,
          ul: ({ children }) => <ul className="list-disc pl-5 mb-4 space-y-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-4 space-y-3">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed pl-0.5">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-stroke-default pl-4 my-4 text-text-secondary">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 -mx-1 px-1">
              <table className="w-full min-w-max text-xs border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="sticky top-0 z-[1] bg-surface-1">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border border-stroke-default bg-surface-2 px-2 py-1.5 text-left font-medium whitespace-nowrap">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-stroke-subtle px-2 py-1.5">{children}</td>
          ),
          hr: () => <hr className="my-4 border-stroke-subtle" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function processCitationMarkers(
  children: React.ReactNode,
  onCitationClick?: (index: number) => void,
  citationByIndex?: Map<number, Citation>,
): React.ReactNode {
  if (!onCitationClick) return children;

  const flatten = (node: React.ReactNode): string => {
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(flatten).join("");
    return "";
  };

  const text = flatten(children);
  const parts = text.split(/(\[\d+\])/g);
  if (parts.length === 1) return children;

  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (match) {
      const index = parseInt(match[1], 10);
      return (
        <CitationMarker
          key={i}
          index={index}
          onCitationClick={onCitationClick}
          citation={citationByIndex?.get(index)}
        />
      );
    }
    return part;
  });
}
