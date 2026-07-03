import { Card } from "./Card";

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="flex flex-col gap-1.5 min-w-0">
      <span className="text-sm text-text-muted">{label}</span>
      <span className="text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
      {hint && <span className="text-xs text-text-secondary">{hint}</span>}
    </Card>
  );
}
