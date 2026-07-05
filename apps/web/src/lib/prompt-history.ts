const PROMPT_HISTORY_KEY = "wikibridge-prompt-history";
const MAX_HISTORY = 20;

export function getPromptHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PROMPT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function addPromptHistory(prompt: string): void {
  const trimmed = prompt.trim();
  if (!trimmed || typeof window === "undefined") return;
  try {
    const prev = getPromptHistory().filter((p) => p !== trimmed);
    const next = [trimmed, ...prev].slice(0, MAX_HISTORY);
    localStorage.setItem(PROMPT_HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
