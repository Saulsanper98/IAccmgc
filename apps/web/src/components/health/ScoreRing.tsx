export function ScoreRing({ score }: { score: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 70 ? "var(--status-ok)" : score >= 40 ? "var(--status-warn)" : "var(--status-error)";
  const label =
    score >= 70 ? "Buena salud documental" : score >= 40 ? "Salud documental moderada" : "Salud documental baja";

  return (
    <div className="flex items-center gap-5">
      <div
        className="relative w-24 h-24 shrink-0"
        role="img"
        aria-label={`Salud global: ${score} de 100. ${label}`}
      >
        <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96" aria-hidden>
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke="var(--stroke-subtle)"
            strokeWidth="6"
          />
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <span className="text-2xl font-semibold tabular-nums tracking-tight">{score}</span>
        </div>
      </div>
      <div>
        <p className="text-sm font-medium">Salud global</p>
        <p className="text-xs text-text-muted mt-1">Puntuación 0–100</p>
      </div>
    </div>
  );
}
