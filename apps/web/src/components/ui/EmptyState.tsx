import clsx from "clsx";
import { Button } from "./Button";

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center text-center py-12 px-6",
        className,
      )}
    >
      {icon && (
        <div className="mb-4 text-text-muted opacity-80" aria-hidden>
          {icon}
        </div>
      )}
      <h3 className="text-base font-medium text-text-primary">{title}</h3>
      {description && (
        <p className="text-sm text-text-secondary mt-2 max-w-sm leading-relaxed">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button variant="secondary" className="mt-6" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
