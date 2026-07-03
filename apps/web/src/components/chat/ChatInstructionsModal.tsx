"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconCheck, IconSparkles } from "@/components/ui/Icons";
import clsx from "clsx";

const MAX_LENGTH = 4000;

interface InstructionBlock {
  content: string;
  updated_at: string | null;
}

interface ChatInstructionsModalProps {
  open: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

export function ChatInstructionsModal({ open, onClose, isAdmin = false }: ChatInstructionsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<"user" | "team" | null>(null);
  const [saved, setSaved] = useState<"user" | "team" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userContent, setUserContent] = useState("");
  const [teamContent, setTeamContent] = useState("");
  const [userMeta, setUserMeta] = useState<InstructionBlock | null>(null);
  const [teamMeta, setTeamMeta] = useState<InstructionBlock | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/instructions");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "No se pudieron cargar las instrucciones");
      }
      const data = await res.json();
      setUserContent(data.user?.content ?? "");
      setTeamContent(data.team?.content ?? "");
      setUserMeta(data.user ?? null);
      setTeamMeta(data.team ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (saved === null) return;
    const t = window.setTimeout(() => setSaved(null), 2000);
    return () => window.clearTimeout(t);
  }, [saved]);

  async function save(scope: "user" | "team", content: string) {
    setSaving(scope);
    setError(null);
    try {
      const res = await fetch("/api/chat/instructions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Error al guardar");
      }
      const data = await res.json();
      if (scope === "user") {
        setUserMeta({ content: data.content, updated_at: data.updated_at });
      } else {
        setTeamMeta({ content: data.content, updated_at: data.updated_at });
      }
      setSaved(scope);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(null);
    }
  }

  if (!open) return null;

  const hasUserInstructions = userContent.trim().length > 0;
  const hasTeamInstructions = teamContent.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="instructions-title"
        className="relative surface-card-elevated w-full max-w-lg max-h-[min(90vh,720px)] flex flex-col overflow-hidden"
      >
        <div className="px-6 pt-6 pb-4 border-b border-stroke-subtle shrink-0">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-surface-2 text-text-secondary shrink-0">
              <IconSparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="instructions-title" className="text-lg font-semibold tracking-tight">
                Instrucciones del asistente
              </h2>
              <p className="text-sm text-text-secondary mt-1 leading-relaxed">
                Reglas que WikiBridge recuerda en todas tus conversaciones. Úsalas para indicar
                páginas, rutas o preferencias de respuesta.
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {loading ? (
            <p className="text-sm text-text-muted">Cargando…</p>
          ) : (
            <>
              {(isAdmin || hasTeamInstructions) && (
                <InstructionField
                  id="team-instructions"
                  label="Equipo"
                  hint={
                    isAdmin
                      ? "Visible para todos. Ideal para reglas compartidas (p. ej. Power BI → Web CCMGC)."
                      : "Reglas definidas por el administrador para todo el equipo."
                  }
                  value={teamContent}
                  onChange={setTeamContent}
                  readOnly={!isAdmin}
                  updatedAt={teamMeta?.updated_at}
                  maxLength={MAX_LENGTH}
                />
              )}

              <InstructionField
                id="user-instructions"
                label="Personales"
                hint="Solo para tu usuario. Se combinan con las del equipo."
                value={userContent}
                onChange={setUserContent}
                updatedAt={userMeta?.updated_at}
                maxLength={MAX_LENGTH}
              />
            </>
          )}

          {error && (
            <p className="text-sm text-status-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-stroke-subtle flex flex-wrap items-center justify-end gap-2 shrink-0">
          <button type="button" className="btn-ghost btn-sm" onClick={onClose}>
            Cerrar
          </button>
          {isAdmin && !loading && (
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={saving !== null || teamContent.length > MAX_LENGTH}
              onClick={() => void save("team", teamContent)}
            >
              {saving === "team" ? "Guardando…" : saved === "team" ? "Guardado" : "Guardar equipo"}
            </button>
          )}
          {!loading && (
            <button
              type="button"
              className={clsx("btn-primary btn-sm inline-flex items-center gap-1.5", {
                "opacity-80": saved === "user",
              })}
              disabled={saving !== null || userContent.length > MAX_LENGTH}
              onClick={() => void save("user", userContent)}
            >
              {saved === "user" && <IconCheck className="w-3.5 h-3.5" />}
              {saving === "user" ? "Guardando…" : saved === "user" ? "Guardado" : "Guardar personales"}
            </button>
          )}
        </div>

        {!loading && (hasUserInstructions || hasTeamInstructions) && (
          <p className="px-6 pb-4 text-xs text-text-muted -mt-2">
            Las instrucciones se aplican en el próximo mensaje que envíes.
          </p>
        )}
      </div>
    </div>
  );
}

function InstructionField({
  id,
  label,
  hint,
  value,
  onChange,
  readOnly = false,
  updatedAt,
  maxLength,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  updatedAt?: string | null;
  maxLength: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <p className="text-xs text-text-muted mt-0.5 mb-2">{hint}</p>
      <textarea
        id={id}
        className={clsx(
          "input w-full min-h-[120px] resize-y text-sm leading-relaxed",
          readOnly && "opacity-70 cursor-default",
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        maxLength={maxLength}
        placeholder={
          readOnly
            ? "Sin instrucciones de equipo definidas."
            : "Ej.: Cuando pregunten por Power BI en la web, prioriza la página «Web CCMGC»."
        }
      />
      <div className="flex justify-between mt-1.5 text-xs text-text-muted">
        <span>{updatedAt ? `Actualizado ${formatShortDate(updatedAt)}` : "Sin guardar aún"}</span>
        <span>
          {value.length}/{maxLength}
        </span>
      </div>
    </div>
  );
}

function formatShortDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
