import { auth } from "@/auth";
import { apiUserHeaders } from "@/lib/api";
import { NextResponse } from "next/server";

const API_BASE = process.env.INTERNAL_API_URL || "http://api:8000";
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || "dev-internal-token";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ findingId: string }> },
) {
  const session = await auth();
  if (!session || !["admin", "editor"].includes(session.user.role)) {
    return NextResponse.json({ detail: "No autorizado" }, { status: 403 });
  }

  const { findingId } = await params;
  const body = await request.json();
  const response = await fetch(`${API_BASE}/api/health/findings/${findingId}`, {
    method: "PATCH",
    headers: apiUserHeaders(session),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
