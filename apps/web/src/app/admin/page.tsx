import type { Metadata } from "next";

import { auth } from "@/auth";

import { redirect } from "next/navigation";

import { getIngestPages, getIngestStatus } from "@/lib/api";

import { IngestActions } from "@/components/admin/IngestActions";

import { JobsTable } from "@/components/admin/JobsTable";

import { HealthScanActions } from "@/components/health/HealthScanActions";

import { AdminPagesTable } from "@/components/admin/AdminPagesTable";

import { PageHeader } from "@/components/ui/PageHeader";

import { StatCard } from "@/components/ui/StatCard";

import { Card } from "@/components/ui/Card";

import { EmptyState } from "@/components/ui/EmptyState";



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



  return (

    <div className="space-y-8">

      <PageHeader

        title="Administración"

        description="Ingesta desde Wiki.js y sincronización manual."

        breadcrumb={[{ label: "Inicio", href: "/" }, { label: "Admin" }]}

      />



      {statusError && (

        <Card className="border-l-2 border-status-error text-status-error text-sm" role="alert">

          No se pudo cargar el estado de ingesta: {statusError}

        </Card>

      )}



      {status && (

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <StatCard label="Páginas activas" value={status.pages} />

          <StatCard label="Chunks" value={status.chunks} />

          <StatCard label="Eliminadas" value={status.deleted_pages} />

          <Card className="sm:col-span-2 lg:col-span-1 flex flex-col justify-between gap-3">

            <span className="text-sm text-text-muted">Wiki</span>

            <IngestActions />

          </Card>

          <Card className="sm:col-span-2 lg:col-span-1 flex flex-col justify-between gap-3">

            <span className="text-sm text-text-muted">Salud</span>

            <HealthScanActions />

          </Card>

        </section>

      )}



      <section>

        <h2 className="section-label mb-4">Trabajos recientes</h2>

        {statusError ? (

          <Card className="border-l-2 border-status-warn text-sm text-text-secondary">

            Trabajos no disponibles mientras el estado de ingesta falla.

          </Card>

        ) : status?.recent_jobs?.length > 0 ? (

          <JobsTable jobs={status.recent_jobs} />

        ) : (

          <Card>

            <EmptyState

              title="Sin sincronizaciones"

              description="Ejecuta una sincronización para indexar páginas de Wiki.js."

            />

          </Card>

        )}

      </section>



      <section>

        <h2 className="section-label mb-4">

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

            <EmptyState title="Sin páginas" description="Ejecuta una sincronización para indexar contenido." />

          </Card>

        )}

      </section>

    </div>

  );

}

