import type { Metadata } from "next";

import { auth } from "@/auth";

import { redirect } from "next/navigation";

import { getIngestPages, getIngestStatus } from "@/lib/api";
import { lastIngestSyncAt } from "@/lib/format";

import { AdminSectionNav } from "@/components/admin/AdminSectionNav";
import { IngestActions } from "@/components/admin/IngestActions";
import { JobsTable } from "@/components/admin/JobsTable";
import { HealthScanActions } from "@/components/health/HealthScanActions";
import { AdminPagesTable } from "@/components/admin/AdminPagesTable";
import { ValidatedQaPanel } from "@/components/admin/ValidatedQaPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconRefresh } from "@/components/ui/Icons";

export const metadata: Metadata = { title: "Administración" };

export default async function AdminPage() {
  const session = await auth();

  if (!session || session.user.role !== "admin") {
    redirect("/");
  }

  let status = null;
  let pages = null;
  let statusError = null;
  let pagesError = null;

  try {
    status = await getIngestStatus();
  } catch (err) {
    statusError = err instanceof Error ? err.message : "Error desconocido";
  }

  try {
    pages = await getIngestPages(200);
  } catch (err) {
    pagesError = err instanceof Error ? err.message : "Error desconocido";
  }

  const lastSyncAt = lastIngestSyncAt(status);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Administración"
        description="Ingesta desde Wiki.js y sincronización manual."
        breadcrumb={[{ label: "Inicio", href: "/" }, { label: "Admin" }]}
      />

      <AdminSectionNav />

      {statusError && (
        <Card className="border-l-2 border-status-error text-status-error text-sm" role="alert">
          No se pudo cargar el estado de ingesta: {statusError}
        </Card>
      )}

      {status && (
        <section id="admin-stats" className="scroll-mt-24 space-y-4">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-labelledby="admin-stats-heading">
            <h2 id="admin-stats-heading" className="sr-only">
              Estadísticas de ingesta
            </h2>
            <StatCard label="Páginas activas" value={status.pages} />
            <StatCard label="Chunks" value={status.chunks} />
            <StatCard label="Eliminadas" value={status.deleted_pages} />
            <StatCard
              label="Wiki.js"
              value={status.pages > 0 ? "Indexada" : "Vacía"}
              hint={status.pages > 0 ? `${status.pages} páginas` : "Sin sincronizar"}
            />
          </section>

          <section className="grid gap-4 sm:grid-cols-2" aria-labelledby="admin-actions-heading">
            <h2 id="admin-actions-heading" className="sr-only">
              Acciones de administración
            </h2>
            <Card className="flex flex-col justify-between gap-3">
              <span className="text-sm text-text-muted">Wiki</span>
              <IngestActions lastSyncAt={lastSyncAt} />
            </Card>
            <Card className="flex flex-col justify-between gap-3">
              <span className="text-sm text-text-muted">Salud</span>
              <HealthScanActions />
            </Card>
          </section>
        </section>
      )}

      <section id="admin-jobs" className="scroll-mt-24" aria-labelledby="admin-jobs-heading">
        <h2 id="admin-jobs-heading" className="section-label mb-4">
          Trabajos recientes
        </h2>

        {statusError ? (
          <Card className="border-l-2 border-status-warn text-sm text-text-secondary">
            Trabajos no disponibles mientras el estado de ingesta falla.
          </Card>
        ) : status?.recent_jobs?.length > 0 ? (
          <JobsTable jobs={status.recent_jobs} />
        ) : (
          <Card>
            <EmptyState
              icon={<IconRefresh className="w-10 h-10" />}
              title="Sin sincronizaciones"
              description="Ejecuta una sincronización para indexar páginas de Wiki.js."
            />
          </Card>
        )}
      </section>

      <section id="admin-qa" className="scroll-mt-24" aria-labelledby="admin-qa-heading">
        <h2 id="admin-qa-heading" className="section-label mb-4">
          Conocimiento validado
        </h2>

        <ValidatedQaPanel />
      </section>

      <section id="admin-pages" className="scroll-mt-24" aria-labelledby="admin-pages-heading">
        <h2 id="admin-pages-heading" className="section-label mb-4">
          Páginas indexadas {pages ? `(${pages.total})` : ""}
        </h2>

        {pagesError && (
          <Card className="border-l-2 border-status-error text-status-error text-sm" role="alert">
            No se pudo cargar la tabla de páginas: {pagesError}
          </Card>
        )}

        {!pagesError && pages?.items?.length > 0 && (
          <Card padding={false} className="overflow-hidden">
            <AdminPagesTable items={pages.items} total={pages.total} />
          </Card>
        )}

        {!pagesError && pages?.items?.length === 0 && (
          <Card>
            <EmptyState
              icon={<IconRefresh className="w-10 h-10" />}
              title="Sin páginas"
              description="Ejecuta una sincronización para indexar contenido."
            />
          </Card>
        )}
      </section>
    </div>
  );
}
