import { auth } from "@/auth";
import { apiUserHeaders, getChatInstructions } from "@/lib/api";
import { NextResponse } from "next/server";

const API_BASE = process.env.INTERNAL_API_URL || "http://api:8000";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ detail: "No autorizado" }, { status: 401 });
  }

  try {
    const result = await getChatInstructions(session);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ detail: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const scope = body?.scope as string | undefined;
    const content = typeof body?.content === "string" ? body.content : "";

    if (scope !== "user" && scope !== "team") {
      return NextResponse.json({ detail: "scope debe ser 'user' o 'team'" }, { status: 400 });
    }

    const path = scope === "team" ? "/chat/instructions/team" : "/chat/instructions/user";
    const response = await fetch(`${API_BASE}/api${path}`, {
      method: "PUT",
      headers: apiUserHeaders(session),
      body: JSON.stringify({ content }),
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { detail: data.detail || "Error al guardar" },
        { status: response.status },
      );
    }
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
