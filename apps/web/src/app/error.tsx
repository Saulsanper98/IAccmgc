"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6" role="alert">
      <h1 className="text-2xl font-semibold tracking-tight text-status-error">Algo salió mal</h1>
      <p className="text-text-secondary text-sm mt-2 max-w-sm leading-relaxed">
        No pudimos cargar esta página. Puedes reintentar o volver al inicio.
      </p>
      <button type="button" onClick={reset} className="btn-primary btn-pill mt-8">
        Reintentar
      </button>
    </div>
  );
}
