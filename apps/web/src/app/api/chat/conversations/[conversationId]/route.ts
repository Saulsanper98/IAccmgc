import { auth } from "@/auth";
import { apiUserHeaders } from "@/lib/api";
import { NextResponse } from "next/server";

const API_BASE = process.env.INTERNAL_API_URL || "http://api:8000";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ detail: "No autorizado" }, { status: 401 });
  }

  const { conversationId } = await params;
  const response = await fetch(`${API_BASE}/api/chat/conversations/${conversationId}`, {
    headers: apiUserHeaders(session),
    cache: "no-store",
  });

  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ detail: "No autorizado" }, { status: 401 });
  }

  const { conversationId } = await params;
  const body = await request.json();

  const response = await fetch(`${API_BASE}/api/chat/conversations/${conversationId}`, {
    method: "PATCH",
    headers: apiUserHeaders(session),
    body: JSON.stringify(body),
  });

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ detail: "No autorizado" }, { status: 401 });
  }

  const { conversationId } = await params;
  const response = await fetch(`${API_BASE}/api/chat/conversations/${conversationId}`, {
    method: "DELETE",
    headers: apiUserHeaders(session),
  });

  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
