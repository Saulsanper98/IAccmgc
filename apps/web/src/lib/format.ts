export function formatLatency(ms: number | null | undefined): string {
  if (ms == null) return "";
  if (ms < 1000) return `${ms} ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return rem > 0 ? `${minutes} min ${rem} s` : `${minutes} min`;
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export type DateGroup = "today" | "yesterday" | "week" | "older";

export function getDateGroup(iso: string): DateGroup {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  if (date >= startOfToday) return "today";
  if (date >= startOfYesterday) return "yesterday";
  if (date >= startOfWeek) return "week";
  return "older";
}

export const DATE_GROUP_LABELS: Record<DateGroup, string> = {
  today: "Hoy",
  yesterday: "Ayer",
  week: "Esta semana",
  older: "Anteriores",
};

export function friendlyError(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { detail?: string | { msg?: string }[] };
    if (typeof parsed.detail === "string") return parsed.detail;
    if (Array.isArray(parsed.detail)) {
      return parsed.detail.map((d) => d.msg ?? "Error").join(". ");
    }
  } catch {
    /* plain text */
  }
  if (raw.length > 200) return "Ha ocurrido un error. Inténtalo de nuevo.";
  return raw || "Ha ocurrido un error. Inténtalo de nuevo.";
}

export function exportConversationMarkdown(
  title: string,
  messages: { role: string; content: string }[],
): string {
  const lines = [`# ${title}`, ""];
  for (const msg of messages) {
    const label = msg.role === "user" ? "Usuario" : "WikiBridge";
    lines.push(`## ${label}`, "", msg.content, "");
  }
  return lines.join("\n");
}

export function exportMessageMarkdown(
  role: string,
  content: string,
  meta?: { model?: string | null; latencyMs?: number | null },
): string {
  const label = role === "user" ? "Usuario" : "WikiBridge";
  const lines = [`## ${label}`, ""];
  if (meta?.model || meta?.latencyMs != null) {
    const parts: string[] = [];
    if (meta.latencyMs != null) parts.push(formatLatency(meta.latencyMs));
    if (meta.model) parts.push(meta.model);
    lines.push(`> ${parts.join(" · ")}`, "");
  }
  lines.push(content, "");
  return lines.join("\n");
}

export type RegenerateMode = "default" | "concise" | "detailed" | "sources-only";

export const REGENERATE_SUFFIXES: Record<Exclude<RegenerateMode, "default">, string> = {
  concise: "\n\nResponde de forma más breve y concisa.",
  detailed: "\n\nAmplía la respuesta con más detalle y contexto.",
  "sources-only": "\n\nResponde citando únicamente las fuentes disponibles, sin añadir información externa.",
};
