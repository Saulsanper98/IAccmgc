"use client";



import Link from "next/link";

import { useRouter } from "next/navigation";

import { useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";

import { Card } from "@/components/ui/Card";

import { WikiPageCombobox } from "@/components/ui/WikiPageCombobox";

import { RunbookStatusBadge } from "@/components/ui/Badge";

import { useToast } from "@/components/ui/ToastProvider";



export interface RunbookItem {

  id: string;

  title: string;

  description: string;

  status: string;

  version: number;

  step_count: number;

  updated_at: string | null;

}



function formatVersionMeta(version: number, stepCount: number) {

  return `v${version} · ${stepCount} pasos`;

}



export function RunbooksList({

  items,

  canEdit,

  wikiPages,

}: {

  items: RunbookItem[];

  canEdit: boolean;

  wikiPages: { id: string; title: string; path: string }[];

}) {

  const router = useRouter();

  const { toast } = useToast();

  const [pageId, setPageId] = useState("");

  const [loading, setLoading] = useState(false);



  async function createFromPage() {

    if (!pageId) return;

    setLoading(true);

    try {

      const response = await fetch("/api/runbooks/from-page", {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ page_id: pageId }),

      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.detail || "Error");

      toast("Runbook creado en borrador", "success");

      router.push(`/runbooks/${data.id}`);

    } catch (err) {

      toast(err instanceof Error ? err.message : "Error", "error");

    } finally {

      setLoading(false);

    }

  }



  return (

    <div className="space-y-6">

      {canEdit && wikiPages.length > 0 && (

        <Card className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">

          <div className="flex-1 w-full">

            <WikiPageCombobox

              pages={wikiPages}

              value={pageId}

              onChange={setPageId}

              label="Convertir página wiki en runbook"

              disabled={loading}

            />

          </div>

          <button

            type="button"

            onClick={createFromPage}

            disabled={!pageId || loading}

            className="btn-primary text-sm shrink-0"

          >

            {loading ? "Generando…" : "Generar borrador"}

          </button>

        </Card>

      )}



      {items.length === 0 ? (

        <Card>

          <EmptyState

            title="Sin runbooks"

            description="Genera uno desde una página de la wiki para empezar."

          />

        </Card>

      ) : (

        <div className="space-y-2">

          {items.map((rb) => (

            <Link

              key={rb.id}

              href={`/runbooks/${rb.id}`}

              className="list-row surface-card !rounded-lg hover:bg-surface-2/80 block"

            >

              <div className="flex-1 min-w-0">

                <h3 className="font-medium text-sm truncate">{rb.title}</h3>

                <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{rb.description}</p>

              </div>

              <RunbookStatusBadge status={rb.status} />

              <span className="text-xs text-text-muted shrink-0 tabular-nums">

                {formatVersionMeta(rb.version, rb.step_count)}

              </span>

            </Link>

          ))}

        </div>

      )}

    </div>

  );

}

