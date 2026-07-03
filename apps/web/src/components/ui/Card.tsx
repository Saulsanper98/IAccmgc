import clsx from "clsx";
import type { HTMLAttributes } from "react";

export function Card({
  children,
  elevated,
  padding = true,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  elevated?: boolean;
  padding?: boolean;
}) {
  return (
    <div
      className={clsx(
        elevated ? "surface-card-elevated" : "surface-card",
        padding && "p-5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
