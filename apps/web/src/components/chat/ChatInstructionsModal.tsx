"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { IconCheck, IconClose, IconSparkles } from "@/components/ui/Icons";
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
  const [savedUserContent, setSavedUserContent] = useState("");
  const [savedTeamContent, setSavedTeamContent] = useState("");

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
      setSavedUserContent(data.user?.content ?? "");
      setSavedTeamContent(data.team?.content ?? "");
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

  const requestClose = useCallback(() => {
    const dirty =
      userContent !== savedUserContent || (isAdmin && teamContent !== savedTeamContent);
    if (dirty) {
      const discard = window.confirm("Hay cambios sin guardar. ¿Cerrar sin guardar?");
      if (!discard) return;
    }
    onClose();
  }, [userContent, savedUserContent, teamContent, savedTeamContent, isAdmin, onClose]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

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
        setSavedUserContent(data.content ?? content);
      } else {
        setTeamMeta({ content: data.content, updated_at: data.updated_at });
        setSavedTeamContent(data.content ?? content);
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
  const showTeamSection = isAdmin || hasTeamInstructions;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-label="Cerrar"
        onClick={requestClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="instructions-title"
        className="relative surface-card-elevated w-full max-w-2xl max-h-[min(90vh,760px)] flex flex-col overflow-hidden animate-toast-in rounded-[var(--radius-xl)]"
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-5 border-b border-stroke-subtle shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-surface-1 border border-stroke-subtle text-text-secondary shrink-0">
              <IconSparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="instructions-title" className="text-lg font-semibold tracking-tight text-text-primary">
                Instrucciones del asistente
              </h2>
              <p className="text-sm text-text-secondary mt-1 leading-relaxed max-w-lg">
                Reglas que WikiBridge recuerda en todas tus conversaciones. Indica páginas, rutas o
                preferencias de respuesta.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-icon shrink-0 -mr-1 -mt-1"
            onClick={requestClose}
            aria-label="Cerrar diálogo"
          >
            <IconClose className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {loading ? (
            <Card padding className="text-sm text-text-muted">
              Cargando instrucciones…
            </Card>
          ) : (
            <>
              {showTeamSection && (
                <InstructionSection
                  id="team-instructions"
                  badge="Equipo"
                  badgeVariant="accent"
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
                  saveLabel="Guardar equipo"
                  saving={saving === "team"}
                  saved={saved === "team"}
                  canSave={isAdmin}
                  onSave={() => void save("team", teamContent)}
                />
              )}

              <InstructionSection
                id="user-instructions"
                badge="Personales"
                badgeVariant="default"
                hint="Solo para tu usuario. Se combinan con las del equipo."
                value={userContent}
                onChange={setUserContent}
                updatedAt={userMeta?.updated_at}
                maxLength={MAX_LENGTH}
                saveLabel="Guardar personales"
                saving={saving === "user"}
                saved={saved === "user"}
                canSave
                onSave={() => void save("user", userContent)}
              />
            </>
          )}

          {error && (
            <p className="text-sm text-status-error px-1" role="alert">
              {error}
            </p>
          )}

          {!loading && (hasUserInstructions || hasTeamInstructions) && (
            <p className="text-xs text-text-muted meta-caption px-1">
              Las instrucciones se aplican en el próximo mensaje que envíes.
            </p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-stroke-subtle flex justify-end shrink-0 bg-surface-1/40">
          <button type="button" className="btn-ghost btn-sm" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function InstructionSection({
  id,
  badge,
  badgeVariant,
  hint,
  value,
  onChange,
  readOnly = false,
  updatedAt,
  maxLength,
  saveLabel,
  saving,
  saved,
  canSave,
  onSave,
}: {
  id: string;
  badge: string;
  badgeVariant: "accent" | "default";
  hint: string;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  updatedAt?: string | null;
  maxLength: number;
  saveLabel: string;
  saving: boolean;
  saved: boolean;
  canSave: boolean;
  onSave: () => void;
}) {
  const overLimit = value.length > maxLength;

  return (
    <Card className="space-y-3 !p-4 sm:!p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-2 min-w-0">
          <Badge variant={badgeVariant}>{badge}</Badge>
          <p className="text-sm text-text-secondary leading-relaxed">{hint}</p>
        </div>
        {updatedAt && (
          <span className="text-[11px] text-text-muted meta-caption shrink-0">
            Actualizado {formatShortDate(updatedAt)}
          </span>
        )}
      </div>

      <label htmlFor={id} className="sr-only">
        {badge}
      </label>
      <textarea
        id={id}
        className={clsx(
          "input-field w-full min-h-[128px] resize-y leading-relaxed",
          readOnly && "opacity-80 cursor-default bg-surface-0",
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

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <span className={clsx("text-xs meta-caption", overLimit ? "text-status-error" : "text-text-muted")}>
          {!updatedAt && !readOnly && "Sin guardar aún · "}
          {value.length}/{maxLength}
        </span>
        {canSave && (
          <button
            type="button"
            className={clsx("btn-primary btn-sm inline-flex items-center gap-1.5", saved && "opacity-90")}
            disabled={saving || overLimit}
            onClick={onSave}
          >
            {saved && <IconCheck className="w-3.5 h-3.5" />}
            {saving ? "Guardando…" : saved ? "Guardado" : saveLabel}
          </button>
        )}
      </div>
    </Card>
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
