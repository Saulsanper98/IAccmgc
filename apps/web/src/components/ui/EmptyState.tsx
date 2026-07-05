import clsx from "clsx";
import { Button } from "./Button";

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
  compact,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-6 px-4" : "py-12 px-6",
        className,
      )}
    >
      {icon && (
        <div className={clsx("text-text-muted opacity-80", compact ? "mb-2" : "mb-4")} aria-hidden>
          {icon}
        </div>
      )}
      <h3 className={clsx("font-medium text-text-primary", compact ? "text-sm" : "text-base")}>{title}</h3>
      {description && (
        <p
          className={clsx(
            "text-text-secondary mt-2 max-w-sm leading-relaxed",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button variant="secondary" size={compact ? "sm" : "md"} className={compact ? "mt-4" : "mt-6"} onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
