/**
 * MundialRanking — Fase 3 + Fase Premios + Fase 6.1 (comida configurable)
 *
 * Página pública /mundial/:torneoId/ranking. Tabla con posición / usuario /
 * puntos / aciertos / premio / comida.
 *
 * Fase Premios cross:
 *   - Fetcha `/premios-calculados` en paralelo.
 *   - Cruza cada fila por posición con el premio configurado.
 *   - Si no hay premio para esa posición, muestra "—".
 *   - Si premios-calculados.estimado === true, nota al pie/encabezado.
 *
 * Comida (Fase 6.1):
 *   - SIN lógica hardcodeada (no más "top 5 gratis / último organiza" en cliente).
 *   - Cada posición trae `comida_rol` desde `mundial_premios`, configurado
 *     por el admin (Tab Premios).
 *   - Valores: 'gratis' | 'paga' | 'organiza' | null.
 *   - La columna Comida solo se muestra si AL MENOS UNA fila configurada
 *     tiene `comida_rol` truthy. Si el admin no la usa, desaparece.
 *
 * ROADMAP (no implementado todavía):
 *   - "El que no va paga como si hubiera ido" — requiere data de asistencia.
 *   - Integración con módulo de Comidas / Economía para registrar deudas.
 */

import { Fragment, useEffect, useState, useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api/index.js'
import { useAuth } from '../App.jsx'
import MundialIcon from '../components/MundialIcon.jsx'
import { DetalleUserMixto } from './MundialRankingProyectado.jsx'

const MOTIVO_MSG = {
  estado_no_apto: 'El ranking se publica a partir del estado "Grupos jugados".',
  sin_resultados: 'Todavía no hay resultados cargados. El ranking aparece cuando el admin carga el primer resultado.',
}

export default function MundialRanking() {
  const { torneoId } = useParams()
  const { user }     = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  // Vista por defecto: 'oficial' (consistente con la decisión C de 2026-06-25).
  // El query param ?vista=proyectado fuerza la vista mixta — útil para
  // compartir links o para que el toggle persista en URL.
  // `vistaQuery` lee lo del param; `vistaParam` (más abajo) hace fallback a
  // 'oficial' si el endpoint mixto NO tiene datos — evita que el user
  // quede "atrapado" en proyectado sin manera de volver.
  const vistaQuery   = searchParams.get('vista') === 'proyectado' ? 'proyectado' : 'oficial'

  const [torneo, setTorneo]   = useState(null)
  const [data, setData]       = useState(null)
  const [premiosCalc, setPremiosCalc] = useState(null)
  // Ranking proyectado interno: placeholder cuando NO hay resultados oficiales
  // todavía (durante grupos). Se sigue cargando como fallback.
  const [proyectado, setProyectado] = useState(null)
  // Ranking mixto (oficial + proyectado sumados) — alimenta la vista
  // "Proyectado" del toggle. Se carga en paralelo y se cachea localmente.
  const [mixto, setMixto] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => { load() /* eslint-disable-next-line */ }, [torneoId])

  async function load() {
    setLoading(true); setError('')
    try {
      const [torneos, rk, premios, proy, mx] = await Promise.all([
        api.getMundialTorneos(),
        api.getMundialRanking(torneoId),
        // Premios: fallback null si el endpoint no responde (no crítico).
        api.getMundialPremiosCalculados(torneoId).catch(() => null),
        // Ranking proyectado (placeholder cuando aún no hay oficiales).
        api.getMundialRankingProyectado(torneoId).catch(() => null),
        // Ranking mixto (oficial + proyectado) — alimenta la vista del toggle.
        api.getMundialRankingMixto(torneoId).catch(() => null),
      ])
      const t = (torneos || []).find(x => x.id === parseInt(torneoId, 10))
      if (!t) throw new Error('Torneo Mundial no encontrado')
      setTorneo(t)
      setData(rk)
      setPremiosCalc(premios)
      setProyectado(proy)
      setMixto(mx)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function setVista(v) {
    const next = new URLSearchParams(searchParams)
    if (v === 'proyectado') next.set('vista', 'proyectado')
    else                    next.delete('vista')
    setSearchParams(next, { replace: true })
  }

  // Maps por posición para cruce O(1) por fila.
  const premioPorPosicion = useMemo(() => {
    const m = new Map()
    for (const p of (premiosCalc?.premios || [])) {
      m.set(p.posicion, p.usd)
    }
    return m
  }, [premiosCalc])

  // Map { posicion: comida_rol } — fuente única: config del admin.
  const comidaPorPosicion = useMemo(() => {
    const m = new Map()
    for (const p of (premiosCalc?.premios || [])) {
      if (p.comida_rol) m.set(p.posicion, p.comida_rol)
    }
    return m
  }, [premiosCalc])

  // Estado de expansión por user_id (ranking oficial — espejo del proyectado).
  // Cada user puede expandirse independientemente para ver el detalle de
  // qué preguntas acertó / falló (chips Vos / Real).
  const [expandidoOf, setExpandidoOf] = useState({})
  function toggleUserOf(uid) {
    setExpandidoOf(prev => ({ ...prev, [uid]: !prev[uid] }))
  }

  if (loading) return <div className="loading">Cargando ranking...</div>
  if (error)   return <div className="error-msg" style={{ margin: 24 }}>{error}</div>

  const visible    = data?.visible === true
  const ranking    = Array.isArray(data?.ranking) ? data.ranking : []
  const hayPremios = !!premiosCalc?.configurado
  const estimado   = !!premiosCalc?.estimado
  // Mostrar columna Comida solo si HAY al menos una fila con comida_rol cargada.
  const hayComida  = comidaPorPosicion.size > 0
  // Fallback de vista: si el user pidió 'proyectado' pero el mixto está
  // vacío (endpoint falló o no hay datos suficientes), volvemos a 'oficial'.
  const tieneMixto = Array.isArray(mixto?.ranking) && mixto.ranking.length > 0
  const vistaParam = (vistaQuery === 'proyectado' && tieneMixto) ? 'proyectado' : 'oficial'

  // Badge configurable: traducción de comida_rol a label + colores.
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
            Ranking — {torneo?.nombre}
          </h1>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
            {visible && (
              <>
                <strong>{data.preguntas_con_resultado}</strong> de{' '}
                <strong>{data.total_preguntas}</strong> preguntas con resultado cargado
              </>
            )}
          </div>
        </div>
        <Link to={`/mundial/${torneoId}`} className="btn btn-secondary btn-sm">
          ← Mis respuestas
        </Link>
      </div>

      {/* Toggle Oficial / Proyectado — solo si hay datos del mixto */}
      {Array.isArray(mixto?.ranking) && mixto.ranking.length > 0 && (
        <div style={{
          display: 'flex', gap: 6, marginBottom: 12,
          background: 'rgba(0,0,0,0.04)', borderRadius: 8, padding: 4,
        }}>
          <button
            type="button"
            onClick={() => setVista('oficial')}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 6, border: 'none',
              cursor: 'pointer', fontWeight: 700, fontSize: 13,
              background: vistaParam === 'oficial' ? 'var(--color-surface)' : 'transparent',
              color: vistaParam === 'oficial' ? 'var(--color-text)' : 'var(--color-muted)',
              boxShadow: vistaParam === 'oficial' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            🏆 Oficial
          </button>
          <button
            type="button"
            onClick={() => setVista('proyectado')}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 6, border: 'none',
              cursor: 'pointer', fontWeight: 700, fontSize: 13,
              background: vistaParam === 'proyectado' ? 'rgba(124,58,237,0.12)' : 'transparent',
              color: vistaParam === 'proyectado' ? '#6d28d9' : 'var(--color-muted)',
              boxShadow: vistaParam === 'proyectado' ? '0 1px 2px rgba(124,58,237,0.15)' : 'none',
            }}
          >
            🔮 Proyectado
          </button>
        </div>
      )}

      {/* Nota de premios estimados — visible si hay premios cargados y estimado=true */}
      {vistaParam === 'oficial' && visible && hayPremios && estimado && (
        <div style={{
          padding: '8px 12px', marginBottom: 12,
          background: 'rgba(234,179,8,0.10)', color: '#a16207',
          borderRadius: 6, fontSize: 12, lineHeight: 1.45,
          border: '1px solid rgba(234,179,8,0.25)',
        }}>
          ⚠ Premios estimados hasta que el Mundial finalice. Sujetos a desempate si corresponde.
        </div>
      )}

      {/* Fase Proyección: mientras el ranking oficial está vacío (durante
          grupos), mostramos el ranking proyectado calculado desde fixture +
          tarjetas + goleadores. Cuando empiecen a cargarse resultados
          oficiales, este bloque se reemplaza por el oficial. */}
      {vistaParam === 'oficial' && !visible && Array.isArray(proyectado?.ranking) && proyectado.ranking.length > 0 && (
        <RankingProyectado
          data={proyectado}
          user={user}
        />
      )}

      {vistaParam === 'oficial' && !visible && (!proyectado || !Array.isArray(proyectado.ranking) || proyectado.ranking.length === 0) && (
        <div style={{
          padding: '16px 18px', textAlign: 'center',
          background: 'rgba(0,0,0,0.04)', color: 'var(--color-muted)',
          borderRadius: 8, fontSize: 14, lineHeight: 1.5,
        }}>
          ⏳ {MOTIVO_MSG[data?.motivo] || `Ranking no disponible (motivo: ${data?.motivo || 'desconocido'}).`}
        </div>
      )}

      {vistaParam === 'oficial' && visible && ranking.length === 0 && (
        <div style={{
          padding: '16px 18px', textAlign: 'center',
          background: 'rgba(0,0,0,0.04)', color: 'var(--color-muted)',
          borderRadius: 8, fontSize: 14,
        }}>
          Hay resultados cargados pero todavía nadie respondió en este torneo.
        </div>
      )}

      {vistaParam === 'oficial' && visible && ranking.length > 0 && (
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
                const open = !!expandidoOf[r.user_id]
                const colSpanExp = 5 + (hayPremios ? 1 : 0) + (hayComida ? 1 : 0)
                return (
                  <Fragment key={r.user_id}>
                    <tr
                      style={{
                        background: esYo ? 'rgba(59,130,246,0.07)' : 'transparent',
                        fontWeight: esYo ? 600 : 400,
                        cursor: puedeExpandir ? 'pointer' : 'default',
                      }}
                      onClick={() => puedeExpandir && toggleUserOf(r.user_id)}
                    >
                      <td style={{ ...td, fontWeight: 700, color: r.posicion === 1 ? 'var(--color-primary)' : 'var(--color-text)' }}>
                        {r.posicion}
                      </td>
                      <td style={td}>
                        {r.nombre || `Usuario ${r.user_id}`}
                        {esYo && <span style={{ fontSize: 11, color: 'var(--color-muted)', marginLeft: 6 }}>(vos)</span>}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <strong>{r.puntos_totales}</strong>
                      </td>
                      <td style={{ ...td, textAlign: 'right', color: 'var(--color-muted)' }}>
                        {r.aciertos}
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
                        background: esYo ? 'rgba(59,130,246,0.04)' : 'rgba(0,0,0,0.02)',
                      }}>
                        <td colSpan={colSpanExp} style={{ padding: '8px 16px 12px 16px', borderBottom: '1px solid var(--color-border)' }}>
                          <DetalleUserOficial detalle={detalle} />
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

      {/* Aclaración de las reglas de comida (informativo, sin deudas) */}
      {vistaParam === 'oficial' && visible && hayComida && (
        <div style={{
          marginTop: 12, fontSize: 11, color: 'var(--color-muted)',
          lineHeight: 1.5,
        }}>
          🍝 <strong>Comida post Mundial:</strong> el rol de cada posición lo configura el admin
          en la tab Premios. Aclaración: el que no asiste paga como si hubiera ido
          (regla informativa — todavía no registramos asistencia ni deudas).
        </div>
      )}

      {/* Vista PROYECTADA — alimenta de /ranking-mixto */}
      {vistaParam === 'proyectado' && (
        <VistaProyectada
          mixto={mixto}
          user={user}
          premioPorPosicion={premioPorPosicion}
          comidaPorPosicion={comidaPorPosicion}
          hayPremios={hayPremios}
          hayComida={hayComida}
          comidaBadge={comidaBadge}
          fmtUsd={fmtUsd}
          colorUsd={colorUsd}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// VistaProyectada — render del ranking-mixto (oficial + proyección). Incluye
// banner morado, top con totales, tabla expandible con DetalleUserMixto.
// Premios/comida vienen mapeados a la posición proyectada (decisión B2).
// ─────────────────────────────────────────────────────────────────────────
function VistaProyectada({ mixto, user, premioPorPosicion, comidaPorPosicion, hayPremios, hayComida, comidaBadge, fmtUsd, colorUsd }) {
  const [expandido, setExpandido] = useState({})
  function toggle(uid) { setExpandido(p => ({ ...p, [uid]: !p[uid] })) }

  if (!mixto || !Array.isArray(mixto.ranking)) {
    return (
      <div style={{
        padding: '16px 18px', textAlign: 'center',
        background: 'rgba(0,0,0,0.04)', color: 'var(--color-muted)',
        borderRadius: 8, fontSize: 14,
      }}>
        Todavía no hay datos suficientes para proyectar el ranking.
      </div>
    )
  }
  const ranking = mixto.ranking
  const ofi   = Number.isInteger(mixto.preguntas_con_resultado) ? mixto.preguntas_con_resultado : 0
  const proy  = Number.isInteger(mixto.preguntas_proyectables)  ? mixto.preguntas_proyectables  : 0
  const total = Number.isInteger(mixto.total_preguntas)         ? mixto.total_preguntas         : 0
  return (
    <div>
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
          <strong>{ofi}</strong> oficiales + <strong>{proy}</strong> proyectables · <strong>{total}</strong> totales.
          {hayPremios && ' Premios y comida calculados sobre la posición proyectada.'}
        </div>
        {mixto.caveat && (
          <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 6, fontStyle: 'italic' }}>
            {mixto.caveat}
          </div>
        )}
      </div>
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
                    onClick={() => puedeExpandir && toggle(r.user_id)}
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
    </div>
  )
}

const th = {
  padding: '10px 12px', textAlign: 'left',
  fontSize: 11, fontWeight: 700, color: 'var(--color-muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '1px solid var(--color-border)',
}

// ─────────────────────────────────────────────────────────────────────────
// RankingProyectado — Fase Proyección
// Renderiza el ranking calculado desde el fixture/tarjetas/goleadores
// hasta el día de hoy. Banner azul-violeta con disclaimer + tabla.
// Solo se renderiza cuando el oficial aún no tiene resultados (durante
// grupos). Cuando empiecen a cargarse oficiales, este bloque se reemplaza.
// ─────────────────────────────────────────────────────────────────────────
function RankingProyectado({ data, user }) {
  const ranking = Array.isArray(data?.ranking) ? data.ranking : []
  const proyectables = Number.isInteger(data?.preguntas_proyectables) ? data.preguntas_proyectables : 0
  const total = Number.isInteger(data?.total_preguntas) ? data.total_preguntas : 0
  // Estado de expansión por user_id (Opción A — expand inline).
  // Cada user puede expandirse independientemente para ver el detalle de
  // qué preguntas acertó / falló. El detalle viene en cada fila del ranking.
  const [expandido, setExpandido] = useState({})
  function toggleUser(uid) {
    setExpandido(prev => ({ ...prev, [uid]: !prev[uid] }))
  }
  return (
    <div>
      {/* Banner contextual con caveat */}
      <div style={{
        padding: '12px 14px', marginBottom: 12,
        background: 'rgba(124,58,237,0.07)',
        border: '1px solid rgba(124,58,237,0.25)',
        borderRadius: 8, fontSize: 13, lineHeight: 1.5,
      }}>
        <div style={{ fontWeight: 700, color: '#7c3aed', marginBottom: 4 }}>
          🔮 Ranking proyectado al día de hoy
        </div>
        <div style={{ color: 'var(--color-text)' }}>
          Calculado desde resultados de partidos, tarjetas y goleadores cargados.
          Cubre <strong>{proyectables}</strong> de <strong>{total}</strong> preguntas.
          Las preguntas como campeón / subcampeón se proyectan cuando se carguen.
        </div>
        <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 4, fontWeight: 500 }}>
          💡 Tocá una fila para ver el detalle por pregunta de cada user.
        </div>
        {data?.caveat && (
          <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 6, fontStyle: 'italic' }}>
            {data.caveat}
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: 'var(--color-surface2)' }}>
              <th style={th}>#</th>
              <th style={th}>Usuario</th>
              <th style={{ ...th, textAlign: 'right' }}>Puntos proyectados</th>
              <th style={{ ...th, textAlign: 'right' }}>Aciertos</th>
              <th style={{ ...th, width: 28 }} aria-label="Expandir"></th>
            </tr>
          </thead>
          <tbody>
            {ranking.map(r => {
              const esYo = user && r.user_id === user.id
              const detalle = Array.isArray(r.detalle) ? r.detalle : []
              const puedeExpandir = detalle.length > 0
              const open = !!expandido[r.user_id]
              return (
                <Fragment key={r.user_id}>
                  <tr
                    style={{
                      background: esYo ? 'rgba(124,58,237,0.07)' : 'transparent',
                      fontWeight: esYo ? 600 : 400,
                      cursor: puedeExpandir ? 'pointer' : 'default',
                    }}
                    onClick={() => puedeExpandir && toggle(r.user_id)}
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
                    <tr styl
e={{
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
    </div>
  )
}
