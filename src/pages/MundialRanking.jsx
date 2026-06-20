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
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/index.js'
import { useAuth } from '../App.jsx'
import MundialIcon from '../components/MundialIcon.jsx'

const MOTIVO_MSG = {
  estado_no_apto: 'El ranking se publica a partir del estado "Grupos jugados".',
  sin_resultados: 'Todavía no hay resultados cargados. El ranking aparece cuando el admin carga el primer resultado.',
}

export default function MundialRanking() {
  const { torneoId } = useParams()
  const { user }     = useAuth()
  const [torneo, setTorneo]   = useState(null)
  const [data, setData]       = useState(null)
  const [premiosCalc, setPremiosCalc] = useState(null)
  // Fase Proyección: ranking calculado desde fixture/tarjetas/goleadores.
  // Se carga siempre, pero solo se renderiza si el oficial está vacío
  // (durante grupos). Si el endpoint falla, fallback null (no rompe).
  const [proyectado, setProyectado] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => { load() /* eslint-disable-next-line */ }, [torneoId])

  async function load() {
    setLoading(true); setError('')
    try {
      const [torneos, rk, premios, proy] = await Promise.all([
        api.getMundialTorneos(),
        api.getMundialRanking(torneoId),
        // Premios: fallback null si el endpoint no responde (no crítico).
        api.getMundialPremiosCalculados(torneoId).catch(() => null),
        // Ranking proyectado — fallback null si el endpoint no existe en
        // backend viejo o falla por cualquier razón. La página no rompe.
        api.getMundialRankingProyectado(torneoId).catch(() => null),
      ])
      const t = (torneos || []).find(x => x.id === parseInt(torneoId, 10))
      if (!t) throw new Error('Torneo Mundial no encontrado')
      setTorneo(t)
      setData(rk)
      setPremiosCalc(premios)
      setProyectado(proy)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
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

  if (loading) return <div className="loading">Cargando ranking...</div>
  if (error)   return <div className="error-msg" style={{ margin: 24 }}>{error}</div>

  const visible    = data?.visible === true
  const ranking    = Array.isArray(data?.ranking) ? data.ranking : []
  const hayPremios = !!premiosCalc?.configurado
  const estimado   = !!premiosCalc?.estimado
  // Mostrar columna Comida solo si HAY al menos una fila con comida_rol cargada.
  const hayComida  = comidaPorPosicion.size > 0

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

      {/* Nota de premios estimados — visible si hay premios cargados y estimado=true */}
      {visible && hayPremios && estimado && (
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
      {!visible && Array.isArray(proyectado?.ranking) && proyectado.ranking.length > 0 && (
        <RankingProyectado
          data={proyectado}
          user={user}
        />
      )}

      {!visible && (!proyectado || !Array.isArray(proyectado.ranking) || proyectado.ranking.length === 0) && (
        <div style={{
          padding: '16px 18px', textAlign: 'center',
          background: 'rgba(0,0,0,0.04)', color: 'var(--color-muted)',
          borderRadius: 8, fontSize: 14, lineHeight: 1.5,
        }}>
          ⏳ {MOTIVO_MSG[data?.motivo] || `Ranking no disponible (motivo: ${data?.motivo || 'desconocido'}).`}
        </div>
      )}

      {visible && ranking.length === 0 && (
        <div style={{
          padding: '16px 18px', textAlign: 'center',
          background: 'rgba(0,0,0,0.04)', color: 'var(--color-muted)',
          borderRadius: 8, fontSize: 14,
        }}>
          Hay resultados cargados pero todavía nadie respondió en este torneo.
        </div>
      )}

      {visible && ranking.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'var(--color-surface2)' }}>
                <th style={th}>#</th>
                <th style={th}>Usuario</th>
                <th style={{ ...th, textAlign: 'right' }}>Puntos</th>
                <th style={{ ...th, textAlign: 'right' }}>Aciertos</th>
                {hayPremios && <th style={{ ...th, textAlign: 'right' }}>Premio/Castigo</th>}
                {hayComida && <th style={{ ...th, textAlign: 'center' }}>Comida</th>}
              </tr>
            </thead>
            <tbody>
              {ranking.map(r => {
                const esYo  = user && r.user_id === user.id
                const usd   = premioPorPosicion.get(r.posicion)
                const usdLabel = fmtUsd(usd)
                const rol   = comidaPorPosicion.get(r.posicion) || null
                const badge = comidaBadge(rol)
                return (
                  <tr
                    key={r.user_id}
                    style={{
                      background: esYo ? 'rgba(59,130,246,0.07)' : 'transparent',
                      fontWeight: esYo ? 600 : 400,
                    }}
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
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Aclaración de las reglas de comida (informativo, sin deudas) */}
      {visible && hayComida && (
        <div style={{
          marginTop: 12, fontSize: 11, color: 'var(--color-muted)',
          lineHeight: 1.5,
        }}>
          🍝 <strong>Comida post Mundial:</strong> el rol de cada posición lo configura el admin
          en la tab Premios. Aclaración: el que no asiste paga como si hubiera ido
          (regla informativa — todavía no registramos asistencia ni deudas).
        </div>
      )}
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
                      <strong>{r.puntos_proyectados}</strong>
                    </td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--color-muted)' }}>
                      {r.aciertos_proyectados}
                    </td>
                    <td style={{ ...td, textAlign: 'center', color: 'var(--color-muted)', userSelect: 'none' }}>
                      {puedeExpandir ? (open ? '▲' : '▼') : ''}
                    </td>
                  </tr>
                  {open && puedeExpandir && (
                    <tr style={{
                      background: esYo ? 'rgba(124,58,237,0.04)' : 'rgba(124,58,237,0.03)',
                    }}>
                      <td colSpan={5} style={{ padding: '8px 16px 12px 16px', borderBottom: '1px solid var(--color-border)' }}>
                        <DetalleUserProyectado detalle={detalle} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Detalle opcional de no proyectables (colapsable) */}
      {Array.isArray(data?.no_proyectables) && data.no_proyectables.length > 0 && (
        <details style={{ marginTop: 10, fontSize: 12, color: 'var(--color-muted)' }}>
          <summary style={{ cursor: 'pointer' }}>
            Ver {data.no_proyectables.length} pregunta{data.no_proyectables.length === 1 ? '' : 's'} aún no proyectable{data.no_proyectables.length === 1 ? '' : 's'}
          </summary>
          <ul style={{ margin: '6px 0 0 18px', padding: 0, lineHeight: 1.5 }}>
            {data.no_proyectables.map(p => (
              <li key={p.numero}>
                <strong>#{p.numero}</strong> {p.enunciado} — <span style={{ fontStyle: 'italic' }}>{p.motivo}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
const td = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--color-border)',
}

// ─────────────────────────────────────────────────────────────────────────
// DetalleUserProyectado — Opción A.
// Mini-tabla con preguntas proyectables que el user RESPONDIÓ. Ordenado:
// aciertos primero (✓ verde, +N pts), después fallidos (✗ gris, 0 pts).
// Las preguntas no respondidas o no proyectables NO aparecen acá — el
// listado de "no proyectables" sigue en el <details> general al pie.
// ─────────────────────────────────────────────────────────────────────────
function DetalleUserProyectado({ detalle }) {
  if (!Array.isArray(detalle) || detalle.length === 0) return null
  const aciertosCount = detalle.filter(d => d.acerto).length
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700,
        color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em',
        marginBottom: 6,
      }}>
        Detalle proyectado — {aciertosCount} acierto{aciertosCount === 1 ? '' : 's'} de {detalle.length} respondida{detalle.length === 1 ? '' : 's'}
      </div>
      <div>
        {detalle.map(d => {
          const tieneChips = !!(d.respuesta_user_display || d.respuesta_actual_display)
          return (
            <div
              key={d.numero}
              style={{
                padding: '5px 0',
                borderBottom: '1px dashed rgba(0,0,0,0.06)',
                fontSize: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: 18, textAlign: 'center',
                  color: d.acerto ? 'var(--color-success)' : 'var(--color-muted)',
                  fontWeight: 700, flexShrink: 0,
                }}>
                  {d.acerto ? '✓' : '✗'}
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
                  color: d.acerto ? '#7c3aed' : 'var(--color-muted)',
                }}>
                  {d.acerto ? `+${d.pts_proyectados} pts` : '0 pts'}
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
                  {d.respuesta_actual_display && (
                    <span style={{
                      background: 'rgba(124, 58, 237, 0.10)', color: '#6d28d9',
                      padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                    }}>
                      Hoy: {d.respuesta_actual_display}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
