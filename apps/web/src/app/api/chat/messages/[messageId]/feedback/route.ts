import { auth } from "@/auth";
import { apiUserHeaders } from "@/lib/api";
import { NextResponse } from "next/server";

const API_BASE = process.env.INTERNAL_API_URL || "http://api:8000";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ detail: "No autorizado" }, { status: 401 });
  }

  const { messageId } = await params;
  const body = await request.json();

  const response = await fetch(`${API_BASE}/api/chat/messages/${messageId}/feedback`, {
    method: "POST",
    headers: apiUserHeaders(session),
    body: JSON.stringify(body),
  });

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
