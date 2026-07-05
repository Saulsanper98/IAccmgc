import { auth } from "@/auth";
import { getHealthSummary, getIngestStatus, listRunbooks } from "@/lib/api";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ detail: "No autorizado" }, { status: 401 });
  }

  try {
    const status = await getIngestStatus();
    let healthScore: number | null = null;
    let openFindings: number | null = null;
    let runbookCount: number | null = null;

    try {
      const health = await getHealthSummary();
      healthScore = health.health_score ?? null;
      openFindings = health.open_findings ?? null;
    } catch {
      /* optional */
    }

    try {
      const runbooks = await listRunbooks(session, "published");
      runbookCount = runbooks.items?.length ?? 0;
    } catch {
      /* optional */
    }

    return NextResponse.json({
      pages: status.pages,
      chunks: status.chunks,
      health_score: healthScore,
      open_findings: openFindings,
      runbook_count: runbookCount,
    });
  } catch {
    return NextResponse.json({
      pages: null,
      chunks: null,
      health_score: null,
      open_findings: null,
      runbook_count: null,
    });
  }
}
