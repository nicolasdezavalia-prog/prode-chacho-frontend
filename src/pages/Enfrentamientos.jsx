import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/index.js'
import { useAuth } from '../App.jsx'

const ESTADO_LABEL = {
  borrador:   { label: 'Borrador',   cls: 'badge-borrador'   },
  abierta:    { label: 'Abierta',    cls: 'badge-abierta'    },
  cerrada:    { label: 'Cerrada',    cls: 'badge-cerrada'    },
  finalizada: { label: 'Finalizada', cls: 'badge-finalizada' },
}

// Formatea un timestamp ISO a "DD/MM HH:MM"
function fmtEnvio(ts) {
  if (!ts) return null
  const d = new Date(ts)
  if (isNaN(d.getTime())) return null
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm} ${hh}:${min}`
}

// Badge de envío: verde si en término, rojo si fuera de término, neutro si no hay deadline
function BadgeEnvio({ ts, deadline, align = 'left' }) {
  if (!ts) return null
  const d = new Date(ts)
  if (isNaN(d.getTime())) return null

  const dd  = String(d.getDate()).padStart(2, '0')
  const mm  = String(d.getMonth() + 1).padStart(2, '0')
  const hh  = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const hora = `${dd}/${mm} ${hh}:${min}`

  if (!deadline) {
    return (
      <div style={{fontSize: 10, color: 'var(--color-muted)', marginTop: 3, textAlign: align}}>
        env. {hora}
      </div>
    )
  }

  const enTermino = d <= new Date(deadline)
  return (
    <div style={{marginTop: 4, textAlign: align}}>
      <span style={{
        display: 'inline-block',
        fontSize: 10, fontWeight: 700,
        padding: '2px 6px', borderRadius: 99,
        background: enTermino ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)',
        color: enTermino ? 'var(--color-success)' : 'var(--color-danger)',
        border: `1px solid ${enTermino ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.35)'}`,
        whiteSpace: 'nowrap',
      }}>
        {enTermino ? `✓ En término · ${hora}` : `✗ Fuera de término · ${hora}`}
      </span>
    </div>
  )
}

// Muestra el score de un pronóstico de partido
function scorePron(p) {
  if (!p) return '—'
  if (p.goles_local != null && p.goles_visitante != null) return `${p.goles_local}–${p.goles_visitante}`
  if (p.opcion_elegida) return p.opcion_elegida
  return '—'
}

function CruceCard({ cruce, fecha, esMio }) {
  const [gdtAbierto, setGdtAbierto] = useState(false)
  const [gdtResultado, setGdtResultado] = useState(null)
  const [gdtCargado, setGdtCargado] = useState(false)
  const [bloqueAbierto, setBloqueAbierto] = useState(null)   // 'A' | 'B' | null
  const [eventosData, setEventosData] = useState(null)        // { evs, pronoU1, pronoU2 }
  const [eventosCargando, setEventosCargando] = useState(false)

  const puedeVerPronos = fecha.estado === 'cerrada' || fecha.estado === 'finalizada'

  const toggleBloque = async (bloque) => {
    if (!puedeVerPronos) return
    if (bloqueAbierto === bloque) { setBloqueAbierto(null); return }
    setBloqueAbierto(bloque)
    setGdtAbierto(false)   // cerrar GDT si estaba abierto
    if (!eventosData && !eventosCargando) {
      setEventosCargando(true)
      try {
        const [evs, p1, p2] = await Promise.all([
          api.getEventos(fecha.id),
          api.getPronosticos(fecha.id, cruce.user1_id),
          api.getPronosticos(fecha.id, cruce.user2_id),
        ])
        const m1 = {}, m2 = {}
        for (const p of p1) m1[p.evento_id] = p
        for (const p of p2) m2[p.evento_id] = p
        setEventosData({ evs, pronoU1: m1, pronoU2: m2 })
      } catch (_) {}
      setEventosCargando(false)
    }
  }

  const handleGdt = async () => {
    if (!gdtCargado) {
      setGdtCargado(true)
      try {
        const gdt = await api.gdtGetResultado(cruce.id)
        if (gdt?.disponible) setGdtResultado(gdt)
      } catch (_) {}
    }
    setGdtAbierto(o => {
      if (!o) setBloqueAbierto(null)  // cerrar bloque A/B si se abre GDT
      return !o
    })
  }

  const ganador1 = cruce.ganador_fecha === 'user1'
  const ganador2 = cruce.ganador_fecha === 'user2'
  const empate   = cruce.ganador_fecha === 'empate'

  // helper para resultado de un bloque desde perspectiva user1
  const bloqueRes = (ganador, label) => {
    if (!ganador) return null
    if (ganador === 'user1') return { label, winner: 1 }
    if (ganador === 'user2') return { label, winner: 2 }
    return { label, winner: 0 } // empate
  }
  const resA = bloqueRes(cruce.ganador_tabla_a, fecha.bloque1_nombre)
  const resB = bloqueRes(cruce.ganador_tabla_b, fecha.bloque2_nombre)
  const resGDT = bloqueRes(cruce.ganador_gdt, 'GDT')

  return (
    <div style={{
      border: esMio ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      background: 'var(--color-surface)',
    }}>
      {esMio && (
        <div style={{
          background: 'var(--color-primary)', color: '#fff',
          fontSize: 11, fontWeight: 700, padding: '3px 10px',
          letterSpacing: '0.5px', textTransform: 'uppercase'
        }}>
          Tu enfrentamiento
        </div>
      )}

      <div style={{padding: '12px 14px'}}>
        {/* Marcador principal */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center', gap: 12, marginBottom: 12
        }}>
          {/* User 1 */}
          <div>
            <div style={{fontWeight: 700, fontSize: 14}}>{cruce.user1_nombre}</div>
            <div style={{
              fontSize: 36, fontWeight: 800, lineHeight: 1,
              color: ganador1 ? 'var(--color-success)' : ganador2 ? 'var(--color-danger)' : 'var(--color-text)'
            }}>
              {cruce.puntos_internos_u1 ?? '—'}
            </div>
            {cruce.pts_torneo_u1 != null && (
              <div style={{fontSize: 11, color: 'var(--color-muted)'}}>
                {cruce.pts_torneo_u1} pts torneo
              </div>
            )}
            <BadgeEnvio ts={cruce.envio_u1} deadline={fecha.deadline} align="left" />
          </div>

          {/* Centro */}
          <div style={{textAlign: 'center'}}>
            <div style={{fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, marginBottom: 4}}>VS</div>
            {cruce.ganador_fecha && (
              <div style={{
                fontSize: 12, fontWeight: 700,
                color: empate ? 'var(--color-muted)' : 'var(--color-text)'
              }}>
                {empate ? '🤝 Empate' : ganador1 ? `✅ ${cruce.user1_nombre}` : `✅ ${cruce.user2_nombre}`}
              </div>
            )}
          </div>

          {/* User 2 */}
          <div style={{textAlign: 'right'}}>
            <div style={{fontWeight: 700, fontSize: 14}}>{cruce.user2_nombre}</div>
            <div style={{
              fontSize: 36, fontWeight: 800, lineHeight: 1,
              color: ganador2 ? 'var(--color-success)' : ganador1 ? 'var(--color-danger)' : 'var(--color-text)'
            }}>
              {cruce.puntos_internos_u2 ?? '—'}
            </div>
            {cruce.pts_torneo_u2 != null && (
              <div style={{fontSize: 11, color: 'var(--color-muted)', justifyContent: 'flex-end', display: 'flex'}}>
                {cruce.pts_torneo_u2} pts torneo
              </div>
            )}
            <BadgeEnvio ts={cruce.envio_u2} deadline={fecha.deadline} align="right" />
          </div>
        </div>

        {/* Bloques */}
        <div style={{display: 'flex', gap: 6, fontSize: 12}}>
          {[
            { key: 'A', emoji: '🟩', nombre: fecha.bloque1_nombre, u1: cruce.pts_tabla_a_u1, u2: cruce.pts_tabla_a_u2, ganador: cruce.ganador_tabla_a },
            { key: 'B', emoji: '🟦', nombre: fecha.bloque2_nombre, u1: cruce.pts_tabla_b_u1, u2: cruce.pts_tabla_b_u2, ganador: cruce.ganador_tabla_b },
          ].map((b) => (
            <div key={b.key} style={{
              flex: 1, padding: '5px 8px',
              background: 'var(--color-surface2)',
              borderRadius: 6,
              border: `1px solid ${bloqueAbierto === b.key ? 'var(--color-primary)' : 'var(--color-border)'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              cursor: puedeVerPronos ? 'pointer' : 'default'
            }} onClick={() => toggleBloque(b.key)}>
              <span style={{color: 'var(--color-muted)'}}>{b.emoji} {b.nombre}</span>
              <span style={{fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3}}>
                <span style={{color: b.ganador === 'user1' ? 'var(--color-success)' : b.ganador === 'user2' ? 'var(--color-danger)' : 'var(--color-text)'}}>
                  {b.u1 ?? '—'}
                </span>
                <span style={{color: 'var(--color-muted)'}}>–</span>
                <span style={{color: b.ganador === 'user2' ? 'var(--color-success)' : b.ganador === 'user1' ? 'var(--color-danger)' : 'var(--color-text)'}}>
                  {b.u2 ?? '—'}
                </span>
                {' '}{b.ganador === 'empate' ? '🤝' : b.ganador === 'user1' || b.ganador === 'user2' ? '🏆' : ''}
                {puedeVerPronos && <span style={{fontSize: 10, color: 'var(--color-muted)'}}>{bloqueAbierto === b.key ? '▲' : '▼'}</span>}
              </span>
            </div>
          ))}

          {/* GDT */}
          <div style={{
            flex: 1, padding: '5px 8px',
            background: 'var(--color-surface2)',
            borderRadius: 6, border: `1px solid ${gdtAbierto ? 'var(--color-primary)' : 'var(--color-border)'}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            cursor: 'pointer'
          }} onClick={handleGdt}>
            <span style={{color: 'var(--color-muted)'}}>🟪 GDT</span>
            <span style={{fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4}}>
              {cruce.gdt_duelos_u1 != null
                ? <>
                    <span style={{color: cruce.ganador_gdt === 'user1' ? 'var(--color-success)' : cruce.ganador_gdt === 'user2' ? 'var(--color-danger)' : 'var(--color-text)'}}>
                      {cruce.gdt_duelos_u1}
                    </span>
                    <span style={{color: 'var(--color-muted)'}}>–</span>
                    <span style={{color: cruce.ganador_gdt === 'user2' ? 'var(--color-success)' : cruce.ganador_gdt === 'user1' ? 'var(--color-danger)' : 'var(--color-text)'}}>
                      {cruce.gdt_duelos_u2}
                    </span>
                    {' '}{cruce.ganador_gdt === 'empate' ? '🤝' : '🏆'}
                  </>
                : <span style={{color: 'var(--color-muted)', fontSize: 11}}>Pend.</span>
              }
              <span style={{fontSize: 10, color: 'var(--color-muted)'}}>{gdtAbierto ? '▲' : '▼'}</span>
            </span>
          </div>
        </div>

        {/* Detalle pronósticos Bloque A o B */}
        {bloqueAbierto && puedeVerPronos && (
          <div style={{marginTop: 8, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden'}}>
            {eventosCargando ? (
              <div style={{padding: '12px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 12}}>Cargando...</div>
            ) : eventosData ? (() => {
              const inicio = bloqueAbierto === 'A' ? 1 : 16
              const fin    = bloqueAbierto === 'A' ? 15 : 30
              const evs    = eventosData.evs.filter(e => e.orden >= inicio && e.orden <= fin)
              return (
                <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12}}>
                  <thead>
                    <tr style={{background: '#fafafa', borderBottom: '1px solid var(--color-border)'}}>
                      <th style={{padding:'5px 8px', textAlign:'left', fontSize:10, color:'var(--color-muted)', fontWeight:600, textTransform:'uppercase'}}>#</th>
                      <th style={{padding:'5px 8px', textAlign:'left', fontSize:10, color:'var(--color-muted)', fontWeight:600, textTransform:'uppercase'}}>Partido</th>
                      <th style={{padding:'5px 6px', textAlign:'center', fontSize:10, color:'var(--color-muted)', fontWeight:600, textTransform:'uppercase'}}>Pts</th>
                      <th style={{padding:'5px 8px', textAlign:'center', fontSize:10, color:'var(--color-primary)', fontWeight:700, textTransform:'uppercase'}}>{cruce.user1_nombre}</th>
                      <th style={{padding:'5px 8px', textAlign:'center', fontSize:10, color:'var(--color-muted)', fontWeight:600, textTransform:'uppercase'}}>Res.</th>
                      <th style={{padding:'5px 8px', textAlign:'center', fontSize:10, color:'var(--color-primary)', fontWeight:700, textTransform:'uppercase'}}>{cruce.user2_nombre}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evs.map(ev => {
                      const p1 = eventosData.pronoU1[ev.id]
                      const p2 = eventosData.pronoU2[ev.id]
                      const tieneRes = ev.lev_real != null || ev.resultado_json != null
                      const acerto1 = tieneRes && ev.tipo === 'partido' ? p1?.lev_pronostico === ev.lev_real : false
                      const acerto2 = tieneRes && ev.tipo === 'partido' ? p2?.lev_pronostico === ev.lev_real : false

                      // Mostrar LEV elegido si es manual o si difiere del score
                      const levLabel = (p) => {
                        if (!p || ev.tipo !== 'partido') return null
                        const lev = p.lev_pronostico
                        if (!lev) return null
                        // Calcular LEV automático del score
                        const gl = p.goles_local, gv = p.goles_visitante
                        const levAuto = gl != null && gv != null
                          ? (gl > gv ? 'L' : gl < gv ? 'V' : 'E')
                          : null
                        // Mostrar solo si es manual (override) o no coincide con el score
                        if (p.lev_manual || lev !== levAuto) {
                          const color = lev === 'L' ? 'var(--color-success)' : lev === 'V' ? 'var(--color-danger)' : 'var(--color-muted)'
                          return <span style={{fontSize:9, fontWeight:700, color, marginLeft:3, border:`1px solid ${color}`, borderRadius:3, padding:'0 2px'}}>{lev}</span>
                        }
                        return null
                      }

                      // Columna de puntos del evento
                      let ptsInfo = null
                      if (ev.tipo === 'partido') {
                        ptsInfo = (
                          <div style={{fontSize:9, color:'var(--color-muted)', lineHeight:1.3, whiteSpace:'nowrap'}}>
                            {ev.condicion && <div style={{fontWeight:600, color:'var(--color-primary)', fontSize:9}}>{ev.condicion}</div>}
                            <div>L:{ev.pts_local} E:{ev.pts_empate} V:{ev.pts_visitante} +{ev.pts_exacto}</div>
                          </div>
                        )
                      } else if (ev.tipo === 'pregunta' && ev.config_json) {
                        try {
                          const cfg = JSON.parse(ev.config_json)
                          const subtipo = cfg.subtipo
                          if (subtipo === 'binaria') {
                            // Mostrar pts de cada opción
                            const lineas = (cfg.opciones || []).map(o =>
                              `${o.label}: ${o.pts ?? 0}pts`
                            )
                            ptsInfo = (
                              <div style={{fontSize:9, color:'var(--color-muted)', lineHeight:1.3, whiteSpace:'nowrap'}}>
                                {lineas.map((l, i) => <div key={i}>{l}</div>)}
                              </div>
                            )
                          } else if (subtipo === 'opcion_unica') {
                            ptsInfo = (
                              <div style={{fontSize:9, color:'var(--color-muted)', lineHeight:1.3, whiteSpace:'nowrap'}}>
                                <div>Correcto: {cfg.pts ?? 0}pts</div>
                              </div>
                            )
                          } else if (subtipo === 'multi_select') {
                            ptsInfo = (
                              <div style={{fontSize:9, color:'var(--color-muted)', lineHeight:1.3, whiteSpace:'nowrap'}}>
                                <div>{cfg.pts ?? 0}pts c/u</div>
                              </div>
                            )
                          }
                        } catch (e) { /* config_json inválido, no mostrar nada */ }
                      }

                      return (
                        <tr key={ev.id} style={{borderBottom: '1px solid var(--color-border)'}}>
                          <td style={{padding:'5px 8px', color:'var(--color-muted)'}}>{ev.orden}</td>
                          <td style={{padding:'5px 8px'}}>
                            {ev.tipo === 'partido'
                              ? <>{ev.local} <span style={{color:'var(--color-muted)'}}>vs</span> {ev.visitante}</>
                              : <span style={{color:'var(--color-muted)', fontStyle:'italic'}}>{ev.pregunta_texto}</span>
                            }
                          </td>
                          <td style={{padding:'5px 6px', textAlign:'center'}}>{ptsInfo}</td>
                          <td style={{padding:'5px 8px', textAlign:'center', fontWeight: acerto1 ? 700 : 400,
                            color: tieneRes ? (acerto1 ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--color-muted)'
                          }}>
                            {scorePron(p1)}{levLabel(p1)}
                            {p1?.puntos_obtenidos != null && <span style={{fontSize:10, marginLeft:3}}>({p1.puntos_obtenidos}pts)</span>}
                          </td>
                          <td style={{padding:'5px 8px', textAlign:'center', fontWeight:600}}>
                            {ev.tipo === 'partido' && ev.resultado_local != null
                              ? `${ev.resultado_local}–${ev.resultado_visitante}`
                              : '—'
                            }
                          </td>
                          <td style={{padding:'5px 8px', textAlign:'center', fontWeight: acerto2 ? 700 : 400,
                            color: tieneRes ? (acerto2 ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--color-muted)'
                          }}>
                            {scorePron(p2)}{levLabel(p2)}
                            {p2?.puntos_obtenidos != null && <span style={{fontSize:10, marginLeft:3}}>({p2.puntos_obtenidos}pts)</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )
            })() : null}
          </div>
        )}

        {/* GDT detalle colapsable */}
        {gdtResultado && gdtAbierto && (
          <div style={{marginTop: 8, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden'}}>
            <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12}}>
              <thead>
                <tr style={{background: '#fafafa', borderBottom: '1px solid var(--color-border)'}}>
                  {['Slot', cruce.user1_nombre, 'Pts', '—', 'Pts', cruce.user2_nombre, ''].map((h, i) => (
                    <th key={i} style={{
                      padding: '5px 7px', fontSize: 10, fontWeight: 600,
                      color: 'var(--color-muted)', textTransform: 'uppercase',
                      textAlign: i === 0 || i === 1 ? 'left' : i === 5 ? 'right' : 'center'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gdtResultado.duelos.map(d => {
                  const gana1 = d.ganador === 'a'
                  const gana2 = d.ganador === 'b'
                  const pendiente = d.ganador === 'pendiente'
                  const td = { padding: '5px 7px', fontSize: 12 }
                  return (
                    <tr key={d.slot} style={{borderBottom: '1px solid var(--color-border)'}}>
                      <td style={{...td, color: 'var(--color-primary)', fontWeight: 700}}>{d.slot}</td>
                      <td style={{...td, color: d.eliminado_u1 ? 'var(--color-danger)' : 'inherit'}}>
                        {d.jugador_u1 || '—'}
                        {d.equipo_u1 && <span style={{color: 'var(--color-muted)', fontSize: 10}}> ({d.equipo_u1})</span>}
                        {d.eliminado_u1 ? ' ❌' : ''}
                      </td>
                      <td style={{...td, textAlign: 'center', fontWeight: 700, color: gana1 ? 'var(--color-success)' : 'inherit'}}>
                        {!d.hayPuntaje_u1 ? <span style={{color: 'var(--color-muted)', fontWeight: 400}}>—</span>
                          : d.hayPuntaje_u1 && !d.jugo_u1 && !d.eliminado_u1
                            ? <span>{d.pts_u1} <span style={{fontSize: 9, color: 'var(--color-muted)', fontWeight: 400}}>NJ</span></span>
                            : d.pts_u1}
                      </td>
                      <td style={{...td, textAlign: 'center', color: 'var(--color-muted)'}}>vs</td>
                      <td style={{...td, textAlign: 'center', fontWeight: 700, color: gana2 ? 'var(--color-success)' : 'inherit'}}>
                        {!d.hayPuntaje_u2 ? <span style={{color: 'var(--color-muted)', fontWeight: 400}}>—</span>
                          : d.hayPuntaje_u2 && !d.jugo_u2 && !d.eliminado_u2
                            ? <span>{d.pts_u2} <span style={{fontSize: 9, color: 'var(--color-muted)', fontWeight: 400}}>NJ</span></span>
                            : d.pts_u2}
                      </td>
                      <td style={{...td, textAlign: 'right', color: d.eliminado_u2 ? 'var(--color-danger)' : 'var(--color-muted)'}}>
                        {d.eliminado_u2 ? '❌ ' : ''}
                        {d.jugador_u2 || '—'}
                        {d.equipo_u2 && <span style={{color: 'var(--color-muted)', fontSize: 10}}> ({d.equipo_u2})</span>}
                      </td>
                      <td style={{...td, textAlign: 'center'}}>
                        {pendiente ? '⏳' : d.ganador === 'empate' ? '🤝' : gana1 ? '🏆' : '🏆'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '7px 10px', background: '#fafafa',
              borderTop: '1px solid var(--color-border)', fontSize: 12
            }}>
              <span>
                <strong style={{color: gdtResultado.ganador_gdt === 'user1' ? 'var(--color-success)' : 'var(--color-muted)'}}>{gdtResultado.duelos_u1}</strong>
                {' duelos '}<strong style={{color: 'var(--color-muted)'}}>–</strong>{' '}
                <strong style={{color: gdtResultado.ganador_gdt === 'user2' ? 'var(--color-success)' : 'var(--color-muted)'}}>{gdtResultado.duelos_u2}</strong>
                {' duelos'}
              </span>
              <strong style={{color: gdtResultado.ganador_gdt === 'empate' ? 'var(--color-muted)' : 'var(--color-success)'}}>
                {gdtResultado.ganador_gdt === 'empate'
                  ? 'GDT: Empate 🤝'
                  : gdtResultado.ganador_gdt === 'user1'
                    ? `GDT: ${cruce.user1_nombre} ✅`
                    : `GDT: ${cruce.user2_nombre} ✅`
                }
              </strong>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Color de posición: gradiente verde → amarillo → rojo según ranking
function posColor(pos, total) {
  const ratio = total <= 1 ? 0 : (pos - 1) / (total - 1)
  if (ratio <= 0.5) {
    const t = ratio * 2
    const r = Math.round(t * 255)
    const g = Math.round(176 + t * (255 - 176))
    const b = Math.round(80 * (1 - t))
    return `rgb(${r},${g},${b})`
  } else {
    const t = (ratio - 0.5) * 2
    const r = 255
    const g = Math.round(255 * (1 - t))
    return `rgb(${r},${g},0)`
  }
}

// Tabla de totales acumulados por bloque
function TablaBloqueTotal({ bloque, cruces, bloqueKey }) {
  if (!bloque || bloque.jugadores.length === 0) return null
  const { nombre, jugadores } = bloque
  const n = jugadores.length

  // Cruces de esta fecha con puntaje de bloque
  const filasCruces = (cruces || [])
    .map(c => ({
      u1: c.user1_nombre,
      u2: c.user2_nombre,
      p1: bloqueKey === 'a' ? c.pts_tabla_a_u1 : c.pts_tabla_b_u1,
      p2: bloqueKey === 'a' ? c.pts_tabla_a_u2 : c.pts_tabla_b_u2,
    }))
    .filter(r => r.p1 != null)

  const bdr = '1px solid #d0d0d0'

  return (
    <div style={{marginTop: 20}}>
      {/* Título */}
      <div style={{fontWeight: 800, fontSize: 13, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.3px'}}>
        TOTAL {nombre}
      </div>

      {/* Ranking */}
      <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 13, border: bdr}}>
        <tbody>
          {jugadores.map((j, idx) => {
            const pos = idx + 1
            const bg = posColor(pos, n)
            // color de texto: claro si fondo oscuro (verde/rojo intenso), oscuro si amarillo
            const textCol = (pos === 1 && n > 3) || pos === n ? '#fff' : '#000'
            return (
              <tr key={j.user_id} style={{borderBottom: bdr}}>
                <td style={{padding: '5px 12px', fontWeight: 700, borderRight: bdr}}>{j.nombre}</td>
                <td style={{padding: '5px 12px', textAlign: 'right', borderRight: bdr, fontWeight: 600}}>{j.total_pts}</td>
                <td style={{
                  padding: '5px 0', background: bg, textAlign: 'center',
                  fontWeight: 800, width: 34, color: textCol, fontSize: 12
                }}>
                  {pos}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Cruces de esta fecha */}
      {filasCruces.length > 0 && (
        <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12, border: bdr, borderTop: '2px solid #999', marginTop: 1}}>
          <tbody>
            {filasCruces.map((r, i) => (
              <tr key={i} style={{borderBottom: '1px solid #e8e8e8'}}>
                <td style={{padding: '4px 10px', fontWeight: 600}}>{r.u1}</td>
                <td style={{padding: '4px 8px', textAlign: 'right', fontWeight: 700}}>{r.p1}</td>
                <td style={{padding: '4px 8px', textAlign: 'left', fontWeight: 700, color: 'var(--color-muted)'}}>{r.p2}</td>
                <td style={{padding: '4px 10px', fontWeight: 600, textAlign: 'right'}}>{r.u2}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default function Enfrentamientos() {
  const { fechaId } = useParams()
  const { user } = useAuth()
  const [fecha, setFecha] = useState(null)
  const [cruces, setCruces] = useState([])
  const [totales, setTotales] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [f, cs] = await Promise.all([
          api.getFecha(fechaId),
          api.getCruces(fechaId)
        ])
        setFecha(f)
        setCruces(cs)
        // Cargar totales de bloque en paralelo (no bloquea la carga principal)
        if (f.torneo_id) {
          api.getTotalesBloque(f.torneo_id, f.id).then(setTotales).catch(() => {})
        }
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [fechaId])

  if (loading) return <div className="loading">Cargando...</div>
  if (error)   return <div className="error-msg">{error}</div>

  return (
    <div>
      {/* Header */}
      <div className="flex-between mb-16">
        <div>
          <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4}}>
            <Link to={`/fecha/${fechaId}`} className="btn btn-secondary btn-sm">← Volver</Link>
            <span className={`badge ${ESTADO_LABEL[fecha.estado]?.cls}`}>{ESTADO_LABEL[fecha.estado]?.label}</span>
          </div>
          <div className="page-title">{fecha.nombre} · Enfrentamientos</div>
          <div className="text-muted" style={{fontSize: 13}}>
            {fecha.bloque1_nombre} · {fecha.bloque2_nombre}
          </div>
        </div>
      </div>

      {cruces.length === 0 ? (
        <div className="card" style={{textAlign: 'center', padding: 40}}>
          <p className="text-muted">Todavía no hay fixture definido para esta fecha.</p>
        </div>
      ) : (
        <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
          {cruces.map(c => {
            const esMio = c.user1_id === user.id || c.user2_id === user.id
            return (
              <CruceCard
                key={c.id}
                cruce={c}
                fecha={fecha}
                esMio={esMio}
              />
            )
          })}
        </div>
      )}

      {/* Tablas acumuladas por bloque */}
      {totales && (totales.bloque_a?.jugadores?.length > 0 || totales.bloque_b?.jugadores?.length > 0) && (
        <div style={{marginTop: 32}}>
          <TablaBloqueTotal bloque={totales.bloque_a} cruces={cruces} bloqueKey="a" />
          <TablaBloqueTotal bloque={totales.bloque_b} cruces={cruces} bloqueKey="b" />
        </div>
      )}
    </div>
  )
}
