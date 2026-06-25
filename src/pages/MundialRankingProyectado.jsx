/**
 * MundialRankingProyectado — Fase B (2026-06-25)
 *
 * Página /mundial/:torneoId/ranking-proyectado. Tabla con # / Usuario /
 * Puntos proyectados (oficial + proyección) / Aciertos / Premio / Comida.
 *
 * Diferencia con MundialRanking ("oficial"):
 *   - Suma pts oficiales (de mundial_resultados) + pts proyectados (del
 *     fixture/tarjetas/goleadores) en un solo total.
 *   - El detalle expandido muestra:
 *       * preguntas oficiales con chip verde "Real: X"
 *       * preguntas proyectables con chip morado "Hoy: Y"
 *       * preguntas pendientes (sin resultado ni proyección) con chip "⏳ Pendiente"
 *   - Premio/Castigo y Comida se calculan sobre la POSICIÓN PROYECTADA
 *     (decisión B2 del 2026-06-25).
 *
 * Endpoint: GET /api/mundial/:torneoId/ranking-mixto
 */

import { Fragment, useEffect, useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/index.js'
import { useAuth } from '../App.jsx'
import MundialIcon from '../components/MundialIcon.jsx'

export default function MundialRankingProyectado() {
  const { torneoId } = useParams()
  const { user }     = useAuth()
  const [torneo, setTorneo]   = useState(null)
  const [data, setData]       = useState(null)
  const [premiosCalc, setPremiosCalc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [expandido, setExpandido] = useState({})

  useEffect(() => { load() /* eslint-disable-next-line */ }, [torneoId])

  async function load() {
    setLoading(true); setError('')
    try {
      const [torneos, rk, premios] = await Promise.all([
        api.getMundialTorneos(),
        api.getMundialRankingMixto(torneoId),
        api.getMundialPremiosCalculados(torneoId).catch(() => null),
      ])
      const t = (torneos || []).find(x => x.id === parseInt(torneoId, 10))
      if (!t) throw new Error('Torneo Mundial no encontrado')
      setTorneo(t)
      setData(rk)
      setPremiosCalc(premios)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function toggleUser(uid) {
    setExpandido(prev => ({ ...prev, [uid]: !prev[uid] }))
  }

  const premioPorPosicion = useMemo(() => {
    const m = new Map()
    for (const p of (premiosCalc?.premios || [])) {
      m.set(p.posicion, p.usd)
    }
    return m
  }, [premiosCalc])

  const comidaPorPosicion = useMemo(() => {
    const m = new Map()
    for (const p of (premiosCalc?.premios || [])) {
      if (p.comida_rol) m.set(p.posicion, p.comida_rol)
    }
    return m
  }, [premiosCalc])

  if (loading) return <div className="loading">Cargando ranking proyectado...</div>
  if (error)   return <div className="error-msg" style={{ margin: 24 }}>{error}</div>

  const ranking    = Array.isArray(data?.ranking) ? data.ranking : []
  const hayPremios = !!premiosCalc?.configurado
  const hayComida  = comidaPorPosicion.size > 0
  const ofi        = Number.isInteger(data?.preguntas_con_resultado) ? data.preguntas_con_resultado : 0
  const proy       = Number.isInteger(data?.preguntas_proyectables)  ? data.preguntas_proyectables  : 0
  const total      = Number.isInteger(data?.total_preguntas)         ? data.total_preguntas         : 0

  function comidaBadge(rol) {
    switch (rol) {
      case 'gratis':   return { label: 'Come gratis', fg: 'var(--color-success)', bg: 'rgba(22,163,74,0.10)' }
      case 'paga':     return { label: 'Paga',        fg: '#a16207',              bg: 'rgba(234,179,8,0.12)' }
      case 'organiza': return { label: 'Organiza',    fg: '#7c3aed',              bg: 'rgba(124,58,237,0.10)' }
      default:         return null
    }
  }
  function fmtUsd(usd) {
    if (!Number.isInteger(usd)) return null
    return `${usd >= 0 ? '+' : ''}${usd} USD`
  }
  function colorUsd(usd) {
    if (!Number.isInteger(usd)) return 'var(--color-muted)'
    return usd > 0 ? 'var(--color-success)' : usd < 0 ? 'var(--color-danger)' : 'var(--color-muted)'
  }

  return (
    <div style={{ maxWidth: 840, margin: '24px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <MundialIcon width={60} height={42} />
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
            🔮 Ranking proyectado — {torneo?.nombre}
          </h1>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
            <strong>{ofi}</strong> oficiales + <strong>{proy}</strong> proyectables ·{' '}
            <strong>{total}</strong> totales
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={`/mundial/${torneoId}/ranking`} className="btn btn-secondary btn-sm">
            🏆 Ver oficial
          </Link>
          <Link to={`/mundial/${torneoId}`} className="btn btn-secondary btn-sm">
            ← Mis respuestas
          </Link>
        </div>
      </div>

      {/* Banner contextual */}
      <div style={{
        padding: '12px 14px', marginBottom: 12,
        background: 'rgba(124,58,237,0.07)',
        border: '1px solid rgba(124,58,237,0.25)',
        borderRadius: 8, fontSize: 13, lineHeight: 1.5,
      }}>
        <div style={{ fontWeight: 700, color: '#7c3aed', marginBottom: 4 }}>
          🔮 Pts oficiales + proyección al día de hoy
        </div>
        <div style={{ color: 'var(--color-text)' }}>
          Suma los puntos ya confirmados por el admin con los proyectados desde el fixture, tarjetas y goleadores.
          {hayPremios && ' Premios y comida calculados sobre la posición proyectada.'}
        </div>
        {data?.caveat && (
          <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 6, fontStyle: 'italic' }}>
            {data.caveat}
          </div>
        )}
      </div>

      {ranking.length === 0 && (
        <div style={{
          padding: '16px 18px', textAlign: 'center',
          background: 'rgba(0,0,0,0.04)', color: 'var(--color-muted)',
          borderRadius: 8, fontSize: 14,
        }}>
          Todavía no hay datos suficientes para proyectar el ranking.
        </div>
      )}

      {ranking.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 600 }}>
            <thead>
              <tr style={{ background: 'var(--color-surface2)' }}>
                <th style={th}>#</th>
                <th style={th}>Usuario</th>
                <th style={{ ...th, textAlign: 'right' }}>Puntos</th>
                <th style={{ ...th, textAlign: 'right' }}>Aciertos</th>
                {hayPremios && <th style={{ ...th, textAlign: 'right' }}>Premio/Castigo</th>}
                {hayComida && <th style={{ ...th, textAlign: 'center' }}>Comida</th>}
                <th style={{ ...th, width: 28 }} aria-label="Expandir"></th>
              </tr>
            </thead>
            <tbody>
              {ranking.map(r => {
                const esYo  = user && r.user_id === user.id
                const usd   = premioPorPosicion.get(r.posicion)
                const usdLabel = fmtUsd(usd)
                const rol   = comidaPorPosicion.get(r.posicion) || null
                const badge = comidaBadge(rol)
                const detalle = Array.isArray(r.detalle) ? r.detalle : []
                const puedeExpandir = detalle.length > 0
                const open = !!expandido[r.user_id]
                const colSpanExp = 5 + (hayPremios ? 1 : 0) + (hayComida ? 1 : 0)
                return (
                  <Fragment key={r.user_id}>
                    <tr
                      style={{
                        background: esYo ? 'rgba(124,58,237,0.07)' : 'transparent',
                        fontWeight: esYo ? 600 : 400,
                        cursor: puedeExpandir ? 'pointer' : 'default',
                      }}
                      onClick={() => puedeExpandir && toggleUser(r.user_id)}
                    >
                      <td style={{ ...td, fontWeight: 700, color: r.posicion === 1 ? '#7c3aed' : 'var(--color-text)' }}>
                        {r.posicion}
                      </td>
                      <td style={td}>
                        {r.nombre || `Usuario ${r.user_id}`}
                        {esYo && <span style={{ fontSize: 11, color: 'var(--color-muted)', marginLeft: 6 }}>(vos)</span>}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <strong>{r.puntos_totales}</strong>
                        <span style={{
                          display: 'block', fontSize: 10, color: 'var(--color-muted)',
                          fontWeight: 400, marginTop: 2,
                        }}>
                          {r.puntos_oficiales} of + {r.puntos_proyectados} proy
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: 'right', color: 'var(--color-muted)' }}>
                        {r.aciertos_totales}
                      </td>
                      {hayPremios && (
                        <td style={{
                          ...td, textAlign: 'right', fontWeight: 600,
                          color: colorUsd(usd),
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {usdLabel || <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>—</span>}
                        </td>
                      )}
                      {hayComida && (
                        <td style={{ ...td, textAlign: 'center' }}>
                          {badge ? (
                            <span style={{
                              fontSize: 10, fontWeight: 700,
                              padding: '3px 8px', borderRadius: 99,
                              color: badge.fg, background: badge.bg,
                              textTransform: 'uppercase', letterSpacing: '0.03em',
                              whiteSpace: 'nowrap',
                            }}>
                              {badge.label}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-muted)' }}>—</span>
                          )}
                        </td>
                      )}
                      <td style={{ ...td, textAlign: 'center', color: 'var(--color-muted)', userSelect: 'none' }}>
                        {puedeExpandir ? (open ? '▲' : '▼') : ''}
                      </td>
                    </tr>
                    {open && puedeExpandir && (
                      <tr style={{
                        background: esYo ? 'rgba(124,58,237,0.04)' : 'rgba(124,58,237,0.03)',
                      }}>
                        <td colSpan={colSpanExp} style={{ padding: '8px 16px 12px 16px', borderBottom: '1px solid var(--color-border)' }}>
                          <DetalleUserMixto detalle={detalle} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// DetalleUserMixto — render del detalle del ranking proyectado.
// Cada item.fuente ∈ 'oficial' | 'proyectado' | 'pendiente' decide los chips
// que se muestran. Ya viene ordenado del backend (fuente → aciertos → numero).
// ─────────────────────────────────────────────────────────────────────────
export function DetalleUserMixto({ detalle }) {
  // useMemo ANTES de cualquier early-return para respetar las reglas de hooks.
  const grupos = useMemo(() => {
    const g = { oficial: [], proyectado: [], pendiente: [] }
    if (!Array.isArray(detalle)) return g
    for (const d of detalle) {
      const f = d.fuente || 'pendiente'
      if (g[f]) g[f].push(d)
    }
    return g
  }, [detalle])
  if (!Array.isArray(detalle) || detalle.length === 0) return null
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700,
        color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em',
        marginBottom: 6,
      }}>
        Detalle &mdash; {grupos.oficial.length} oficial{grupos.oficial.length === 1 ? '' : 'es'} + {grupos.proyectado.length} proyectada{grupos.proyectado.length === 1 ? '' : 's'} + {grupos.pendiente.length} pendiente{grupos.pendiente.length === 1 ? '' : 's'}
      </div>
      <Bloque titulo="🏆 Oficiales" items={grupos.oficial} fuente="oficial" />
      <Bloque titulo="🔮 Proyectadas" items={grupos.proyectado} fuente="proyectado" />
      <Bloque titulo="⏳ Pendientes" items={grupos.pendiente} fuente="pendiente" />
    </div>
  )
}

function Bloque({ titulo, items, fuente }) {
  if (!items || items.length === 0) return null
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'var(--color-muted)',
        textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4,
      }}>
        {titulo}
      </div>
      {items.map(d => {
        const tieneChips = !!(d.respuesta_user_display || d.respuesta_oficial_display || d.respuesta_actual_display) || d.respondida === false
        return (
          <div
            key={d.pregunta_id || `${fuente}-${d.numero}`}
            style={{
              padding: '5px 0',
              borderBottom: '1px dashed rgba(0,0,0,0.06)',
              fontSize: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                width: 18, textAlign: 'center',
                color: fuente === 'pendiente'
                  ? 'var(--color-muted)'
                  : d.acerto ? 'var(--color-success)' : 'var(--color-muted)',
                fontWeight: 700, flexShrink: 0,
              }}>
                {fuente === 'pendiente' ? '⏳' : (d.acerto ? '✓' : '✗')}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: 'var(--color-muted)',
                minWidth: 28, flexShrink: 0,
              }}>
                #{d.numero}
              </span>
              <span style={{ flex: 1, color: 'var(--color-text)' }}>
                {d.enunciado}
              </span>
              <span style={{
                fontWeight: 700, whiteSpace: 'nowrap',
                color: fuente === 'oficial'
                  ? (d.acerto ? 'var(--color-success)' : 'var(--color-muted)')
                  : fuente === 'proyectado'
                    ? (d.acerto ? '#7c3aed' : 'var(--color-muted)')
                    : 'var(--color-muted)',
              }}>
                {fuente === 'pendiente' ? '—' : (d.acerto ? `+${d.pts} pts` : '0 pts')}
              </span>
            </div>
            {tieneChips && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 6,
                marginLeft: 56, marginTop: 4, fontSize: 11,
              }}>
                {d.respuesta_user_display && (
                  <span style={{
                    background: 'rgba(0,0,0,0.05)', color: 'var(--color-text)',
                    padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                  }}>
                    {d.respuesta_user_display}
                  </span>
                )}
                {d.respuesta_oficial_display && (
                  <span style={{
                    background: 'rgba(22,163,74,0.10)', color: 'var(--color-success)',
                    padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                  }}>
                    Real: {d.respuesta_oficial_display}
                  </span>
                )}
                {d.respuesta_actual_display && (
                  <span style={{
                    background: 'rgba(124,58,237,0.10)', color: '#6d28d9',
                    padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                  }}>
                    Hoy: {d.respuesta_actual_display}
                  </span>
                )}
                {d.respondida === false && (
                  <span style={{
                    background: 'rgba(234,179,8,0.10)', color: '#a16207',
                    padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                  }}>
                    No respondiste
                  </span>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const th = {
  padding: '10px 12px', textAlign: 'left',
  fontSize: 11, fontWeight: 700, color: 'var(--color-muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '1px solid var(--color-border)',
}

const td = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--color-border)',
}
