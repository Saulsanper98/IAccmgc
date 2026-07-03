import { auth } from "@/auth";
import { createConversation, listConversations } from "@/lib/api";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ detail: "No autorizado" }, { status: 401 });
  }

  try {
    const result = await listConversations(session);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}

export async function POST() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ detail: "No autorizado" }, { status: 401 });
  }

  try {
    const result = await createConversation(session);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
