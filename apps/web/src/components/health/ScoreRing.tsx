"use client";

import { useEffect, useState } from "react";

const THRESHOLD_TOOLTIP =
  "Puntuación 0–100: ≥70 buena salud (verde), 40–69 moderada (ámbar), <40 baja (rojo). Se calcula a partir de hallazgos abiertos por página indexada.";

export function ScoreRing({
  score,
  lastScanAt,
}: {
  score: number;
  lastScanAt?: string | null;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [trend, setTrend] = useState<number | null>(null);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 70 ? "var(--status-ok)" : score >= 40 ? "var(--status-warn)" : "var(--status-error)";
  const label =
    score >= 70 ? "Buena salud documental" : score >= 40 ? "Salud documental moderada" : "Salud documental baja";

  const subtitle = lastScanAt
    ? `Último análisis: ${new Date(lastScanAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}`
    : "Puntuación 0–100";

  useEffect(() => {
    try {
      const key = "wikibridge-health-score-history";
      const raw = localStorage.getItem(key);
      const history: number[] = raw ? JSON.parse(raw) : [];
      if (history.length > 0) setTrend(score - history[history.length - 1]);
      if (history[history.length - 1] !== score) {
        history.push(score);
        if (history.length > 12) history.shift();
        localStorage.setItem(key, JSON.stringify(history));
      }
    } catch {
      /* ignore */
    }
  }, [score]);

  return (
    <div className="flex items-center gap-5">
      <div
        className="relative w-24 h-24 shrink-0"
        role="img"
        aria-label={`Salud global: ${score} de 100. ${label}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        tabIndex={0}
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
        {showTooltip && (
          <span
            role="tooltip"
            className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-30 w-56 p-2.5 rounded-lg border border-stroke-default bg-surface-1 shadow-glass text-left text-xs text-text-secondary leading-relaxed"
          >
            {THRESHOLD_TOOLTIP}
          </span>
        )}
      </div>
      <div>
        <p className="text-sm font-medium">Salud global</p>
        <p className="text-xs text-text-muted mt-1">{subtitle}</p>
        {trend != null && trend !== 0 && (
          <p
            className={`text-xs mt-1 tabular-nums ${trend > 0 ? "text-status-ok" : "text-status-error"}`}
          >
            {trend > 0 ? "+" : ""}
            {trend} vs último registro
          </p>
        )}
      </div>
    </div>
  );
}
