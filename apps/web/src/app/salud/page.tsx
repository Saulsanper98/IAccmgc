import type { Metadata } from "next";

import { auth } from "@/auth";

import { getHealthFindings, getHealthSummary } from "@/lib/api";

import { FindingsPanel } from "@/components/health/FindingsPanel";

import { HealthScanActions } from "@/components/health/HealthScanActions";

import { HealthScanProgress } from "@/components/health/HealthScanProgress";

import { HealthScanPoller } from "@/components/health/HealthScanPoller";

import { ScoreRing } from "@/components/health/ScoreRing";

import { PageHeader } from "@/components/ui/PageHeader";

import { StatCard } from "@/components/ui/StatCard";

import { Card } from "@/components/ui/Card";



export const metadata: Metadata = { title: "Salud documental" };



export default async function SaludPage() {

  const session = await auth();

  const isAdmin = session?.user.role === "admin";



  let summary = null;

  let findings = null;

  let summaryError = null;

  let findingsError = null;



  try {

    summary = await getHealthSummary();

  } catch (err) {

    summaryError = err instanceof Error ? err.message : "Error desconocido";

  }



  try {

    findings = await getHealthFindings({ limit: 100 });

  } catch (err) {

    findingsError = err instanceof Error ? err.message : "Error desconocido";

  }



  const scanActive = summary?.scan_in_progress ?? false;



  return (

    <div className="space-y-8">

      <HealthScanPoller active={scanActive} />



      <PageHeader

        title="Salud documental"

        description="Obsolescencia, enlaces rotos, páginas huérfanas y señales de uso."

        breadcrumb={[{ label: "Inicio", href: "/" }, { label: "Salud" }]}

        actions={isAdmin ? <HealthScanActions scanInProgress={scanActive} /> : undefined}

      />



      {summaryError && (

        <Card className="border-l-2 border-status-error text-status-error text-sm" role="alert">

          No se pudo cargar el resumen: {summaryError}

        </Card>

      )}



      {summary && (

        <HealthScanProgress scanInProgress={scanActive} recentScans={summary.recent_scans ?? []} />

      )}



      {summary && (

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <Card className="sm:col-span-2 lg:col-span-1 flex items-center">

            <ScoreRing score={summary.health_score} />

          </Card>

          <StatCard label="Abiertos" value={summary.open_findings} />

          <StatCard label="Críticos" value={summary.by_severity?.critical ?? 0} />

          <StatCard label="Advertencias" value={summary.by_severity?.warn ?? 0} />

        </section>

      )}



      <section>

        <h2 className="section-label mb-4">Hallazgos prioritarios</h2>

        {findingsError && (

          <Card className="border-l-2 border-status-error text-status-error text-sm mb-4" role="alert">

            No se pudieron cargar los hallazgos: {findingsError}

          </Card>

        )}

        {!findingsError && (

          <FindingsPanel

            items={findings?.items ?? []}

            scanInProgress={scanActive}

            byDetector={summary?.by_detector}

            isAdmin={isAdmin}

          />

        )}

      </section>

    </div>

  );

}

