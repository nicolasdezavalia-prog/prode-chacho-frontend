/**
 * CardColapsable — wrapper genérico colapsable con persistencia en localStorage.
 *
 * Uso:
 *   <CardColapsable storageKey="mdu_bracket" titulo={<><MundialIcon ... /> Bracket</>}>
 *     ...contenido...
 *   </CardColapsable>
 *
 * Default: abierto. El user puede cerrar y la preferencia se recuerda por
 * `storageKey`. Si storageKey no se pasa, no persiste (estado in-memory).
 */

import { useState, useEffect } from 'react'

export default function CardColapsable({
  storageKey,
  titulo,
  extra = null,
  defaultAbierto = true,
  children,
  style = {},
}) {
  const lsKey = storageKey ? `mundial_card_${storageKey}` : null
  const [abierto, setAbierto] = useState(() => {
    if (!lsKey) return defaultAbierto
    try {
      const v = localStorage.getItem(lsKey)
      if (v === null) return defaultAbierto
      return v === '1'
    } catch { return defaultAbierto }
  })

  useEffect(() => {
    if (!lsKey) return
    try { localStorage.setItem(lsKey, abierto ? '1' : '0') } catch { /* ignore */ }
  }, [lsKey, abierto])

  return (
    <section style={{ marginBottom: 20, ...style }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setAbierto(a => !a)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAbierto(a => !a) } }}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          userSelect: 'none', padding: '6px 4px', marginBottom: abierto ? 10 : 0,
        }}
      >
        <span style={{
          fontSize: 12, color: 'var(--color-muted)', width: 16, textAlign: 'center',
          transition: 'transform 0.15s', display: 'inline-block',
          transform: abierto ? 'rotate(90deg)' : 'rotate(0deg)',
        }}>
          ▶
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>{titulo}</div>
        {extra}
      </div>
      {abierto && <div>{children}</div>}
    </section>
  )
}
