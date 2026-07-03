import { auth } from "@/auth";
import { triggerIngestSync } from "@/lib/api";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ detail: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const type = body.type === "full" ? "full" : "incremental";

  try {
    const result = await triggerIngestSync(type);
    return NextResponse.json(result);
  } catch (err) {
    let message = err instanceof Error ? err.message : "Error desconocido";
    try {
      const parsed = JSON.parse(message);
      if (parsed.detail) message = parsed.detail;
    } catch {
      // keep raw message
    }
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
