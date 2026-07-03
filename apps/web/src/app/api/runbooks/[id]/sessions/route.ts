import { auth } from "@/auth";
import { apiUserHeaders } from "@/lib/api";
import { NextResponse } from "next/server";

const API_BASE = process.env.INTERNAL_API_URL || "http://api:8000";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ detail: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.text();
  const response = await fetch(`${API_BASE}/api/runbooks/${id}/sessions`, {
    method: "POST",
    headers: apiUserHeaders(session),
    body,
    cache: "no-store",
  });
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
