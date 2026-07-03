import { auth } from "@/auth";
import { triggerHealthScan } from "@/lib/api";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ detail: "No autorizado" }, { status: 403 });
  }
  try {
    const result = await triggerHealthScan(session);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
