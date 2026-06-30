/**
 * CopaMundial — SVG inline de la Copa del Mundo FIFA (estilizada).
 *
 * Trofeo dorado de 2 figuras humanas sosteniendo un globo + base.
 * No es la imagen oficial FIFA (copyright), pero respeta la silueta
 * reconocible del trofeo World Cup.
 *
 * Props:
 *   size: lado en px. Default 100.
 *   glow: agrega drop-shadow dorado. Default true.
 */

export default function CopaMundial({ size = 100, glow = true, style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 120"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Copa del Mundo"
      style={{
        display: 'block',
        filter: glow ? 'drop-shadow(0 0 12px rgba(251,191,36,0.55))' : undefined,
        ...style,
      }}
    >
      <defs>
        <linearGradient id="oro" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#fde68a" />
          <stop offset="35%"  stopColor="#fbbf24" />
          <stop offset="70%"  stopColor="#d97706" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
        <linearGradient id="oroBase" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
        <radialGradient id="globo" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0%"   stopColor="#fef3c7" />
          <stop offset="55%"  stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#b45309" />
        </radialGradient>
      </defs>

      {/* Globo terráqueo (esfera arriba) */}
      <circle cx="50" cy="28" r="16" fill="url(#globo)" stroke="#92400e" strokeWidth="0.6" />
      {/* Líneas del globo (continentes estilizados) */}
      <path
        d="M40 23 Q46 19 52 23 T62 25 M38 30 Q46 33 54 31 T62 33 M42 38 Q48 40 56 38"
        stroke="#92400e" strokeWidth="0.8" fill="none" opacity="0.55"
      />
      {/* Meridianos */}
      <ellipse cx="50" cy="28" rx="6" ry="16" fill="none" stroke="#92400e" strokeWidth="0.6" opacity="0.4" />
      <ellipse cx="50" cy="28" rx="12" ry="16" fill="none" stroke="#92400e" strokeWidth="0.5" opacity="0.3" />

      {/* Cuerpo del trofeo: 2 figuras humanas estilizadas sosteniendo el globo */}
      {/* Figura izquierda */}
      <path
        d="M50 44
           Q40 50 36 60
           Q32 72 36 84
           L42 84
           Q40 76 44 68
           Q46 60 50 56
           Z"
        fill="url(#oro)"
        stroke="#78350f" strokeWidth="0.5"
      />
      {/* Figura derecha (espejo) */}
      <path
        d="M50 44
           Q60 50 64 60
           Q68 72 64 84
           L58 84
           Q60 76 56 68
           Q54 60 50 56
           Z"
        fill="url(#oro)"
        stroke="#78350f" strokeWidth="0.5"
      />

      {/* Pedestal medio (placa de nombres) */}
      <rect x="34" y="84" width="32" height="10" rx="1" fill="url(#oroBase)" stroke="#78350f" strokeWidth="0.5" />
      <line x1="36" y1="89" x2="64" y2="89" stroke="#fde68a" strokeWidth="0.5" opacity="0.6" />

      {/* Base */}
      <rect x="30" y="94" width="40" height="6" rx="1.5" fill="url(#oroBase)" stroke="#78350f" strokeWidth="0.5" />
      <rect x="26" y="100" width="48" height="8" rx="2" fill="url(#oroBase)" stroke="#78350f" strokeWidth="0.5" />

      {/* Reflejo / brillo superior */}
      <ellipse cx="44" cy="20" rx="5" ry="3" fill="#fef9c3" opacity="0.6" />

      {/* Sombra base */}
      <ellipse cx="50" cy="112" rx="26" ry="3" fill="#0a1628" opacity="0.6" />
    </svg>
  )
}
