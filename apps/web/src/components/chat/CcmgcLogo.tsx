/** Logo CCMGC en blanco para la pantalla de bienvenida del chat. */
export function CcmgcLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Centro de Control de la Movilidad de Gran Canaria"
    >
      <text
        x="180"
        y="46"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
        fontSize="48"
        fontWeight="800"
        letterSpacing="-1"
      >
        CCMGC
      </text>
      <text
        x="180"
        y="68"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
        fontSize="13"
        fontWeight="400"
        opacity="0.85"
      >
        Centro de Control
      </text>
      <text
        x="180"
        y="86"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
        fontSize="13"
        fontWeight="400"
        opacity="0.85"
      >
        de la Movilidad de Gran Canaria
      </text>
    </svg>
  );
}
