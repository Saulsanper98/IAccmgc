import { auth } from "@/auth";
import { apiUserHeaders } from "@/lib/api";
import { NextResponse } from "next/server";

const API_BASE = process.env.INTERNAL_API_URL || "http://api:8000";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ detail: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const response = await fetch(`${API_BASE}/api/admin/validated-qa/${id}`, {
    method: "PUT",
    headers: {
      ...apiUserHeaders(session),
      "Content-Type": "application/json",
    },
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
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ detail: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  const response = await fetch(`${API_BASE}/api/admin/validated-qa/${id}`, {
    method: "DELETE",
    headers: apiUserHeaders(session),
  });

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
