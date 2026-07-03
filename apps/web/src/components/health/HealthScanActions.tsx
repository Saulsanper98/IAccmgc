"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";

export function HealthScanActions({ scanInProgress = false }: { scanInProgress?: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function runScan() {
    setLoading(true);
    try {
      const response = await fetch("/api/health/scan", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Error al lanzar análisis");
      toast("Análisis encolado — puede tardar varios minutos", "success");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={runScan}
      disabled={loading || scanInProgress}
      className="btn-primary text-sm"
    >
      {loading ? "Encolando…" : scanInProgress ? "Análisis en curso…" : "Ejecutar análisis"}
    </button>
  );
}
