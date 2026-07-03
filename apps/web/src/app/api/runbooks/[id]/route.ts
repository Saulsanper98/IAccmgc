import { auth } from "@/auth";
import { apiUserHeaders } from "@/lib/api";
import { NextResponse } from "next/server";

const API_BASE = process.env.INTERNAL_API_URL || "http://api:8000";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session || !["admin", "editor"].includes(session.user.role)) {
    return NextResponse.json({ detail: "No autorizado" }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.text();
  const response = await fetch(`${API_BASE}/api/runbooks/${id}`, {
    method: "PATCH",
    headers: apiUserHeaders(session),
    body,
    cache: "no-store",
  });
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
