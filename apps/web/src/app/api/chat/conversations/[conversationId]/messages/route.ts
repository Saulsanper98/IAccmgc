import { auth } from "@/auth";
import { apiUserHeaders } from "@/lib/api";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API_BASE = process.env.INTERNAL_API_URL || "http://api:8000";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ detail: "No autorizado" }, { status: 401 });
  }

  const { conversationId } = await params;
  const body = await request.json();

  const response = await fetch(
    `${API_BASE}/api/chat/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: apiUserHeaders(session),
      body: JSON.stringify({ content: body.content }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json({ detail: text }, { status: response.status });
  }

  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
