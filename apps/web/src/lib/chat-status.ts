/** Mensajes de estado amigables (sin jerga técnica ni nombres de modelo). */
export function friendlyChatStatus(message: string | null | undefined): string {
  if (!message) return "Buscando en la wiki…";
  const lower = message.toLowerCase();
  if (lower.includes("embedding") || lower.includes("preparando")) return "Buscando en la wiki…";
  if (lower.includes("buscando")) return "Buscando en la wiki…";
  if (lower.includes("generando") || lower.includes("redactando")) return "Redactando respuesta…";
  if (lower.includes("procesando")) return "Procesando tu pregunta…";
  return "Buscando en la wiki…";
}

export function phaseFromStatusMessage(message: string | null | undefined, phase?: string | null): string | null {
  if (phase && phase !== "started") return phase;
  if (!message) return null;
  const lower = message.toLowerCase();
  if (lower.includes("embedding")) return "embedding";
  if (lower.includes("buscando") || lower.includes("localizando")) return "searching";
  if (lower.includes("generando") || lower.includes("redactando") || lower.includes("resumiendo")) return "generating";
  return "started";
}

export function statusMentionsChunks(message: string | null | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes("chunk") || lower.includes("fragmento");
}

export function truncateChatTitle(text: string, max = 80): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}
