"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ConversationSummary } from "@/lib/chat-types";
import { getArchivedIds, getPinnedIds, toggleArchive, togglePin } from "@/lib/conversation-pins";
import { DATE_GROUP_LABELS, getDateGroup, type DateGroup, formatRelativeTime } from "@/lib/format";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconArchive, IconEdit, IconPin, IconPlus, IconSearch, IconTrash } from "@/components/ui/Icons";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import clsx from "clsx";

interface ChatSidebarProps {
  conversations: ConversationSummary[];
  activeId?: string;
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onPrefetch?: (id: string) => void;
}

function HighlightTitle({ title, query }: { title: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{title}</>;
  const lower = title.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx < 0) return <>{title}</>;
  return (
    <>
      {title.slice(0, idx)}
      <mark className="bg-link/15 text-text-primary rounded px-0.5">{title.slice(idx, idx + q.length)}</mark>
      {title.slice(idx + q.length)}
    </>
  );
}

export function ChatSidebar({
  conversations,
  activeId,
  open,
  onClose,
  onNewChat,
  onDelete,
  onRename,
  onPrefetch,
}: ChatSidebarProps) {
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [pinVersion, setPinVersion] = useState(0);
  const drawerRef = useRef<HTMLElement>(null);

  useFocusTrap(open, drawerRef, onClose);

  const pinnedIds = useMemo(() => getPinnedIds(), [pinVersion]);
  const archivedIds = useMemo(() => getArchivedIds(), [pinVersion]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = conversations.filter((c) => {
      const archived = archivedIds.has(c.id);
      return showArchived ? archived : !archived;
    });
    if (q) list = list.filter((c) => c.title.toLowerCase().includes(q));
    return list.sort((a, b) => {
      const aPin = pinnedIds.has(a.id) ? 1 : 0;
      const bPin = pinnedIds.has(b.id) ? 1 : 0;
      if (aPin !== bPin) return bPin - aPin;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [conversations, search, pinnedIds, archivedIds, showArchived]);

  const pinned = useMemo(
    () => filtered.filter((c) => pinnedIds.has(c.id)),
    [filtered, pinnedIds],
  );

  const grouped = useMemo(() => {
    const unpinned = filtered.filter((c) => !pinnedIds.has(c.id));
    const groups: Record<DateGroup, ConversationSummary[]> = {
      today: [],
      yesterday: [],
      week: [],
      older: [],
    };
    for (const conv of unpinned) {
      groups[getDateGroup(conv.updated_at)].push(conv);
    }
    return groups;
  }, [filtered, pinnedIds]);

  const deleteTarget = deleteId ? conversations.find((c) => c.id === deleteId) : null;

  const cancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameValue("");
  }, []);

  function saveRename(conv: ConversationSummary) {
    onRename(conv.id, renameValue.trim() || conv.title);
    cancelRename();
  }

  function renderConv(conv: ConversationSummary) {
    return (
      <div
        key={conv.id}
        className={clsx(
          "group flex items-center gap-0.5 rounded-lg min-w-0 transition-colors",
          activeId === conv.id ? "bg-surface-2" : "hover:bg-surface-2/50",
        )}
      >
        {renamingId === conv.id ? (
          <div className="flex-1 px-2 py-1.5 min-w-0 space-y-2">
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="input-field text-sm py-1 w-full"
              aria-label="Nuevo título"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveRename(conv);
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelRename();
                }
              }}
            />
            <div className="flex gap-1.5">
              <button
                type="button"
                className="btn-primary btn-sm flex-1"
                onClick={() => saveRename(conv)}
              >
                Guardar
              </button>
              <button type="button" className="btn-ghost btn-sm flex-1" onClick={cancelRename}>
                Cancelar
              </button>
            </div>
            <p className="text-[10px] text-text-muted meta-caption">
              <kbd className="px-1 py-0.5 rounded bg-surface-2 text-[9px]">Enter</kbd> guardar ·{" "}
              <kbd className="px-1 py-0.5 rounded bg-surface-2 text-[9px]">Esc</kbd> cancelar
            </p>
          </div>
        ) : (
          <>
            <Link
              href={`/chat/${conv.id}`}
              className="flex-1 px-2.5 py-2 min-w-0"
              title={conv.title}
              onClick={onClose}
              onMouseEnter={() => onPrefetch?.(conv.id)}
              onFocus={() => onPrefetch?.(conv.id)}
            >
              <p className="text-sm truncate flex items-center gap-1">
                {pinnedIds.has(conv.id) && (
                  <IconPin className="w-3 h-3 text-accent shrink-0" aria-label="Fijada" />
                )}
                <HighlightTitle title={conv.title} query={search} />
              </p>
              <p className="text-[10px] text-text-muted">{formatRelativeTime(conv.updated_at)}</p>
            </Link>
            <div className="flex items-center shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
              <button
                type="button"
                onClick={() => {
                  togglePin(conv.id);
                  setPinVersion((v) => v + 1);
                }}
                className="p-1.5 text-text-muted hover:text-accent"
                aria-label={pinnedIds.has(conv.id) ? "Desfijar" : "Fijar conversación"}
                aria-pressed={pinnedIds.has(conv.id)}
              >
                <IconPin className={clsx("w-3.5 h-3.5", pinnedIds.has(conv.id) && "text-accent")} />
              </button>
              <button
                type="button"
                onClick={() => {
                  toggleArchive(conv.id);
                  setPinVersion((v) => v + 1);
                }}
                className="p-1.5 text-text-muted hover:text-text-primary"
                aria-label={archivedIds.has(conv.id) ? "Restaurar" : "Archivar"}
                aria-pressed={archivedIds.has(conv.id)}
              >
                <IconArchive className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setRenamingId(conv.id);
                  setRenameValue(conv.title);
                }}
                className="p-1.5 text-text-muted hover:text-text-primary"
                aria-label="Renombrar conversación"
              >
                <IconEdit className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDeleteId(conv.id)}
                className="p-1.5 text-text-muted hover:text-status-error"
                aria-label="Eliminar conversación"
              >
                <IconTrash className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[45] bg-black/50 backdrop-blur-[2px] no-print"
        aria-label="Cerrar historial"
        onClick={onClose}
      />

      <aside
        ref={drawerRef}
        className={clsx(
          "fixed inset-y-0 left-0 z-50 chat-history-drawer flex flex-col no-print",
          "surface-glass border-r border-stroke-subtle shadow-elevated animate-drawer-in",
        )}
        aria-label="Historial de conversaciones"
      >
        <div className="p-4 border-b border-stroke-subtle space-y-3">
          <button type="button" onClick={onNewChat} className="btn-secondary btn-sm w-full">
            <IconPlus className="w-4 h-4" />
            Nueva conversación
          </button>
          <div className="relative">
            <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversaciones…"
              className="input-field pl-8 text-sm py-1.5 w-full"
              aria-label="Buscar conversaciones"
            />
          </div>
          <button
            type="button"
            className="text-[10px] text-text-muted hover:text-text-secondary"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? "Ver activas" : "Ver archivadas"}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 min-h-0">
          {filtered.length === 0 && (
            <p className="text-xs text-text-muted px-3 py-2">
              {search ? "Sin resultados" : showArchived ? "Sin archivadas" : "Sin conversaciones aún"}
            </p>
          )}

          {pinned.length > 0 && !showArchived && (
            <div className="mb-2">
              <p className="section-label px-2 py-1.5">Fijadas</p>
              <div className="space-y-0.5">{pinned.map(renderConv)}</div>
            </div>
          )}

          {(Object.keys(grouped) as DateGroup[]).map((group) => {
            const items = grouped[group];
            if (!items.length) return null;
            return (
              <div key={group} className="mb-2">
                <p className="section-label px-2 py-1.5">{DATE_GROUP_LABELS[group]}</p>
                <div className="space-y-0.5">{items.map(renderConv)}</div>
              </div>
            );
          })}
        </nav>
      </aside>

      <ConfirmDialog
        open={deleteId !== null}
        title="Eliminar conversación"
        message={
          deleteTarget
            ? `¿Eliminar «${deleteTarget.title}»? Esta acción no se puede deshacer. Se borrarán todos los mensajes.`
            : "Esta acción no se puede deshacer. Se borrarán todos los mensajes."
        }
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => {
          if (deleteId) onDelete(deleteId);
          setDeleteId(null);
        }}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}

export function ChatHistoryToggle({
  onClick,
  active,
}: {
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "btn-icon shrink-0 !rounded-lg no-print",
        active && "bg-surface-2 text-text-primary",
      )}
      aria-label={active ? "Cerrar historial" : "Abrir historial de conversaciones"}
      aria-expanded={active}
    >
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 3v18" />
      </svg>
    </button>
  );
}
