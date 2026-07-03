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
    id: "troubleshooting",
    label: "Soporte",
    prompts: [
      "¿Cómo diagnosticar problemas de conectividad VPN?",
      "¿Qué hacer si un servicio no responde en el monitor?",
      "Documentación sobre recuperación ante desastres",
    ],
  },
];

export function contextualPrompts(pageCount?: number | null): string[] {
  const count = pageCount ?? 0;
  if (count === 0) {
    return [
      "¿Cómo sincronizo la wiki?",
      "¿Qué es WikiBridge?",
    ];
  }
  if (count < 50) {
    return [
      `Explora las ${count} páginas indexadas`,
      "¿Qué procedimientos hay documentados?",
    ];
  }
  return PROMPT_CATEGORIES.flatMap((c) => c.prompts.slice(0, 1));
}
