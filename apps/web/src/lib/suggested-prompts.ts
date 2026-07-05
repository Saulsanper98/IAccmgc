export interface PromptCategory {
  id: string;
  label: string;
  prompts: string[];
}

export const PROMPT_CATEGORIES: PromptCategory[] = [
  {
    id: "overview",
    label: "Visión general",
    prompts: [
      "¿Cuántas páginas hay indexadas?",
      "Resume la documentación de redes",
      "¿Qué áreas de la wiki están mejor documentadas?",
    ],
  },
  {
    id: "procedures",
    label: "Procedimientos",
    prompts: [
      "¿Cómo instalar el agente Zabbix en Linux?",
      "¿Qué procedimiento hay para backups con VEEAM?",
      "Pasos para dar de alta un usuario en Active Directory",
    ],
  },
  {
    id: "diary",
    label: "Diario",
    prompts: [
      "¿Qué cambios se documentaron esta semana?",
      "Resume las entradas recientes del diario de sistemas",
      "¿Hay incidencias abiertas documentadas hoy?",
    ],
  },
  {
    id: "infra",
    label: "Infraestructura",
    prompts: [
      "¿Cómo reinicio nginx en el servidor wiki interno?",
      "Estado de los servicios monitorizados en Zabbix",
      "Documentación sobre conmutación y alta disponibilidad",
    ],
  },
  {
    id: "troubleshooting",
    label: "Soporte",
    prompts: [
      "¿Cómo diagnosticar problemas de conectividad VPN?",
      "¿Qué hacer si un servicio no responde en el monitor?",
      "Documentación sobre recuperación ante desastres",
    ],
  },
];

export interface ContextualPromptOptions {
  pageCount?: number | null;
  role?: string;
  recentTitles?: string[];
}

function normalizePrompt(value: string): string {
  return value.trim().toLowerCase();
}

function uniqueRecentTitles(titles: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const title of titles) {
    const trimmed = title.trim();
    if (!trimmed || trimmed === "Nueva conversación") continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(trimmed);
    if (unique.length >= 2) break;
  }
  return unique;
}

export function contextualPrompts(options?: ContextualPromptOptions | number | null): string[] {
  const opts: ContextualPromptOptions =
    typeof options === "number" || options == null ? { pageCount: options ?? null } : options;

  const { pageCount, role, recentTitles = [] } = opts;
  const count = pageCount ?? 0;
  const prompts: string[] = [];
  const seen = new Set<string>();

  function add(prompt: string) {
    const key = normalizePrompt(prompt);
    if (seen.has(key)) return;
    seen.add(key);
    prompts.push(prompt);
  }

  for (const title of uniqueRecentTitles(recentTitles)) {
    add(`Continúa sobre: ${title.slice(0, 60)}`);
  }

  if (role === "admin") {
    add("¿Cuántos Q&A validados hay pendientes de revisión?");
  }

  if (count === 0) {
    add("¿Cómo sincronizo la wiki?");
    add("¿Qué es WikiBridge?");
  } else if (count < 50) {
    add(`Explora las ${count} páginas indexadas`);
    add("¿Qué procedimientos hay documentados?");
  } else {
    for (const category of PROMPT_CATEGORIES) {
      add(category.prompts[0]);
    }
  }

  return prompts.slice(0, 8);
}

export function welcomePromptSections(options?: ContextualPromptOptions | number | null) {
  const quick = contextualPrompts(options);
  const shown = new Set(quick.map(normalizePrompt));
  const contextual = quick.filter((p) => p.startsWith("Continúa sobre:"));
  const highlights = quick.filter((p) => !p.startsWith("Continúa sobre:"));
  const categories = PROMPT_CATEGORIES.map((cat) => ({
    ...cat,
    prompts: cat.prompts.filter((p) => !shown.has(normalizePrompt(p))).slice(0, 2),
  })).filter((cat) => cat.prompts.length > 0);

  return { contextual, highlights, categories };
}

/** Prompts adicionales rotativos para el botón «Más sugerencias». */
export function extraPromptPool(options?: ContextualPromptOptions | number | null): string[] {
  const opts: ContextualPromptOptions =
    typeof options === "number" || options == null ? { pageCount: options ?? null } : options;
  const { pageCount } = opts;
  const pool: string[] = [];

  for (const category of PROMPT_CATEGORIES) {
    for (const prompt of category.prompts.slice(1)) {
      pool.push(prompt);
    }
  }

  if ((pageCount ?? 0) > 0) {
    pool.push("¿Qué páginas se actualizaron recientemente?");
    pool.push("Resume los procedimientos de seguridad documentados");
  }

  return pool;
}

export function pickRotatingPrompts(
  pool: string[],
  exclude: Set<string>,
  count = 3,
): string[] {
  const available = pool.filter((p) => !exclude.has(normalizePrompt(p)));
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
