import clsx from "clsx";
import { labelJobStatus, labelRole, labelRunbookStatus, labelSeverity, labelStepStatus } from "@/lib/labels";

type BadgeVariant = "default" | "ok" | "warn" | "error" | "accent" | "muted";

const variants: Record<BadgeVariant, string> = {
  default: "bg-surface-2/80 text-text-secondary",
  ok: "bg-status-ok/12 text-status-ok",
  warn: "bg-status-warn/12 text-status-warn",
  error: "bg-status-error/12 text-status-error",
  accent: "bg-accent/12 text-accent",
  muted: "bg-surface-1 text-text-muted",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium tracking-wide",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function jobStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case "completed":
      return "ok";
    case "running":
      return "warn";
    case "failed":
      return "error";
    default:
      return "muted";
  }
}

export function JobStatusBadge({ status }: { status: string }) {
  return <Badge variant={jobStatusVariant(status)}>{labelJobStatus(status)}</Badge>;
}

export function roleBadgeVariant(role: string): BadgeVariant {
  switch (role) {
    case "admin":
      return "default";
    case "editor":
      return "ok";
    default:
      return "muted";
  }
}

export function RoleBadge({ role }: { role: string }) {
  return <Badge variant={roleBadgeVariant(role)}>{labelRole(role)}</Badge>;
}

export function RunbookStatusBadge({ status }: { status: string }) {
  const variant: BadgeVariant = status === "published" ? "ok" : "muted";
  return <Badge variant={variant}>{labelRunbookStatus(status)}</Badge>;
}

export function SeverityBadge({ severity }: { severity: string }) {
  const variant: BadgeVariant =
    severity === "critical" ? "error" : severity === "warn" ? "warn" : "muted";
  return <Badge variant={variant}>{labelSeverity(severity)}</Badge>;
}

export function StepStatusBadge({ status }: { status: string }) {
  const variant: BadgeVariant =
    status === "done" ? "ok" : status === "failed" ? "error" : "muted";
  return <Badge variant={variant}>{labelStepStatus(status)}</Badge>;
}
