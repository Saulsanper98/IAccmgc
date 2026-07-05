"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { IconSearch } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/ToastProvider";

type TabStatus = "pending" | "validated" | "rejected";

interface ValidatedQaItem {
  id: string;
  question: string;
  answer: string;
  status: TabStatus;
  created_by: string;
  validated_by?: string | null;
  original_system_answer?: string;
  created_at: string;
  updated_at: string;
}

const TAB_OPTIONS: { value: TabStatus; label: string }[] = [
  { value: "pending", label: "Pendientes" },
  { value: "validated", label: "Validados" },
  { value: "rejected", label: "Rechazados" },
];

const PAGE_SIZE = 10;

function notifyPendingCount(count: number) {
  window.dispatchEvent(new CustomEvent("validated-qa-pending-count", { detail: count }));
}

async function fetchPendingCount(): Promise<number> {
  const res = await fetch("/api/admin/validated-qa/pending-count");
  if (!res.ok) return 0;
  const data = (await res.json()) as { pending?: number };
  return data.pending ?? 0;
}

function QaPanelSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Cargando entradas">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="space-y-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-8 w-48" />
        </Card>
      ))}
    </div>
  );
}

function DiffView({ original, proposed }: { original: string; proposed: string }) {
  const [mode, setMode] = useState<"side" | "stack">("side");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="section-label">Comparación original vs propuesta</p>
        <SegmentedControl
          options={[
            { value: "side", label: "Lado a lado" },
            { value: "stack", label: "Apilado" },
          ]}
          value={mode}
          onChange={setMode}
        />
      </div>
      <div className={mode === "side" ? "grid gap-3 sm:grid-cols-2" : "space-y-3"}>
        <div className="rounded-lg border border-stroke-subtle p-3 bg-surface-1/40">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted mb-2">
            Respuesta original
          </p>
          <p className="text-sm text-text-secondary whitespace-pre-wrap">{original}</p>
        </div>
        <div className="rounded-lg border border-status-ok/30 p-3 bg-status-ok/5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-status-ok mb-2">
            Respuesta propuesta
          </p>
          <p className="text-sm text-text-primary whitespace-pre-wrap">{proposed}</p>
        </div>
      </div>
    </div>
  );
}

export function ValidatedQaPanel() {
  const panelIdPrefix = useId();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabStatus>("pending");
  const [items, setItems] = useState<ValidatedQaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [editPreview, setEditPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ValidatedQaItem | null>(null);
  const [diffIds, setDiffIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const searchActive = search.trim().length > 0;

  const loadItems = useCallback(
    async (status: TabStatus, pageOffset: number, signal?: AbortSignal) => {
      setLoading(true);
      try {
        const limit = searchActive ? 200 : PAGE_SIZE;
        const res = await fetch(
          `/api/admin/validated-qa?status=${status}&limit=${limit}&offset=${searchActive ? 0 : pageOffset}`,
          { signal },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Error al cargar");
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        toast(err instanceof Error ? err.message : "Error", "error");
        setItems([]);
        setTotal(0);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [toast, searchActive],
  );

  const refreshPendingCount = useCallback(async () => {
    const count = await fetchPendingCount();
    notifyPendingCount(count);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadItems(tab, offset, controller.signal);
    return () => controller.abort();
  }, [tab, offset, loadItems]);

  useEffect(() => {
    void refreshPendingCount();
  }, [refreshPendingCount]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.question.toLowerCase().includes(q));
  }, [items, search]);

  const displayTotal = searchActive ? filtered.length : total;
  const totalPages = Math.max(1, Math.ceil(displayTotal / PAGE_SIZE));
  const currentPage = searchActive ? Math.floor(offset / PAGE_SIZE) : Math.floor(offset / PAGE_SIZE);
  const pageItems = searchActive
    ? filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
    : filtered;

  function startEdit(item: ValidatedQaItem) {
    setEditingId(item.id);
    setEditQuestion(item.question);
    setEditAnswer(item.answer);
    setEditPreview(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditQuestion("");
    setEditAnswer("");
    setEditPreview(false);
  }

  function toggleDiff(id: string) {
    setDiffIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveEdit(id: string) {
    const question = editQuestion.trim();
    const answer = editAnswer.trim();
    if (!question || !answer) {
      toast("Pregunta y respuesta son obligatorias", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/validated-qa/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error al guardar");
      toast("Cambios guardados", "success");
      cancelEdit();
      await loadItems(tab, offset);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: TabStatus) {
    try {
      const res = await fetch(`/api/admin/validated-qa/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error al actualizar");
      toast(status === "validated" ? "Conocimiento validado" : "Entrada rechazada", "success");
      await loadItems(tab, offset);
      await refreshPendingCount();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error", "error");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/admin/validated-qa/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error al eliminar");
      toast("Entrada eliminada", "success");
      setDeleteTarget(null);
      await loadItems(tab, offset);
      await refreshPendingCount();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error", "error");
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllPage() {
    const pageIds = pageItems.map((item) => item.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function bulkUpdateStatus(status: TabStatus) {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      const ids = [...selectedIds];
      const results = await Promise.all(
        ids.map((id) =>
          fetch(`/api/admin/validated-qa/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          }),
        ),
      );
      if (results.some((r) => !r.ok)) throw new Error("Algunas entradas no se actualizaron");
      toast(
        status === "validated"
          ? `${ids.length} entradas validadas`
          : `${ids.length} entradas rechazadas`,
        "success",
      );
      setSelectedIds(new Set());
      await loadItems(tab, offset);
      await refreshPendingCount();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error en acción masiva", "error");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          options={TAB_OPTIONS}
          value={tab}
          onChange={(v) => {
            setTab(v);
            setOffset(0);
            setSearch("");
            setSelectedIds(new Set());
          }}
          idPrefix={panelIdPrefix}
        />
        {!loading && (
          <span className="text-xs text-text-muted">
            {displayTotal} {displayTotal === 1 ? "entrada" : "entradas"}
          </span>
        )}
      </div>

      <div
        role="tabpanel"
        id={`${panelIdPrefix}-panel-${tab}`}
        aria-labelledby={`${panelIdPrefix}-tab-${tab}`}
        className="space-y-4"
      >
      <div className="relative">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOffset(0);
          }}
          placeholder="Buscar por pregunta…"
          className="input-field pl-9 text-sm w-full"
          aria-label="Buscar por pregunta"
        />
      </div>

      {tab === "pending" && !loading && pageItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-stroke-subtle bg-surface-1/40">
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={pageItems.every((item) => selectedIds.has(item.id))}
              onChange={toggleSelectAllPage}
              aria-label="Seleccionar página actual"
            />
            {selectedIds.size > 0 ? `${selectedIds.size} seleccionadas` : "Seleccionar página"}
          </label>
          {selectedIds.size > 0 && (
            <>
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={bulkBusy}
                onClick={() => void bulkUpdateStatus("validated")}
              >
                Validar seleccionadas
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={bulkBusy}
                onClick={() => void bulkUpdateStatus("rejected")}
              >
                Rechazar seleccionadas
              </button>
            </>
          )}
        </div>
      )}

      {loading && <QaPanelSkeleton />}

      {!loading && pageItems.length === 0 && (
        <Card>
          <EmptyState
            title={
              searchActive
                ? "Sin coincidencias"
                : tab === "pending"
                  ? "Sin correcciones pendientes"
                  : tab === "validated"
                    ? "Sin conocimiento validado"
                    : "Sin entradas rechazadas"
            }
            description={
              searchActive
                ? "Prueba con otros términos de búsqueda."
                : tab === "pending"
                  ? "Las correcciones enviadas desde el chat aparecerán aquí."
                  : "No hay entradas en esta categoría."
            }
          />
        </Card>
      )}

      {!loading &&
        pageItems.map((item) => (
          <Card key={item.id} className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                {tab === "pending" && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => toggleSelected(item.id)}
                    aria-label={`Seleccionar ${item.question}`}
                    className="mt-1"
                  />
                )}
                <Badge variant={tab === "validated" ? "ok" : tab === "rejected" ? "error" : "warn"}>
                {tab === "pending" ? "Pendiente" : tab === "validated" ? "Validado" : "Rechazado"}
              </Badge>
              </div>
              <span className="text-[11px] text-text-muted meta-caption">
                {new Date(item.updated_at).toLocaleString("es-ES")}
              </span>
            </div>

            {editingId === item.id ? (
              <div className="space-y-3">
                <label className="block space-y-1">
                  <span className="section-label">Pregunta</span>
                  <textarea
                    value={editQuestion}
                    onChange={(e) => setEditQuestion(e.target.value)}
                    className="input-field w-full min-h-[72px] text-sm"
                    rows={3}
                  />
                </label>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="section-label">Respuesta propuesta</span>
                    <SegmentedControl
                      options={[
                        { value: "edit", label: "Editar" },
                        { value: "preview", label: "Vista previa" },
                      ]}
                      value={editPreview ? "preview" : "edit"}
                      onChange={(v) => setEditPreview(v === "preview")}
                    />
                  </div>
                  {editPreview ? (
                    <div className="rounded-lg border border-stroke-subtle p-3 min-h-[96px]">
                      <MarkdownContent content={editAnswer || "_Sin contenido_"} className="text-sm" />
                    </div>
                  ) : (
                    <textarea
                      value={editAnswer}
                      onChange={(e) => setEditAnswer(e.target.value)}
                      className="input-field w-full min-h-[96px] text-sm"
                      rows={4}
                    />
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn-ghost btn-sm" onClick={cancelEdit} disabled={saving}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    onClick={() => void saveEdit(item.id)}
                    disabled={saving}
                  >
                    Guardar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <p className="section-label mb-1">Pregunta</p>
                  <p className="text-sm text-text-primary whitespace-pre-wrap">{item.question}</p>
                </div>

                {tab === "pending" && item.original_system_answer && diffIds.has(item.id) ? (
                  <DiffView original={item.original_system_answer} proposed={item.answer} />
                ) : (
                  <div>
                    <p className="section-label mb-1">Respuesta propuesta</p>
                    <p className="text-sm text-text-primary whitespace-pre-wrap">{item.answer}</p>
                  </div>
                )}

                {tab === "pending" && item.original_system_answer && !diffIds.has(item.id) && (
                  <div>
                    <p className="section-label mb-1">Respuesta original del sistema</p>
                    <p className="text-sm text-text-secondary whitespace-pre-wrap line-clamp-4">
                      {item.original_system_answer}
                    </p>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="section-label mb-1">Autor</p>
                    <p className="text-sm text-text-secondary">{item.created_by}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button type="button" className="btn-ghost btn-sm" onClick={() => startEdit(item)}>
                    Editar
                  </button>
                  {tab === "pending" && item.original_system_answer && (
                    <button type="button" className="btn-ghost btn-sm" onClick={() => toggleDiff(item.id)}>
                      {diffIds.has(item.id) ? "Ocultar comparación" : "Comparar"}
                    </button>
                  )}
                  {tab === "pending" && (
                    <>
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        onClick={() => void updateStatus(item.id, "validated")}
                      >
                        Validar
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn-sm text-status-error"
                        onClick={() => void updateStatus(item.id, "rejected")}
                      >
                        Rechazar
                      </button>
                    </>
                  )}
                  {tab === "validated" && (
                    <button
                      type="button"
                      className="btn-ghost btn-sm text-status-error"
                      onClick={() => void updateStatus(item.id, "rejected")}
                    >
                      Rechazar
                    </button>
                  )}
                  {tab === "rejected" && (
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      onClick={() => void updateStatus(item.id, "validated")}
                    >
                      Validar
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-ghost btn-sm text-status-error"
                    onClick={() => setDeleteTarget(item)}
                  >
                    Eliminar
                  </button>
                </div>
              </>
            )}
          </Card>
        ))}

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>
            Página {currentPage + 1} de {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              className="btn-ghost px-2 py-1"
              disabled={currentPage === 0}
              onClick={() => setOffset((currentPage - 1) * PAGE_SIZE)}
            >
              Anterior
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum = i;
              if (totalPages > 7) {
                const start = Math.max(0, Math.min(currentPage - 3, totalPages - 7));
                pageNum = start + i;
              }
              return (
                <button
                  key={pageNum}
                  type="button"
                  className={`btn-ghost px-2 py-1 min-w-[2rem] ${pageNum === currentPage ? "bg-surface-2 text-text-primary" : ""}`}
                  onClick={() => setOffset(pageNum * PAGE_SIZE)}
                  aria-current={pageNum === currentPage ? "page" : undefined}
                >
                  {pageNum + 1}
                </button>
              );
            })}
            <button
              type="button"
              className="btn-ghost px-2 py-1"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setOffset((currentPage + 1) * PAGE_SIZE)}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar entrada"
        message="Esta acción no se puede deshacer. ¿Eliminar este conocimiento validado?"
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
