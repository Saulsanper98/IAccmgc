import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "md" | "sm";

const variantClass: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

const sizeClass: Record<ButtonSize, string> = {
  md: "",
  sm: "btn-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  pill,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pill?: boolean;
}) {
  return (
    <button
      type="button"
      className={clsx(variantClass[variant], sizeClass[size], pill && "btn-pill", className)}
      {...props}
    >
      {children}
    </button>
  );
}
