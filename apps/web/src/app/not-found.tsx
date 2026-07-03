import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <p className="text-sm font-medium text-text-muted">404</p>
      <h1 className="text-2xl font-semibold tracking-tight mt-2">Página no encontrada</h1>
      <p className="text-text-secondary text-sm mt-2 max-w-sm leading-relaxed">
        La ruta no existe o no tienes permiso para verla.
      </p>
      <div className="flex flex-wrap justify-center gap-3 mt-8">
        <Link href="/chat" className="btn-primary btn-pill">
          Ir al Chat
        </Link>
        <Link href="/salud" className="btn-secondary btn-pill">
          Salud
        </Link>
        <Link href="/runbooks" className="btn-secondary btn-pill">
          Runbooks
        </Link>
      </div>
    </div>
  );
}
