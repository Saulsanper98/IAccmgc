import { auth } from "@/auth";
import { getIngestStatus } from "@/lib/api";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ detail: "No autorizado" }, { status: 401 });
  }

  try {
    const status = await getIngestStatus();
    return NextResponse.json({
      pages: status.pages,
      chunks: status.chunks,
    });
  } catch {
    return NextResponse.json({ pages: null, chunks: null });
  }
}
