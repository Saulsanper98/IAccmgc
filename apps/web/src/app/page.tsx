import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { getConversation, getHealthSummary, getIngestStatus, listConversations, listRunbooks } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { HealthStatusPanel } from "@/components/health/HealthStatusPanel";
import { HomeQuickSearch } from "@/components/home/HomeQuickSearch";
import { HomeModuleCards } from "@/components/home/HomeModuleCards";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Inicio" };

type LoadError = { label: string; message: string };

export default async function HomePage() {
  const session = await auth();
  let stats = { pages: null as number | null, chunks: null as number | null };
  let lastConversation: {
    id: string;
    title: string;
    preview: string | null;
    updatedAt: string;
  } | null = null;
  let healthScore: number | null = null;
  let openFindings: number | null = null;
  let runbookCount = 0;
  let lastRunbook: { id: string; title: string } | null = null;
  const errors: LoadError[] = [];

  try {
    const status = await getIngestStatus();
    stats = { pages: status.pages, chunks: status.chunks };
  } catch {
    errors.push({ label: "Ingesta", message: "No se pudieron cargar las estadísticas de indexación." });
  }

  if (session) {
    try {
      const convs = await listConversations(session);
      const first = convs.items?.[0];
      if (first) {
        let preview: string | null = null;
        try {
          const detail = await getConversation(session, first.id);
          const lastMsg = [...(detail.messages ?? [])].reverse().find((m) => m.role === "user" || m.role === "assistant");
          preview = lastMsg?.content?.slice(0, 120) ?? null;
        } catch {
          /* ignore preview */
        }
        lastConversation = {
          id: first.id,
          title: first.title,
          preview,
          updatedAt: first.updated_at,
        };
      }
    } catch {
      errors.push({ label: "Chat", message: "No se pudieron cargar las conversaciones recientes." });
    }

    try {
      const runbooks = await listRunbooks(session, "published");
      runbookCount = runbooks.items?.length ?? 0;
      const rb = runbooks.items?.[0];
      if (rb) lastRunbook = { id: rb.id, title: rb.title };
    } catch {
      errors.push({ label: "Runbooks", message: "No se pudo cargar la lista de runbooks." });
    }
  }

  try {
    const health = await getHealthSummary();
    healthScore = health.health_score;
    openFindings = health.open_findings;
  } catch {
    errors.push({ label: "Salud", message: "No se pudo cargar el resumen de salud documental." });
  }

  const firstName = session?.user.name?.split(" ")[0] ?? "usuario";
  const isAdmin = session?.user.role === "admin";

  const moduleStats = {
    chat: stats.pages != null ? `${stats.pages} págs indexadas` : null,
    health:
      healthScore != null ? `Score ${healthScore} · ${openFindings ?? 0} abiertos` : null,
    runbooks: runbookCount > 0 ? `${runbookCount} publicados` : null,
  };

  return (
    <div className="space-y-6 content-column">
      <header className="space-y-3" aria-labelledby="home-heading">
        <div>
          <h1 id="home-heading" className="page-title">
            Hola, {firstName}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Chat, salud documental y runbooks desde tu wiki.
          </p>
        </div>

        {session && <HomeQuickSearch />}

        <div className="flex flex-wrap gap-2">
          <Link href="/chat" className="btn-primary btn-sm btn-pill">
            Preguntar a la wiki
          </Link>
          {lastConversation && (
            <Link href={`/chat/${lastConversation.id}`} className="btn-secondary btn-sm btn-pill">
              Continuar conversación
            </Link>
          )}
        </div>

        {errors.length > 0 && (
          <div className="grid gap-2 max-w-xl" role="alert">
            {errors.map((err) => (
              <Card key={err.label} className="!p-3 border-status-error/30 bg-status-error/5">
                <p className="text-sm font-medium text-status-error">{err.label}</p>
                <p className="text-xs text-text-secondary mt-0.5">{err.message}</p>
              </Card>
            ))}
          </div>
        )}

        {lastConversation && (
          <Card className="!p-3 max-w-xl">
            <p className="meta-caption mb-1">
              Última conversación · {lastConversation.title} · {formatRelativeTime(lastConversation.updatedAt)}
            </p>
            {lastConversation.preview && (
              <p className="text-sm text-text-secondary line-clamp-2">{lastConversation.preview}</p>
            )}
          </Card>
        )}

        {(lastRunbook || stats.pages != null) && (
          <div className="flex flex-wrap gap-3 meta-caption">
            {lastRunbook && (
              <Link href={`/runbooks/${lastRunbook.id}/execute`} className="text-link hover:underline">
                Ejecutar «{lastRunbook.title}» →
              </Link>
            )}
            {stats.pages != null && isAdmin && (
              <Link href="/admin" className="text-text-muted hover:text-text-secondary">
                {stats.pages} páginas · {stats.chunks ?? 0} fragmentos
              </Link>
            )}
          </div>
        )}
      </header>

      <HomeModuleCards initialStats={moduleStats} />

      <section aria-labelledby="home-status-heading">
        <h2 id="home-status-heading" className="section-label mb-3">
          Estado del sistema
        </h2>
        <HealthStatusPanel />
      </section>
    </div>
  );
}
