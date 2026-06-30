/**
 * Bandera — <img> con bandera real desde flagcdn.com.
 *
 * Props:
 *   codigo: código interno del equipo (ej: 'ARG', 'BRA'). Traduce a ISO2.
 *   emoji:  emoji de bandera como fallback si flagcdn falla u onLoad timeout.
 *   width:  ancho px. Default 22.
 *   height: alto px. Default 14.
 *
 * flagcdn sirve PNG en w20/w40/w80/w160/w320 — usamos w40 para nitidez en 22px.
 */

import { useState } from 'react'
import { isoDe } from '../data/mundial-iso2.js'

export default function Bandera({ codigo, emoji, width = 22, height = 14, style = {}, title }) {
  const [errored, setErrored] = useState(false)
  const iso = isoDe(codigo)
  if (!iso || errored) {
    // Fallback emoji
    return (
      <span style={{ fontSize: Math.max(width, 14), lineHeight: 1, display: 'inline-block', ...style }} title={title}>
        {emoji || '🏳️'}
      </span>
    )
  }
  return (
    <img
      src={`https://flagcdn.com/w40/${iso}.png`}
      srcSet={`https://flagcdn.com/w80/${iso}.png 2x`}
      width={width}
      height={height}
      alt={codigo}
      title={title || codigo}
      loading="lazy"
      onError={() => setErrored(true)}
      style={{
        display: 'inline-block', verticalAlign: 'middle',
        objectFit: 'cover', borderRadius: 2,
        boxShadow: '0 0 0 0.5px rgba(255,255,255,0.15)',
        ...style,
      }}
    />
  )
}
