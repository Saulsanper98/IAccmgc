"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastProvider";

export function IngestActions() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmFull, setConfirmFull] = useState(false);

  async function runSync(type: "full" | "incremental") {
    setLoading(type);
    try {
      const response = await fetch("/api/admin/ingest/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Error al lanzar sincronización");
      }
      toast(`Trabajo ${type} encolado`, "success");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error desconocido", "error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <div className="space-y-2 mt-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={!!loading}
            onClick={() => runSync("incremental")}
          >
            {loading === "incremental" ? "Encolando…" : "Sync incremental"}
          </button>
          <button
            type="button"
            className="btn-ghost text-sm"
            disabled={!!loading}
            onClick={() => setConfirmFull(true)}
          >
            {loading === "full" ? "Encolando…" : "Sync completo"}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmFull}
        title="Sincronización completa"
        message="Reindexará todas las páginas de Wiki.js. Puede tardar varios minutos y consumir CPU/RAM."
        confirmLabel="Iniciar sync completo"
        variant="danger"
        onConfirm={() => {
          setConfirmFull(false);
          void runSync("full");
        }}
        onCancel={() => setConfirmFull(false)}
      />
    </>
  );
}
