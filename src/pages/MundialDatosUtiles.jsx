/**
 * MundialDatosUtiles — Fase 1 (MVP manual, solo lectura)
 *
 * Página pública /mundial/:torneoId/datos. Lista datos útiles del Mundial
 * cargados por admin, agrupados por tipo. Pensada como "vida" durante el
 * torneo — info para enchufar las charlas:
 *   - goleadores;
 *   - amarillas por equipo;
 *   - rojas por equipo;
 *   - clasificados;
 *   - eliminados;
 *   - tabla de grupos;
 *   - otro.
 *
 * Solo lectura. Cero scoring, cero ranking, cero cruce con respuestas.
 *
 * Orden de secciones (fijo): goleadores → amarillas_equipo → rojas_equipo
 *   → clasificados → eliminados → tabla_grupos → otro.
 *
 * Tipos sin datos cargados: la sección NO se renderiza para no ensuciar.
 *
 * ROADMAP (no implementar acá):
 *   Fase 2 — Tarjetas estructuradas: matriz Equipo × Partido para amarillas
 *     y rojas. Sistema calcula totales y top 5. Reemplaza la carga manual de
 *     'amarillas_equipo' y 'rojas_equipo'.
 *   Fase 3 — Tabla de grupos calculada: admin carga resultados de partidos
 *     de grupo; sistema calcula PJ/Pts/GF/GC/DG/posición. Reemplaza la carga
 *     manual de 'tabla_grupos'.
 *   Fase 4 — "Lo pusieron": cruce contra mundial_respuestas_usuario usando
 *     pregunta_id (ya nullable en el schema). Goleadores → quién eligió ese
 *     jugador, tarjetas/clasificados/eliminados → quién eligió ese equipo.
 *     Gate temporal: no exponer antes del cierre de carga.
 *   Al implementar Fase 2/3, los tipos manuales correspondientes quedan
 *   deprecados desde el admin (sin necesidad de tocar el CHECK del schema).
 */

import { useEffect, useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/index.js'
import MundialIcon from '../components/MundialIcon.jsx'

// Orden fijo de tipos para que el render sea determinístico independiente
// del orden alfabético del backend (que igualmente ordena por tipo asc).
const TIPOS_ORDEN = [
  'goleadores',
  'amarillas_equipo',
  'rojas_equipo',
  'clasificados',
  'eliminados',
  'tabla_grupos',
  'otro',
]

const TIPO_META = {
  goleadores:       { label: 'Goleadores',           emoji: '🥇' },
  amarillas_equipo: { label: 'Amarillas por equipo', emoji: '🟨' },
  rojas_equipo:     { label: 'Rojas por equipo',     emoji: '🟥' },
  clasificados:     { label: 'Clasificados',         emoji: '✅' },
  eliminados:       { label: 'Eliminados',           emoji: '❌' },
  tabla_grupos:     { label: 'Tabla de grupos',      emoji: '📊' },
  otro:             { label: 'Otros datos útiles',   emoji: '📌' },
}

export default function MundialDatosUtiles() {
  const { torneoId } = useParams()
  const [torneo, setTorneo]     = useState(null)
  const [datos, setDatos]       = useState([])
  const [equipos, setEquipos]   = useState([])
  // Fase 2: tarjetas estructuradas. Si llega { top_amarillas, top_rojas }
  // con elementos, reemplazan la sección manual del mismo tipo.
  const [tarjetas, setTarjetas] = useState(null)
  // Sprint Final C4: stats calculadas del fixture. null = endpoint no
  // disponible (fallback total a manual/matriz, comportamiento pre-C4).
  const [stats, setStats]       = useState(null)
  // Sprint Final C5/C6: goleadores y premios individuales estructurados.
  const [goleadores, setGoleadores] = useState([])
  const [premiosInd, setPremiosInd] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => { load() /* eslint-disable-next-line */ }, [torneoId])

  async function load() {
    setLoading(true); setError('')
    try {
      const [torneos, list, cat, tj, st, gol, pri] = await Promise.all([
        api.getMundialTorneos(),
        api.getMundialDatosUtiles(torneoId),
        api.getMundialEquiposCatalogo(torneoId).catch(() => []),
        // Tarjetas: si el endpoint falla por cualquier razón, no rompe la
        // página (cae al fallback de items manuales transparentemente).
        api.getMundialTarjetasPartido(torneoId).catch(() => null),
        api.getMundialStatsCalculadas(torneoId).catch(() => null),
        api.getMundialGoleadores(torneoId).catch(() => null),
        api.getMundialPremiosIndividuales(torneoId).catch(() => null),
      ])
      const t = (torneos || []).find(x => x.id === parseInt(torneoId, 10))
      if (!t) throw new Error('Torneo Mundial no encontrado')
      setTorneo(t)
      setDatos(Array.isArray(list) ? list : [])
      setEquipos(Array.isArray(cat) ? cat : [])
      setTarjetas(tj)
      setStats(st)
      setGoleadores(Array.isArray(gol?.goleadores) ? gol.goleadores : [])
      setPremiosInd(Array.isArray(pri?.premios) ? pri.premios : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Mapa código → equipo (para emoji + nombre).
  const equipoBy = useMemo(() => {
    const m = new Map()
    for (const e of equipos) m.set(e.codigo, e)
    return m
  }, [equipos])

  // Agrupa datos por tipo. Backend ya ordena por (tipo, orden_display, id),
  // así que basta con foldear.
  const porTipo = useMemo(() => {
    const m = new Map()
    for (const d of datos) {
      let arr = m.get(d.tipo)
      if (!arr) { arr = []; m.set(d.tipo, arr) }
      arr.push(d)
    }
    return m
  }, [datos])

  function renderEquipo(codigo) {
    if (!codigo) return null
    const eq = equipoBy.get(codigo)
    if (!eq) return codigo // huérfano: muestra el código crudo
    return (
      <span style={{ whiteSpace: 'nowrap' }}>
        {eq.emoji ? `${eq.emoji} ` : ''}{eq.nombre || codigo}
        {eq.grupo && (
          <span style={{ color: 'var(--color-muted)', marginLeft: 4, fontSize: 11 }}>
            · Grupo {eq.grupo}
          </span>
        )}
      </span>
    )
  }

  if (loading) return <div className="loading">Cargando datos útiles...</div>
  if (error)   return <div className="error-msg" style={{ margin: 24 }}>{error}</div>

  // Sprint Final C4: dashboard calculado desde el fixture. Activo si el
  // backend devolvió stats con al menos 1 partido finalizado. La fuente de
  // tarjetas la decide el BACKEND (stats.tarjetas.fuente), no este componente.
  const statsActivas = !!(stats && stats.meta && stats.meta.partidos_finalizados > 0)
  const fuenteFixture = statsActivas && stats.tarjetas?.fuente === 'fixture'

  // Tops de tarjetas: con fixture activo salen de stats; sino, Fase 2
  // (matriz) como siempre. Si tienen elementos, ocultan los items manuales
  // del mismo tipo (auto-deprecación transparente, patrón Fase 2).
  const topAmarillas = fuenteFixture
    ? (stats.tops?.amarillas || [])
    : (Array.isArray(tarjetas?.top_amarillas) ? tarjetas.top_amarillas : [])
  const topRojas = fuenteFixture
    ? (stats.tops?.rojas || [])
    : (Array.isArray(tarjetas?.top_rojas) ? tarjetas.top_rojas : [])
  const hayTopAmarillas = topAmarillas.length > 0
  const hayTopRojas     = topRojas.length > 0

  // Secciones manuales reemplazadas por calculadas (no se borran: se ocultan
  // solo cuando la versión calculada/estructurada tiene datos).
  const ocultarManual = new Set()
  if (statsActivas) {
    ocultarManual.add('tabla_grupos')
    if ((stats.clasificados || []).length > 0) ocultarManual.add('clasificados')
    if ((stats.eliminados || []).length > 0)   ocultarManual.add('eliminados')
  }
  // C5: goleadores estructurados reemplazan los items manuales tipo 'goleadores'.
  const hayGoleadoresEstructurados = goleadores.length > 0
  if (hayGoleadoresEstructurados) ocultarManual.add('goleadores')
  // C6: premios con jugador otorgado (sin jugador no se muestran al usuario).
  const premiosOtorgados = premiosInd.filter(p => p.jugador)

  // hayAlgo incluye tops estructurados y dashboard para que la página NO
  // muestre el empty si hay algo calculado.
  const hayAlgo = datos.length > 0 || hayTopAmarillas || hayTopRojas || statsActivas ||
    hayGoleadoresEstructurados || premiosOtorgados.length > 0

  return (
    <div style={{ maxWidth: 880, margin: '24px auto', padding: '0 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <MundialIcon width={60} height={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
            Datos útiles — {torneo?.nombre}
          </h1>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
            Información manual del Mundial. Se actualiza durante el torneo.
          </div>
        </div>
        <Link to={`/mundial/${torneoId}`} className="btn btn-secondary btn-sm">
          ← Mis respuestas
        </Link>
      </div>

      {/* Sprint Final C4 — dashboard calculado desde el fixture */}
      {statsActivas && (
        <DashboardCalculado stats={stats} />
      )}

      {/* Empty */}
      {!hayAlgo && (
        <div style={{
          padding: '16px 18px', textAlign: 'center',
          background: 'rgba(0,0,0,0.04)', color: 'var(--color-muted)',
          borderRadius: 8, fontSize: 14, lineHeight: 1.5,
        }}>
          Todavía no hay datos útiles cargados.
        </div>
      )}

      {/* Sprint Final C5 — Top goleadores estructurado (reemplaza items
          manuales tipo 'goleadores'; estos no se borran, quedan de fallback). */}
      {hayGoleadoresEstructurados && (
        <section style={{ marginBottom: 20 }}>
          <HeaderSeccion emoji="🥇" label="Top goleadores" extra={`(${goleadores.length})`} />
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {goleadores.map((g, idx) => (
                  <tr key={g.id} style={{
                    borderTop: idx === 0 ? 'none' : '1px solid rgba(0,0,0,0.05)',
                    opacity: g.activo === 1 ? 1 : 0.6,
                  }}>
                    <td style={{ ...tdMain, width: 40, textAlign: 'right', fontWeight: 700, color: 'var(--color-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {g.posicion}°
                    </td>
                    <td style={tdMain}>
                      <div style={{ fontWeight: 600 }}>
                        {g.jugador}
                        {g.activo !== 1 && (
                          <span style={{
                            marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '1px 7px',
                            borderRadius: 99, background: 'rgba(220,38,38,0.10)', color: '#b91c1c',
                            textTransform: 'uppercase',
                          }}>
                            eliminado
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                        {g.equipo_emoji ? `${g.equipo_emoji} ` : ''}{g.equipo_nombre}
                        {g.equipo_grupo && <span> · Grupo {g.equipo_grupo}</span>}
                      </div>
                      {g.notas && (
                        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2, fontStyle: 'italic' }}>
                          {g.notas}
                        </div>
                      )}
                    </td>
                    <td style={tdValor}>
                      <span style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {g.goles}
                      </span>
                      <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>goles</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Sprint Final C6 — Premios individuales otorgados */}
      {premiosOtorgados.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <HeaderSeccion emoji="🏅" label="Premios individuales" extra={`(${premiosOtorgados.length})`} />
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {premiosOtorgados.map((p, idx) => (
                  <tr key={p.id} style={{ borderTop: idx === 0 ? 'none' : '1px solid rgba(0,0,0,0.05)' }}>
                    <td style={tdMain}>
                      <div style={{ fontWeight: 600 }}>🏅 {p.titulo}</div>
                      {p.notas && (
                        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2, fontStyle: 'italic' }}>
                          {p.notas}
                        </div>
                      )}
                    </td>
                    <td style={{ ...tdValor, textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{p.jugador}</div>
                      {p.equipo_nombre && (
                        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                          {p.equipo_emoji ? `${p.equipo_emoji} ` : ''}{p.equipo_nombre}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Secciones por tipo en orden fijo. Para amarillas_equipo y
          rojas_equipo, si hay tarjetas estructuradas (Fase 2), se renderiza
          el top calculado en vez de los items manuales del mismo tipo. */}
      {TIPOS_ORDEN.map(tipo => {
        if (tipo === 'amarillas_equipo' && hayTopAmarillas) {
          return (
            <TopTarjetasSection
              key="top_amarillas"
              emoji="🟨"
              label="Top tarjetas amarillas"
              sufijo="amarillas"
              items={topAmarillas}
            />
          )
        }
        if (tipo === 'rojas_equipo' && hayTopRojas) {
          return (
            <TopTarjetasSection
              key="top_rojas"
              emoji="🟥"
              label="Top tarjetas rojas"
              sufijo="rojas"
              items={topRojas}
            />
          )
        }
        // C4: tipos reemplazados por secciones calculadas — los items
        // manuales NO se borran de la DB, solo dejan de mostrarse mientras
        // exista la versión calculada (fallback permanente).
        if (ocultarManual.has(tipo)) return null
        const items = porTipo.get(tipo) || []
        if (items.length === 0) return null
        const meta = TIPO_META[tipo] || { label: tipo, emoji: '•' }
        return (
          <section key={tipo} style={{ marginBottom: 20 }}>
            <h2 style={{
              fontSize: 14, fontWeight: 700,
              color: 'var(--color-text)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              margin: '0 0 8px 0',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 18 }}>{meta.emoji}</span>
              {meta.label}
              <span style={{
                fontSize: 11, color: 'var(--color-muted)',
                fontWeight: 400, textTransform: 'none',
              }}>
                ({items.length})
              </span>
            </h2>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  {items.map((d, idx) => (
                    <tr key={d.id} style={{
                      borderTop: idx === 0 ? 'none' : '1px solid rgba(0,0,0,0.05)',
                    }}>
                      <td style={tdMain}>
                        <div style={{ fontWeight: 600 }}>{d.titulo}</div>
                        {/* Línea secundaria: equipo + jugador + grupo */}
                        {(d.equipo_codigo || d.jugador || (d.grupo && !d.equipo_codigo)) && (
                          <div style={{
                            fontSize: 12, color: 'var(--color-muted)',
                            marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap',
                          }}>
                            {d.equipo_codigo && <span>{renderEquipo(d.equipo_codigo)}</span>}
                            {d.jugador && (
                              <span>👤 {d.jugador}</span>
                            )}
                            {d.grupo && !d.equipo_codigo && (
                              <span>Grupo {d.grupo}</span>
                            )}
                          </div>
                        )}
                        {/* Descripción opcional */}
                        {d.descripcion && (
                          <div style={{
                            fontSize: 12, color: 'var(--color-muted)',
                            marginTop: 4, fontStyle: 'italic', lineHeight: 1.4,
                          }}>
                            {d.descripcion}
                          </div>
                        )}
                      </td>
                      {/* Valor (num o texto). Si ambos, prioridad al num — el texto va al pie. */}
                      <td style={tdValor}>
                        {Number.isInteger(d.valor_num) && (
                          <span style={{
                            fontSize: 18, fontWeight: 700, color: 'var(--color-text)',
                            fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                          }}>
                            {d.valor_num}
                          </span>
                        )}
                        {!Number.isInteger(d.valor_num) && d.valor_texto && (
                          <span style={{ fontSize: 13, color: 'var(--color-text)' }}>
                            {d.valor_texto}
                          </span>
                        )}
                        {Number.isInteger(d.valor_num) && d.valor_texto && (
                          <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>
                            {d.valor_texto}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </div>
  )
}

const tdMain = {
  padding: '10px 12px',
  verticalAlign: 'top',
  lineHeight: 1.4,
}
const tdValor = {
  padding: '10px 12px',
  textAlign: 'right',
  whiteSpace: 'nowrap',
  verticalAlign: 'top',
  minWidth: 80,
}

// ─────────────────────────────────────────────────────────────────────────
// DashboardCalculado — Sprint Final C4. Secciones derivadas del fixture vía
// /stats-calculadas. Solo lectura; nada acá toca scoring/ranking.
// ─────────────────────────────────────────────────────────────────────────

const RONDA_DISPLAY = {
  grupos: 'Grupos', '16vos': '16vos', '8vos': 'Octavos', '4tos': 'Cuartos',
  semis: 'Semis', tercer_puesto: '3er puesto', final: 'Final',
}
const ESTADO_EQUIPO = {
  campeon:     { label: '🏆 Campeón',   color: '#b45309' },
  clasificado: { label: '✅ Clasificado', color: '#15803d' },
  eliminado:   { label: '❌ Eliminado',  color: '#b91c1c' },
  en_juego:    { label: 'En juego',      color: 'var(--color-muted)' },
}

function HeaderSeccion({ emoji, label, extra }) {
  return (
    <h2 style={{
      fontSize: 14, fontWeight: 700, color: 'var(--color-text)',
      textTransform: 'uppercase', letterSpacing: '0.05em',
      margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ fontSize: 18 }}>{emoji}</span>
      {label}
      {extra && (
        <span style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 400, textTransform: 'none' }}>
          {extra}
        </span>
      )}
    </h2>
  )
}

function DashboardCalculado({ stats }) {
  const meta = stats.meta || {}
  const gruposConJuego = (stats.tabla_grupos || []).filter(g => g.jugados > 0)
  const equiposConJuego = (stats.equipos || []).filter(e => e.pj > 0 || e.gf_total > 0 || e.gc_total > 0)
  const conRonda = (stats.equipos || []).filter(e => e.estado !== 'en_juego' ||
    (e.ronda_alcanzada && e.ronda_alcanzada !== 'grupos'))
  const afc = (stats.equipos || []).filter(e => e.confederacion === 'AFC')
  const empatesConDatos = (stats.empates_por_grupo || []).filter(g => g.empates > 0)

  return (
    <>
      {/* Banner de estado */}
      <div style={{
        padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13,
        background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.20)',
        display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <span>📅 <strong>{meta.partidos_finalizados}</strong> de {meta.partidos_cargados} partidos finalizados</span>
        <span>🟨🟥 fuente: <strong>{meta.fuente_tarjetas === 'fixture' ? 'fixture' : 'matriz'}</strong></span>
        {meta.tarjetas_pendientes > 0 && (
          <span style={{ color: '#a16207' }}>⚠️ {meta.tarjetas_pendientes} partido(s) con tarjetas sin cargar</span>
        )}
        {meta.ultima_actualizacion && (
          <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>
            Actualizado: {meta.ultima_actualizacion} UTC
          </span>
        )}
        <span style={{ flexBasis: '100%', fontSize: 11, color: 'var(--color-muted)' }}>
          ⚠️ Posiciones con desempate simplificado — no reemplaza la confirmación oficial del admin en Resultados.
        </span>
      </div>

      {/* Tabla de grupos */}
      {gruposConJuego.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <HeaderSeccion emoji="📊" label="Tabla de grupos" extra="(calculada del fixture — desempate simplificado: Pts, DG, GF)" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {gruposConJuego.map(g => (
              <div key={g.grupo} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{
                  padding: '6px 10px', fontWeight: 700, fontSize: 12,
                  background: 'rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between',
                }}>
                  <span>Grupo {g.grupo}</span>
                  <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>
                    {g.jugados}/{g.total_partidos} jugados{g.completo ? ' · completo' : ''}
                  </span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: 'var(--color-muted)', fontSize: 10, textTransform: 'uppercase' }}>
                      <th style={thG}>#</th><th style={{ ...thG, textAlign: 'left' }}>Equipo</th>
                      <th style={thG}>PJ</th><th style={thG}>G</th><th style={thG}>E</th><th style={thG}>P</th>
                      <th style={thG}>GF</th><th style={thG}>GC</th><th style={thG}>DG</th><th style={thG}>Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.equipos.map(e => (
                      <tr key={e.equipo_codigo} style={{
                        borderTop: '1px solid rgba(0,0,0,0.05)',
                        background: e.posicion <= 2 && g.completo ? 'rgba(22,163,74,0.06)' : undefined,
                      }}>
                        <td style={tdG}>{e.posicion}</td>
                        <td style={{ ...tdG, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>
                          {e.emoji ? `${e.emoji} ` : ''}{e.nombre}
                        </td>
                        <td style={tdG}>{e.pj}</td><td style={tdG}>{e.g}</td><td style={tdG}>{e.e}</td><td style={tdG}>{e.p}</td>
                        <td style={tdG}>{e.gf}</td><td style={tdG}>{e.gc}</td>
                        <td style={{ ...tdG, color: e.dg > 0 ? '#15803d' : e.dg < 0 ? '#b91c1c' : undefined }}>
                          {e.dg > 0 ? `+${e.dg}` : e.dg}
                        </td>
                        <td style={{ ...tdG, fontWeight: 700 }}>{e.pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Mejores terceros (formato 2026: clasifican los 8 mejores 3°) */}
      {(stats.terceros?.items?.length > 0) && (
        <section style={{ marginBottom: 20 }}>
          <HeaderSeccion
            emoji="🥉"
            label="Mejores terceros"
            extra={`(clasifican ${stats.terceros.cupos} · ${stats.terceros.grupos_completos}/${stats.terceros.total_grupos} grupos completos${stats.terceros.definitivo ? ' · DEFINITIVO' : ' · provisorio'})`}
          />
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--color-muted)', fontSize: 10, textTransform: 'uppercase' }}>
                  <th style={thG}>#</th>
                  <th style={{ ...thG, textAlign: 'left' }}>Equipo</th>
                  <th style={thG}>Grupo</th>
                  <th style={thG}>PJ</th><th style={thG}>Pts</th>
                  <th style={thG}>DG</th><th style={thG}>GF</th><th style={thG}>GC</th>
                  <th style={{ ...thG, textAlign: 'right' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {stats.terceros.items.map(r => {
                  const est = r.estado === 'clasificaria'
                    ? { label: stats.terceros.definitivo ? '✅ Clasifica' : '✅ Clasificaría', color: '#15803d', bg: 'rgba(22,163,74,0.06)' }
                    : r.estado === 'quedaria_afuera'
                      ? { label: '❌ Quedaría afuera', color: '#b91c1c', bg: undefined }
                      : { label: '⏳ Pendiente (grupo incompleto)', color: 'var(--color-muted)', bg: undefined }
                  return (
                    <tr key={r.grupo} style={{ borderTop: '1px solid rgba(0,0,0,0.05)', background: est.bg }}>
                      <td style={{ ...tdG, fontWeight: 700, color: 'var(--color-muted)' }}>
                        {r.ranking ? `${r.ranking}°` : '—'}
                      </td>
                      <td style={{ ...tdG, textAlign: 'left', whiteSpace: 'nowrap' }}>
                        {r.emoji ? `${r.emoji} ` : ''}{r.nombre}
                      </td>
                      <td style={tdG}>{r.grupo}</td>
                      <td style={tdG}>{r.pj}</td>
                      <td style={{ ...tdG, fontWeight: 700 }}>{r.pts}</td>
                      <td style={{ ...tdG, color: r.dg > 0 ? '#15803d' : r.dg < 0 ? '#b91c1c' : undefined }}>
                        {r.dg > 0 ? `+${r.dg}` : r.dg}
                      </td>
                      <td style={tdG}>{r.gf}</td><td style={tdG}>{r.gc}</td>
                      <td style={{ ...tdG, textAlign: 'right', fontWeight: 600, color: est.color, whiteSpace: 'nowrap' }}>
                        {est.label}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{
            fontSize: 11, color: '#a16207', marginTop: 6, lineHeight: 1.45,
            padding: '6px 10px', background: 'rgba(234,179,8,0.08)', borderRadius: 6,
          }}>
            ⚠️ {stats.nota_desempate || 'Cálculo preliminar con desempate simplificado. Confirmar contra criterio oficial/admin.'}
          </div>
        </section>
      )}

      {/* Tops de goles en grupos */}
      {(stats.tops?.goleadores_grupos?.length > 0 || stats.tops?.goleados_grupos?.length > 0) && (
        <section style={{ marginBottom: 20 }}>
          <HeaderSeccion emoji="⚽" label="Goles en fase de grupos" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            <MiniTop titulo="Más goleadores" items={stats.tops.goleadores_grupos} sufijo="goles" />
            <MiniTop titulo="Más goleados" items={stats.tops.goleados_grupos} sufijo="goles en contra" />
          </div>
        </section>
      )}

      {/* Empates por grupo */}
      {empatesConDatos.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <HeaderSeccion emoji="🤝" label="Empates por grupo" extra={`(total: ${stats.empates_total})`} />
          <div className="card" style={{ padding: '8px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(stats.empates_por_grupo || []).map(g => (
              <span key={g.grupo} style={{
                fontSize: 12, padding: '4px 10px', borderRadius: 99,
                background: g.empates > 0 ? 'rgba(59,130,246,0.10)' : 'rgba(0,0,0,0.04)',
                color: g.empates > 0 ? '#1d4ed8' : 'var(--color-muted)',
                fontWeight: g.empates > 0 ? 600 : 400,
              }}>
                {g.grupo}: {g.empates}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* GF/GC por equipo (colapsable para no ensuciar) */}
      {equiposConJuego.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <details className="card" style={{ padding: '10px 14px' }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              ⚽ Goles por equipo (hechos / recibidos) — {equiposConJuego.length} equipos con partidos
            </summary>
            <div style={{ overflowX: 'auto', marginTop: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: 'var(--color-muted)', fontSize: 10, textTransform: 'uppercase' }}>
                    <th style={{ ...thG, textAlign: 'left' }}>Equipo</th>
                    <th style={thG}>GF grupos</th><th style={thG}>GC grupos</th>
                    <th style={thG}>GF total</th><th style={thG}>GC total</th>
                  </tr>
                </thead>
                <tbody>
                  {equiposConJuego.map(e => (
                    <tr key={e.equipo_codigo} style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                      <td style={{ ...tdG, textAlign: 'left' }}>
                        {e.emoji ? `${e.emoji} ` : ''}{e.nombre}
                        {e.grupo && <span style={{ color: 'var(--color-muted)', fontSize: 11 }}> · {e.grupo}</span>}
                      </td>
                      <td style={tdG}>{e.gf_grupos}</td><td style={tdG}>{e.gc_grupos}</td>
                      <td style={tdG}>{e.gf_total}</td><td style={tdG}>{e.gc_total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      )}

      {/* Ronda alcanzada / clasificados / eliminados */}
      {conRonda.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <HeaderSeccion emoji="🛣️" label="Ronda alcanzada" extra="(clasificados de grupos: top-2 y cruces cargados)" />
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {conRonda.map(e => {
                  const est = ESTADO_EQUIPO[e.estado] || ESTADO_EQUIPO.en_juego
                  return (
                    <tr key={e.equipo_codigo} style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                      <td style={{ ...tdMain, fontWeight: 600 }}>
                        {e.emoji ? `${e.emoji} ` : ''}{e.nombre}
                        {e.grupo && <span style={{ color: 'var(--color-muted)', fontSize: 11, fontWeight: 400 }}> · Grupo {e.grupo}</span>}
                      </td>
                      <td style={{ ...tdMain, fontSize: 12 }}>
                        {RONDA_DISPLAY[e.ronda_alcanzada] || e.ronda_alcanzada || '—'}
                      </td>
                      <td style={{ ...tdValor, fontSize: 12, fontWeight: 600, color: est.color }}>
                        {est.label}
                        {e.estado === 'eliminado' && e.eliminado_en && (
                          <span style={{ fontWeight: 400, color: 'var(--color-muted)' }}>
                            {' '}en {RONDA_DISPLAY[e.eliminado_en] || e.eliminado_en}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* AFC y ronda alcanzada */}
      {afc.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <HeaderSeccion emoji="🌏" label="Equipos AFC" extra="(confederación asiática y ronda alcanzada)" />
          <div className="card" style={{ padding: '8px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {afc.map(e => {
              const est = ESTADO_EQUIPO[e.estado] || ESTADO_EQUIPO.en_juego
              return (
                <span key={e.equipo_codigo} style={{
                  fontSize: 12, padding: '4px 10px', borderRadius: 99,
                  background: 'rgba(0,0,0,0.04)',
                }}>
                  {e.emoji ? `${e.emoji} ` : ''}{e.nombre}
                  <span style={{ color: est.color, marginLeft: 6, fontWeight: 600 }}>
                    {RONDA_DISPLAY[e.ronda_alcanzada] || e.ronda_alcanzada || '—'}
                  </span>
                </span>
              )
            })}
          </div>
        </section>
      )}
    </>
  )
}

function MiniTop({ titulo, items, sufijo }) {
  if (!items || items.length === 0) return null
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '6px 10px', fontWeight: 700, fontSize: 12, background: 'rgba(0,0,0,0.04)' }}>
        {titulo}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <tbody>
          {items.map((it, idx) => (
            <tr key={`${it.equipo_codigo}-${idx}`} style={{ borderTop: idx === 0 ? 'none' : '1px solid rgba(0,0,0,0.05)' }}>
              <td style={{ ...tdMain, width: 34, textAlign: 'right', fontWeight: 700, color: 'var(--color-muted)' }}>
                {it.posicion}°
              </td>
              <td style={tdMain}>{it.emoji ? `${it.emoji} ` : ''}{it.nombre}</td>
              <td style={tdValor}>
                <strong style={{ fontSize: 16 }}>{it.total}</strong>
                <span style={{ fontSize: 11, color: 'var(--color-muted)', marginLeft: 4 }}>{sufijo}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const thG = { padding: '4px 6px', textAlign: 'center', fontWeight: 600 }
const tdG = { padding: '4px 6px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }

// ─────────────────────────────────────────────────────────────────────────
// TopTarjetasSection — render del top calculado desde la matriz Fase 2.
//
// items vienen ordenados desde el backend con posición ya asignada (dense
// rank: empates comparten posición; corte por posición, no por count).
// Cada item: { equipo_codigo, nombre, emoji, grupo, total, posicion }.
// ─────────────────────────────────────────────────────────────────────────
function TopTarjetasSection({ emoji, label, sufijo, items }) {
  return (
    <section style={{ marginBottom: 20 }}>
      <h2 style={{
        fontSize: 14, fontWeight: 700,
        color: 'var(--color-text)',
        textTransform: 'uppercase', letterSpacing: '0.05em',
        margin: '0 0 8px 0',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 18 }}>{emoji}</span>
        {label}
        <span style={{
          fontSize: 11, color: 'var(--color-muted)',
          fontWeight: 400, textTransform: 'none',
        }}>
          ({items.length})
        </span>
      </h2>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <tbody>
            {items.map((it, idx) => (
              <tr key={`${it.equipo_codigo}-${idx}`} style={{
                borderTop: idx === 0 ? 'none' : '1px solid rgba(0,0,0,0.05)',
              }}>
                <td style={{ ...tdMain, width: 40, textAlign: 'right',
                              fontWeight: 700, color: 'var(--color-muted)',
                              fontVariantNumeric: 'tabular-nums' }}>
                  {it.posicion}°
                </td>
                <td style={tdMain}>
                  <div style={{ fontWeight: 600 }}>
                    {it.emoji ? `${it.emoji} ` : ''}{it.nombre}
                  </div>
                  {it.grupo && (
                    <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                      Grupo {it.grupo}
                    </div>
                  )}
                </td>
                <td style={tdValor}>
                  <span style={{
                    fontSize: 18, fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                  }}>
                    {it.total}
                  </span>
                  <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>
                    {sufijo}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
