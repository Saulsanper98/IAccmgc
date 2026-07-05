"use client";

import clsx from "clsx";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  idPrefix,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  idPrefix?: string;
}) {
  return (
    <div
      role="tablist"
      className={clsx(
        "inline-flex p-1 rounded-lg bg-surface-1 border border-stroke-subtle",
        className,
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          id={idPrefix ? `${idPrefix}-tab-${opt.value}` : undefined}
          aria-selected={value === opt.value}
          aria-controls={idPrefix ? `${idPrefix}-panel-${opt.value}` : undefined}
          onClick={() => onChange(opt.value)}
          className={clsx(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-colors min-h-[36px]",
            value === opt.value
              ? "bg-surface-2 text-text-primary shadow-sm"
              : "text-text-muted hover:text-text-secondary",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
