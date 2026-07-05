"use client";

import Link from "next/link";
import { useState } from "react";
import { IconCheck, IconCopy } from "@/components/ui/Icons";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const digest = error.digest;

  async function copyDigest() {
    if (!digest) return;
    await navigator.clipboard.writeText(digest);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6" role="alert">
      <h1 className="text-2xl font-semibold tracking-tight text-status-error">Algo salió mal</h1>
      <p className="text-text-secondary text-sm mt-2 max-w-sm leading-relaxed">
        No pudimos cargar esta página. Puedes reintentar o ir a otra sección.
      </p>
      {digest && (
        <div className="mt-6 w-full max-w-md surface-card p-3 text-left">
          <p className="section-label mb-2">Referencia para soporte</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono text-text-secondary truncate bg-surface-1 px-2 py-1.5 rounded-md">
              {digest}
            </code>
            <button
              type="button"
              onClick={() => void copyDigest()}
              className="btn-ghost btn-sm shrink-0"
              aria-label={copied ? "Referencia copiada" : "Copiar referencia de error"}
            >
              {copied ? <IconCheck className="w-4 h-4 text-status-ok" /> : <IconCopy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-2 mt-8">
        <button type="button" onClick={reset} className="btn-primary btn-pill">
          Reintentar
        </button>
        <Link href="/" className="btn-secondary btn-pill">
          Inicio
        </Link>
      </div>
      <nav className="flex flex-wrap justify-center gap-4 mt-6 text-sm" aria-label="Accesos rápidos">
        <Link href="/chat" className="text-link hover:underline">
          Chat
        </Link>
        <Link href="/salud" className="text-link hover:underline">
          Salud
        </Link>
        <Link href="/runbooks" className="text-link hover:underline">
          Runbooks
        </Link>
      </nav>
    </div>
  );
}
