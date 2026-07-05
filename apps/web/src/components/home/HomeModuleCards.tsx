"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { IconChevronRight, IconChat, IconHealth, IconRunbook } from "@/components/ui/Icons";

interface ModuleStat {
  chat: string | null;
  health: string | null;
  runbooks: string | null;
}

const POLL_MS = 60_000;

const modules = [
  {
    key: "chat" as const,
    href: "/chat",
    title: "Chat",
    description: "Pregunta a tu documentación con citas a Wiki.js",
    icon: IconChat,
  },
  {
    key: "health" as const,
    href: "/salud",
    title: "Salud documental",
    description: "Obsolescencia, enlaces rotos y señales de calidad",
    icon: IconHealth,
  },
  {
    key: "runbooks" as const,
    href: "/runbooks",
    title: "Runbooks",
    description: "Procedimientos ejecutables con trazabilidad",
    icon: IconRunbook,
  },
];

export function HomeModuleCards({
  initialStats,
}: {
  initialStats: ModuleStat;
}) {
  const [stats, setStats] = useState(initialStats);

  useEffect(() => {
    async function refresh() {
      try {
        const statsRes = await fetch("/api/stats").then((r) => (r.ok ? r.json() : null));
        if (!statsRes) return;

        setStats({
          chat: statsRes.pages != null ? `${statsRes.pages} págs indexadas` : initialStats.chat,
          health:
            statsRes.health_score != null
              ? `Score ${statsRes.health_score} · ${statsRes.open_findings ?? 0} abiertos`
              : initialStats.health,
          runbooks:
            statsRes.runbook_count != null && statsRes.runbook_count > 0
              ? `${statsRes.runbook_count} publicados`
              : initialStats.runbooks,
        });
      } catch {
        /* keep previous */
      }
    }

    const interval = window.setInterval(refresh, POLL_MS);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className="space-y-1" aria-labelledby="home-modules-heading">
      <h2 id="home-modules-heading" className="section-label">
        Módulos
      </h2>
      {modules.map((feature) => (
        <Link key={feature.href} href={feature.href} className="block group">
          <Card
            padding
            className="list-row surface-card !rounded-lg hover:bg-surface-1/80 transition-colors !p-3 border-stroke-subtle"
          >
            <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center text-text-secondary group-hover:text-text-primary transition-colors shrink-0">
              <feature.icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <h3 className="text-sm font-medium">{feature.title}</h3>
                {stats[feature.key] && (
                  <span className="meta-caption tabular-nums">{stats[feature.key]}</span>
                )}
              </div>
              <p className="text-xs text-text-muted mt-0.5">{feature.description}</p>
            </div>
            <IconChevronRight className="w-4 h-4 text-text-muted group-hover:text-text-secondary shrink-0" />
          </Card>
        </Link>
      ))}
    </section>
  );
}
