"use client";

import Link from "next/link";
import type { UsedValidatedQa } from "@/lib/chat-types";

function formatValidatedDate(meta: UsedValidatedQa): string {
  const raw = meta.validated_at ?? meta.validated_date;
  if (!raw) return "";
  const date = raw.includes("T") ? new Date(raw) : new Date(`${raw}T12:00:00`);
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ValidatedQaBadge({ items }: { items: UsedValidatedQa[] }) {
  const first = items[0];
  if (!first) return null;
  const dateLabel = formatValidatedDate(first);
  if (!dateLabel) return null;

  const countLabel = items.length > 1 ? ` · ${items.length} respuestas validadas` : "";

  return (
    <p className="text-[11px] text-status-ok mt-3 meta-caption" role="status">
      ✓ Respuesta validada por el equipo · {dateLabel}
      {countLabel}
      {" · "}
      <Link href="/admin" className="text-link hover:underline">
        Admin
      </Link>
    </p>
  );
}
