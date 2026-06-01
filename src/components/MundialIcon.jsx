import { useState } from 'react'

/**
 * Ícono del módulo Mundial.
 *
 * Intenta cargar la imagen desde `frontend/public/mundial-2026.{jpg,png}`.
 * Prueba primero .jpg (formato actual en repo). Si falla, prueba .png.
 * Si las dos fallan, cae al emoji 🌍 (`fallback`).
 *
 * - Tamaño cuadrado controlado por `size` (px). Nunca deforma el layout.
 * - Sin dependencias.
 * - Pensado para usar inline (verticalAlign middle) o como ícono grande de card.
 *
 * @param {number}  size      Lado en px si querés cuadrado. Default 24.
 *                             Ignorado si se pasan `width` y `height`.
 * @param {number}  width     Ancho en px. Si está, anula `size`.
 * @param {number}  height    Alto en px. Si está, anula `size`.
 * @param {string}  fallback  Carácter a mostrar si la imagen falla. Default '🌍'.
 * @param {object}  style     Overrides de estilo (se mergean con el base).
 * @param {string}  alt       Alt del <img>. Default 'Mundial'.
 */
const SOURCES = ['/mundial-2026.jpg', '/mundial-2026.png']

export default function MundialIcon({ size = 24, width, height, fallback = '🌍', style = {}, alt = 'Mundial' }) {
  const [srcIndex, setSrcIndex] = useState(0)
  const allFailed = srcIndex >= SOURCES.length

  const w = width  ?? size
  const h = height ?? size

  if (allFailed) {
    // Para el fallback emoji usamos el menor de ambos lados como font-size,
    // así el emoji entra cómodo en el área asignada sin desbordar.
    return (
      <span
        role="img"
        aria-label={alt}
        style={{
          fontSize: Math.min(w, h),
          lineHeight: 1,
          display: 'inline-block',
          verticalAlign: 'middle',
          ...style,
        }}
      >
        {fallback}
      </span>
    )
  }

  return (
    <img
      src={SOURCES[srcIndex]}
      alt={alt}
      width={w}
      height={h}
      onError={() => setSrcIndex(i => i + 1)}
      style={{
        width: w,
        height: h,
        objectFit: 'contain',
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style,
      }}
    />
  )
}
