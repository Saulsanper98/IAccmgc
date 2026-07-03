import { auth } from "@/auth";
import { apiUserHeaders } from "@/lib/api";
import { NextResponse } from "next/server";

const API_BASE = process.env.INTERNAL_API_URL || "http://api:8000";

async function proxy(request: Request, path: string, method: string, body?: string) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ detail: "No autorizado" }, { status: 401 });
  }
  const response = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers: {
      ...apiUserHeaders(session),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body,
    cache: "no-store",
  });
  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session || !["admin", "editor"].includes(session.user.role)) {
    return NextResponse.json({ detail: "No autorizado" }, { status: 403 });
  }
  const body = await request.text();
  return proxy(request, "/runbooks/from-page", "POST", body);
}
