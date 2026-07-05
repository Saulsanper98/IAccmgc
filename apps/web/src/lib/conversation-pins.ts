const PINS_KEY = "wikibridge-conversation-pins";
const ARCHIVED_KEY = "wikibridge-conversation-archived";

function readSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeSet(key: string, ids: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export function getPinnedIds(): Set<string> {
  return readSet(PINS_KEY);
}

export function getArchivedIds(): Set<string> {
  return readSet(ARCHIVED_KEY);
}

export function togglePin(id: string): boolean {
  const pins = getPinnedIds();
  const next = !pins.has(id);
  if (next) pins.add(id);
  else pins.delete(id);
  writeSet(PINS_KEY, pins);
  return next;
}

export function toggleArchive(id: string): boolean {
  const archived = getArchivedIds();
  const next = !archived.has(id);
  if (next) archived.add(id);
  else archived.delete(id);
  writeSet(ARCHIVED_KEY, archived);
  return next;
}

export function removeConversationPins(id: string): void {
  const pins = getPinnedIds();
  const archived = getArchivedIds();
  let changed = false;
  if (pins.delete(id)) changed = true;
  if (archived.delete(id)) changed = true;
  if (changed) {
    writeSet(PINS_KEY, pins);
    writeSet(ARCHIVED_KEY, archived);
  }
}
