/** Spanish UI labels for API enum values. */

const JOB_STATUS: Record<string, string> = {
  pending: "Pendiente",
  running: "En curso",
  completed: "Completado",
  failed: "Fallido",
};

const RUNBOOK_STATUS: Record<string, string> = {
  draft: "Borrador",
  published: "Publicado",
};

const SESSION_STEP_STATUS: Record<string, string> = {
  done: "Hecho",
  skipped: "Omitido",
  failed: "Fallido",
};

const SEVERITY: Record<string, string> = {
  critical: "Crítico",
  warn: "Advertencia",
  info: "Info",
};

const ROLE: Record<string, string> = {
  admin: "Administrador",
  editor: "Editor",
  lector: "Lector",
};

const DETECTOR: Record<string, string> = {
  staleness: "Obsolescencia",
  broken_links: "Enlaces rotos",
  orphan: "Huérfanas",
  version_citation: "Versiones",
  contradiction: "Contradicciones",
  usage_signal: "Uso",
};

export function labelJobStatus(status: string): string {
  return JOB_STATUS[status] ?? status;
}

export function labelRunbookStatus(status: string): string {
  return RUNBOOK_STATUS[status] ?? status;
}

export function labelStepStatus(status: string): string {
  return SESSION_STEP_STATUS[status] ?? status;
}

export function labelSeverity(severity: string): string {
  return SEVERITY[severity] ?? severity;
}

export function labelRole(role: string): string {
  return ROLE[role] ?? role;
}

export function labelDetector(detector: string): string {
  return DETECTOR[detector] ?? detector.replace(/_/g, " ");
}
