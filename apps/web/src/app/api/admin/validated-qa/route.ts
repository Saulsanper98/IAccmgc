import { auth } from "@/auth";
import { apiUserHeaders } from "@/lib/api";
import { NextResponse } from "next/server";

const API_BASE = process.env.INTERNAL_API_URL || "http://api:8000";

export async function GET(request: Request) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ detail: "No autorizado" }, { status: 403 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.toString();
  const suffix = query ? `?${query}` : "";

  const response = await fetch(`${API_BASE}/api/admin/validated-qa${suffix}`, {
    headers: apiUserHeaders(session),
    cache: "no-store",
  });

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
