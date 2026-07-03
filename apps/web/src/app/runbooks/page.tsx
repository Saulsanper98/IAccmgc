import type { Metadata } from "next";
import { auth } from "@/auth";
import { getIngestPages, listRunbooks } from "@/lib/api";
import { RunbooksList } from "@/components/runbooks/RunbooksList";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Runbooks" };

export default async function RunbooksPage() {
  const session = await auth();
  if (!session) return null;

  const canEdit = ["admin", "editor"].includes(session.user.role);
  let items: object[] = [];
  let wikiPages: { id: string; title: string; path: string }[] = [];
  let error = null;

  try {
    const [runbooks, pages] = await Promise.all([
      listRunbooks(session),
      canEdit ? getIngestPages(100) : Promise.resolve({ items: [] }),
    ]);
    items = runbooks.items ?? [];
    wikiPages = (pages.items ?? []).map((p: { id: string; title: string; path: string }) => ({
      id: p.id,
      title: p.title,
      path: p.path,
    }));
  } catch (err) {
    error = err instanceof Error ? err.message : "Error";
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Runbooks"
        description="Procedimientos ejecutables paso a paso con trazabilidad."
        breadcrumb={[{ label: "Inicio", href: "/" }, { label: "Runbooks" }]}
      />
      {error && (
        <Card className="border-l-2 border-status-error text-status-error text-sm" role="alert">
          {error}
        </Card>
      )}
      <RunbooksList items={items as never[]} canEdit={canEdit} wikiPages={wikiPages} />
    </div>
  );
}
