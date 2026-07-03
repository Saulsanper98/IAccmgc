import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { getConversation, getHealthSummary, getIngestStatus, listConversations, listRunbooks } from "@/lib/api";
import { HealthStatusPanel } from "@/components/health/HealthStatusPanel";
import { Card } from "@/components/ui/Card";
import { IconChevronRight, IconChat, IconHealth, IconRunbook } from "@/components/ui/Icons";

export const metadata: Metadata = { title: "Inicio" };

export default async function HomePage() {
  const session = await auth();
  let stats = { pages: null as number | null, chunks: null as number | null };
  let lastConversation: {
    id: string;
    title: string;
    preview: string | null;
  } | null = null;
  let healthScore: number | null = null;
  let openFindings: number | null = null;
  let runbookCount = 0;
  let lastRunbook: { id: string; title: string } | null = null;

  try {
    const status = await getIngestStatus();
    stats = { pages: status.pages, chunks: status.chunks };
  } catch {
    /* ignore */
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
          /* ignore */
        }
        lastConversation = { id: first.id, title: first.title, preview };
      }
    } catch {
      /* ignore */
    }

    try {
      const runbooks = await listRunbooks(session, "published");
      runbookCount = runbooks.items?.length ?? 0;
      const rb = runbooks.items?.[0];
      if (rb) lastRunbook = { id: rb.id, title: rb.title };
    } catch {
      /* ignore */
    }
  }

  try {
    const health = await getHealthSummary();
    healthScore = health.health_score;
    openFindings = health.open_findings;
  } catch {
    /* ignore */
  }

  const firstName = session?.user.name?.split(" ")[0] ?? "usuario";

  const features = [
    {
      href: "/chat",
      title: "Chat",
      description: "Pregunta a tu documentación con citas a Wiki.js",
      icon: IconChat,
      stat: stats.pages != null ? `${stats.pages} págs indexadas` : null,
    },
    {
      href: "/salud",
      title: "Salud documental",
      description: "Obsolescencia, enlaces rotos y señales de calidad",
      icon: IconHealth,
      stat: healthScore != null ? `Score ${healthScore} · ${openFindings ?? 0} abiertos` : null,
    },
    {
      href: "/runbooks",
      title: "Runbooks",
      description: "Procedimientos ejecutables con trazabilidad",
      icon: IconRunbook,
      stat: runbookCount > 0 ? `${runbookCount} publicados` : null,
    },
  ];

  return (
    <div className="space-y-8 content-column">
      <header className="space-y-4">
        <div>
          <h1 className="page-title">Hola, {firstName}</h1>
          <p className="page-subtitle">
            Conocimiento vivo desde tu wiki — chat, salud documental y runbooks.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/chat" className="btn-primary btn-pill">
            Preguntar a la wiki
          </Link>
          {lastConversation && (
            <Link href={`/chat/${lastConversation.id}`} className="btn-secondary btn-pill">
              Continuar conversación
            </Link>
          )}
        </div>

        {lastConversation?.preview && (
          <Card className="!p-4 max-w-xl">
            <p className="text-xs text-text-muted mb-1">Última conversación · {lastConversation.title}</p>
            <p className="text-sm text-text-secondary line-clamp-2">{lastConversation.preview}</p>
          </Card>
        )}

        {(lastRunbook || stats.pages != null) && (
          <div className="flex flex-wrap gap-3 text-xs">
            {lastRunbook && (
              <Link href={`/runbooks/${lastRunbook.id}/execute`} className="text-link hover:underline">
                Ejecutar «{lastRunbook.title}» →
              </Link>
            )}
            {stats.pages != null && (
              <Link href="/admin" className="text-text-muted hover:text-text-secondary">
                {stats.pages} páginas · {stats.chunks ?? 0} fragmentos
              </Link>
            )}
          </div>
        )}
      </header>

      <section className="space-y-1">
        {features.map((feature) => (
          <Link key={feature.href} href={feature.href} className="block group">
            <Card padding className="list-row surface-card !rounded-lg hover:bg-surface-1/80 transition-colors !p-4 border-stroke-subtle">
              <div className="w-9 h-9 rounded-xl bg-surface-2 flex items-center justify-center text-text-secondary group-hover:text-text-primary transition-colors shrink-0">
                <feature.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-sm font-medium">{feature.title}</h2>
                  {feature.stat && (
                    <span className="text-[10px] text-text-muted tabular-nums">{feature.stat}</span>
                  )}
                </div>
                <p className="text-xs text-text-muted mt-0.5">{feature.description}</p>
              </div>
              <IconChevronRight className="w-4 h-4 text-text-muted group-hover:text-text-secondary shrink-0" />
            </Card>
          </Link>
        ))}
      </section>

      <section>
        <h2 className="section-label mb-3">Estado del sistema</h2>
        <HealthStatusPanel />
      </section>
    </div>
  );
}
