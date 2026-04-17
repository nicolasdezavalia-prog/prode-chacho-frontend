import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/index.js'
import { useAuth } from '../App.jsx'

const ESTADO_LABEL = {
  borrador:   { label: 'Borrador',   cls: 'badge-borrador'   },
  abierta:    { label: 'Abierta',    cls: 'badge-abierta'    },
  cerrada:    { label: 'Cerrada',    cls: 'badge-cerrada'    },
  finalizada: { label: 'Finalizada', cls: 'badge-finalizada' },
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// ─── Componente reutilizable de detalle de cruce ─────────────────────────────
function CruceDetalle({ cruce, fecha, gdtResultado }) {
  const [gdtAbierto, setGdtAbierto] = useState(false)
  const [bloqueAbierto, setBloqueAbierto] = useState(null) // 'A' | 'B' | null
  const [eventosData, setEventosData] = useState(null)
  const [eventosCargando, setEventosCargando] = useState(false)

  const puedeVerRival = fecha.estado === 'cerrada' || fecha.estado === 'finalizada'

  const toggleBloque = async (bloque) => {
    if (bloqueAbierto === bloque) { setBloqueAbierto(null); return }
    setBloqueAbierto(bloque)
    if (!eventosData && !eventosCargando) {
      setEventosCargando(true)
      try {
        const loads = [api.getEventos(fecha.id), api.getPronosticos(fecha.id)]
        if (puedeVerRival && cruce.rival_id) loads.push(api.getPronosticos(fecha.id, cruce.rival_id))
        const [evs, pronos, rivalPronos] = await Promise.all(loads)
        const pronoMap = {}, pronoRivalMap = {}
        for (const p of pronos) pronoMap[p.evento_id] = p
        if (rivalPronos) for (const p of rivalPronos) pronoRivalMap[p.evento_id] = p
        setEventosData({ evs, pronoMap, pronoRivalMap })
      } catch (_) {}
      setEventosCargando(false)
    }
  }

  const gane  = cruce.yo_ganador_fecha === true
  const perdi = cruce.yo_ganador_fecha === false && cruce.ganador_fecha && cruce.ganador_fecha !== 'empate'
  const empate = cruce.ganador_fecha === 'empate'

  const resultadoLabel = () => {
    if (!cruce.ganador_fecha) return null
    if (empate) return { texto: 'EMPATE', color: 'var(--color-muted)' }
    if (gane)   return { texto: 'GANANDO ✅', color: 'var(--color-success)' }
    return { texto: 'PERDIENDO ❌', color: 'var(--color-danger)' }
  }
  const res = resultadoLabel()

  return (
    <div style={{
      background: 'var(--color-surface2)',
      borderRadius: 'var(--radius)',
      padding: '12px 14px',
    }}>
      {/* Marcador principal */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center', gap: 12, marginBottom: 10
      }}>
        {/* Yo */}
        <div>
          <div style={{fontWeight: 700, fontSize: 13}}>
            {cruce.yo_nombre} <span style={{fontSize: 11, color: 'var(--color-muted)'}}>(vos)</span>
          </div>
          <div style={{
            fontSize: 32, fontWeight: 800, lineHeight: 1,
            color: gane ? 'var(--color-success)' : perdi ? 'var(--color-danger)' : 'var(--color-text)'
          }}>
            {cruce.yo_puntos_internos ?? '—'}
          </div>
        </div>
        {/* Centro */}
        <div style={{textAlign: 'center'}}>
          <div style={{fontSize: 12, color: 'var(--color-muted)', fontWeight: 600}}>VS</div>
          {res && (
            <div style={{fontSize: 11, fontWeight: 700, color: res.color, marginTop: 4, whiteSpace: 'nowrap'}}>
              {res.texto}
            </div>
          )}
        </div>
        {/* Rival */}
        <div style={{textAlign: 'right'}}>
          <div style={{fontWeight: 700, fontSize: 13}}>{cruce.rival_nombre}</div>
          <div style={{
            fontSize: 32, fontWeight: 800, lineHeight: 1,
            color: perdi ? 'var(--color-success)' : gane ? 'var(--color-danger)' : 'var(--color-text)'
          }}>
            {cruce.rival_puntos_internos ?? '—'}
          </div>
        </div>
      </div>

      {/* Chips de bloques */}
      <div style={{display: 'flex', gap: 6, fontSize: 12}}>
        {[
          { key: 'A', emoji: '🟩', nombre: fecha.bloque1_nombre, yoPts: cruce.yo_pts_tabla_a, rivalPts: cruce.rival_pts_tabla_a, ganador: cruce.ganador_tabla_a, yoGana: cruce.yo_ganador_tabla_a },
          { key: 'B', emoji: '🟦', nombre: fecha.bloque2_nombre, yoPts: cruce.yo_pts_tabla_b, rivalPts: cruce.rival_pts_tabla_b, ganador: cruce.ganador_tabla_b, yoGana: cruce.yo_ganador_tabla_b },
        ].map(b => (
          <div key={b.key} style={{
            flex: 1, padding: '5px 8px', background: 'var(--color-surface)',
            borderRadius: 6, border: `1px solid ${bloqueAbierto === b.key ? 'var(--color-primary)' : 'var(--color-border)'}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            cursor: 'pointer'
          }}
            onClick={() => toggleBloque(b.key)}
          >
            <span style={{color: 'var(--color-muted)'}}>{b.emoji} {b.nombre}</span>
            <span style={{fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4}}>
              {b.yoPts} – {b.rivalPts}
              {' '}{b.ganador === 'empate' ? '🤝' : b.yoGana ? '✅' : '❌'}
              <span style={{fontSize: 10, color: 'var(--color-muted)'}}>{bloqueAbierto === b.key ? '▲' : '▼'}</span>
            </span>
          </div>
        ))}
        {/* GDT */}
        <div style={{
          flex: 1, padding: '5px 8px', background: 'var(--color-surface)',
          borderRadius: 6, border: `1px solid ${gdtAbierto ? 'var(--color-primary)' : 'var(--color-border)'}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: gdtResultado ? 'pointer' : 'default'
        }}
          onClick={() => gdtResultado && setGdtAbierto(!gdtAbierto)}
        >
          <span style={{color: 'var(--color-muted)'}}>🟪 GDT</span>
          <span style={{fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4}}>
            {cruce.yo_gdt_duelos != null
              ? <>{cruce.yo_gdt_duelos} – {cruce.rival_gdt_duelos} {cruce.ganador_gdt === 'empate' ? '🤝' : cruce.yo_ganador_gdt ? '✅' : '❌'}</>
              : <span style={{color: 'var(--color-muted)', fontSize: 11}}>Pend.</span>
            }
            {gdtResultado && <span style={{fontSize: 10, color: 'var(--color-muted)', marginLeft: 2}}>{gdtAbierto ? '▲' : '▼'}</span>}
          </span>
        </div>
      </div>

      {/* Detalle Bloque A o B */}
      {bloqueAbierto && (
        <div style={{marginTop: 8, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden'}}>
          {eventosCargando ? (
            <div style={{padding: '12px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 12}}>Cargando...</div>
          ) : eventosData ? (() => {
            const inicio = bloqueAbierto === 'A' ? 1 : 16
            const fin    = bloqueAbierto === 'A' ? 15 : 30
            const evs    = eventosData.evs.filter(e => e.orden >= inicio && e.orden <= fin)
            const th = {padding:'5px 8px', fontSize:10, fontWeight:600, textTransform:'uppercase'}
            const td = {padding:'5px 8px'}
            const showPron = (p, ev) => {
              if (!p) return '—'
              if (ev.tipo === 'partido') return p.goles_local != null ? `${p.goles_local}-${p.goles_visitante}` : '—'
              return p.opcion_elegida || '—'
            }
            return (
              <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12}}>
                <thead>
                  <tr style={{background: '#fafafa', borderBottom: '1px solid var(--color-border)'}}>
                    <th style={{...th, textAlign:'left', color:'var(--color-muted)'}}>#</th>
                    <th style={{...th, textAlign:'left', color:'var(--color-muted)'}}>Partido</th>
                    {puedeVerRival ? (
                      <>
                        <th style={{...th, textAlign:'center', color:'var(--color-primary)'}}>{cruce.yo_nombre}</th>
                        <th style={{...th, textAlign:'center', color:'var(--color-muted)'}}>Res.</th>
                        <th style={{...th, textAlign:'center', color:'var(--color-muted)'}}>{cruce.rival_nombre}</th>
                      </>
                    ) : (
                      <>
                        <th style={{...th, textAlign:'center', color:'var(--color-muted)'}}>Pron.</th>
                        <th style={{...th, textAlign:'center', color:'var(--color-muted)'}}>Res.</th>
                        <th style={{...th, textAlign:'center', color:'var(--color-muted)'}}>Pts</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {evs.map(ev => {
                    const p      = eventosData.pronoMap[ev.id]
                    const pRival = eventosData.pronoRivalMap?.[ev.id]
                    const tieneRes   = ev.lev_real != null || ev.resultado_json != null
                    const acerto      = tieneRes && ev.tipo === 'partido' ? p?.lev_pronostico === ev.lev_real : false
                    const acertoRival = tieneRes && ev.tipo === 'partido' ? pRival?.lev_pronostico === ev.lev_real : false
                    return (
                      <tr key={ev.id} style={{borderBottom: '1px solid var(--color-border)'}}>
                        <td style={{...td, color:'var(--color-muted)'}}>{ev.orden}</td>
                        <td style={td}>
                          {ev.tipo === 'partido'
                            ? <>{ev.local} <span style={{color:'var(--color-muted)'}}>vs</span> {ev.visitante}</>
                            : <span style={{color:'var(--color-muted)'}}>❓ {ev.pregunta_texto}</span>
                          }
                        </td>
                        {puedeVerRival ? (
                          <>
                            <td style={{...td, textAlign:'center', fontWeight: acerto ? 700 : 400,
                              color: tieneRes ? (acerto ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--color-muted)'
                            }}>
                              {showPron(p, ev)}
                              {tieneRes && p?.puntos_obtenidos != null && (
                                <span style={{fontSize:10, marginLeft:3, opacity:0.8}}>({p.puntos_obtenidos})</span>
                              )}
                            </td>
                            <td style={{...td, textAlign:'center', fontWeight:600}}>
                              {ev.tipo === 'partido' && ev.resultado_local != null
                                ? `${ev.resultado_local}-${ev.resultado_visitante}` : '—'}
                            </td>
                            <td style={{...td, textAlign:'center', fontWeight: acertoRival ? 700 : 400,
                              color: tieneRes ? (acertoRival ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--color-muted)'
                            }}>
                              {showPron(pRival, ev)}
                              {tieneRes && pRival?.puntos_obtenidos != null && (
                                <span style={{fontSize:10, marginLeft:3, opacity:0.8}}>({pRival.puntos_obtenidos})</span>
                              )}
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{...td, textAlign:'center', color:'var(--color-muted)'}}>
                              {showPron(p, ev)}
                            </td>
                            <td style={{...td, textAlign:'center', fontWeight:600}}>
                              {ev.tipo === 'partido' && ev.resultado_local != null
                                ? `${ev.resultado_local}-${ev.resultado_visitante}` : '—'}
                            </td>
                            <td style={{...td, textAlign:'center', fontWeight:700,
                              color: (p?.puntos_obtenidos || 0) > 0 ? 'var(--color-success)' : 'var(--color-muted)'
                            }}>
                              {tieneRes ? (p?.puntos_obtenidos ?? 0) : '—'}
                            </td>
                          </>
                        )}
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
                {['Slot','Tu jugador','Pts','—','Pts','Rival',''].map((h, i) => (
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
                const yo     = cruce.yo_es_user1
                const miJug  = yo ? d.jugador_u1 : d.jugador_u2
                const miEq   = yo ? d.equipo_u1  : d.equipo_u2
                const rvJug  = yo ? d.jugador_u2 : d.jugador_u1
                const rvEq   = yo ? d.equipo_u2  : d.equipo_u1
                const miPts  = yo ? d.pts_u1 : d.pts_u2
                const rvPts  = yo ? d.pts_u2 : d.pts_u1
                const miElim = yo ? d.eliminado_u1 : d.eliminado_u2
                const rvElim = yo ? d.eliminado_u2 : d.eliminado_u1
                const miGana = (yo && d.ganador === 'a') || (!yo && d.ganador === 'b')
                const rvGana = (yo && d.ganador === 'b') || (!yo && d.ganador === 'a')
                const td = {padding: '5px 7px', fontSize: 12}
                return (
                  <tr key={d.slot} style={{borderBottom: '1px solid var(--color-border)'}}>
                    <td style={{...td, color: 'var(--color-primary)', fontWeight: 700}}>{d.slot}</td>
                    <td style={{...td, color: miElim ? 'var(--color-danger)' : 'inherit'}}>
                      {miJug || '—'}{miEq && <span style={{color:'var(--color-muted)',fontSize:10}}> ({miEq})</span>}{miElim ? ' ❌' : ''}
                    </td>
                    <td style={{...td, textAlign:'center', fontWeight:700, color: miGana ? 'var(--color-success)' : 'inherit'}}>{miPts}</td>
                    <td style={{...td, textAlign:'center', color:'var(--color-muted)'}}>vs</td>
                    <td style={{...td, textAlign:'center', fontWeight:700, color: rvGana ? 'var(--color-danger)' : 'inherit'}}>{rvPts}</td>
                    <td style={{...td, textAlign:'right', color: rvElim ? 'var(--color-danger)' : 'var(--color-muted)'}}>
                      {rvElim ? '❌ ' : ''}{rvJug || '—'}{rvEq && <span style={{color:'var(--color-muted)',fontSize:10}}> ({rvEq})</span>}
                    </td>
                    <td style={{...td, textAlign:'center'}}>{d.ganador === 'empate' ? '🤝' : miGana ? '✅' : '❌'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{display:'flex', justifyContent:'space-between', padding:'7px 10px', background:'#fafafa', borderTop:'1px solid var(--color-border)', fontSize:12}}>
            <span>Duelos: <strong style={{color:'var(--color-primary)'}}>{cruce.yo_es_user1 ? gdtResultado.duelos_u1 : gdtResultado.duelos_u2}</strong> – <strong style={{color:'var(--color-muted)'}}>{cruce.yo_es_user1 ? gdtResultado.duelos_u2 : gdtResultado.duelos_u1}</strong></span>
            <strong style={{color: gdtResultado.ganador_gdt === 'empate' ? 'var(--color-muted)' : ((cruce.yo_es_user1 && gdtResultado.ganador_gdt === 'user1') || (!cruce.yo_es_user1 && gdtResultado.ganador_gdt === 'user2')) ? 'var(--color-success)' : 'var(--color-danger)'}}>
              {gdtResultado.ganador_gdt === 'empate' ? 'GDT: Empate' : ((cruce.yo_es_user1 && gdtResultado.ganador_gdt === 'user1') || (!cruce.yo_es_user1 && gdtResultado.ganador_gdt === 'user2')) ? 'GDT: Ganaste ✅' : 'GDT: Perdiste ❌'}
            </strong>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Item colapsable de fecha en la lista ────────────────────────────────────
function FechaItem({ fecha, cruce, user }) {
  const [abierto, setAbierto] = useState(fecha.estado === 'abierta' || fecha.estado === 'cerrada')
  const [gdtResultado, setGdtResultado] = useState(null)
  const [gdtCargado, setGdtCargado] = useState(false)

  // Carga el GDT la primera vez que se expande
  const handleToggle = async () => {
    const nuevo = !abierto
    setAbierto(nuevo)
    if (nuevo && cruce?.id && !gdtCargado) {
      setGdtCargado(true)
      try {
        const gdt = await api.gdtGetResultado(cruce.id)
        if (gdt?.disponible) setGdtResultado(gdt)
      } catch (_) {}
    }
  }

  const gane  = cruce?.yo_ganador_fecha === true
  const perdi = cruce?.yo_ganador_fecha === false && cruce?.ganador_fecha && cruce?.ganador_fecha !== 'empate'
  const empate = cruce?.ganador_fecha === 'empate'

  return (
    <div style={{borderBottom: '1px solid var(--color-border)'}}>
      {/* Cabecera clickeable */}
      <div
        onClick={handleToggle}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 0', cursor: 'pointer', userSelect: 'none'
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
          {/* Indicador resultado si está colapsado */}
          {cruce?.ganador_fecha && !abierto && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: gane ? '#dcfce7' : perdi ? '#fee2e2' : '#f4f4f5',
              color: gane ? 'var(--color-success)' : perdi ? 'var(--color-danger)' : 'var(--color-muted)'
            }}>
              {gane ? 'G' : perdi ? 'P' : 'E'}
            </span>
          )}
          <div>
            <div style={{fontWeight: 600, fontSize: 14}}>{fecha.nombre}</div>
            <div style={{fontSize: 11, color: 'var(--color-muted)'}}>
              {fecha.bloque1_nombre} · {fecha.bloque2_nombre}
              {/* Resumen rival cuando está colapsado */}
              {cruce && !abierto && (
                <span style={{marginLeft: 8}}>
                  · vs <strong>{cruce.rival_nombre}</strong>
                  {cruce.yo_puntos_internos != null && (
                    <span style={{marginLeft: 4, color: gane ? 'var(--color-success)' : perdi ? 'var(--color-danger)' : 'var(--color-text)', fontWeight: 600}}>
                      {cruce.yo_puntos_internos}–{cruce.rival_puntos_internos}
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-8" style={{alignItems: 'center'}}>
          <span className={`badge ${ESTADO_LABEL[fecha.estado]?.cls}`}>{ESTADO_LABEL[fecha.estado]?.label}</span>
          {fecha.estado !== 'borrador' && (
            <Link to={`/fecha/${fecha.id}`} className="btn btn-secondary btn-sm" onClick={e => e.stopPropagation()}>Ver</Link>
          )}
          {fecha.estado !== 'borrador' && (
            <Link to={`/fecha/${fecha.id}/enfrentamientos`} className="btn btn-secondary btn-sm" onClick={e => e.stopPropagation()}>⚔️</Link>
          )}
          {user.role === 'admin' && (
            <Link to={`/admin/fecha/${fecha.id}`} className="btn btn-secondary btn-sm" onClick={e => e.stopPropagation()}>Admin</Link>
          )}
          <span style={{color: 'var(--color-muted)', fontSize: 12}}>{abierto ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Detalle colapsable */}
      {abierto && cruce && (
        <div style={{paddingBottom: 12}}>
          <CruceDetalle cruce={cruce} fecha={fecha} gdtResultado={gdtResultado} />
        </div>
      )}
      {abierto && !cruce && (
        <div style={{paddingBottom: 12, fontSize: 13, color: 'var(--color-muted)'}}>
          Sin cruce asignado
        </div>
      )}
    </div>
  )
}

// ─── Home ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [torneoActivo, setTorneoActivo] = useState(null)
  const [fechas, setFechas] = useState([])
  const [tabla, setTabla] = useState([])
  const [tablaMensual, setTablaMensual] = useState([])
  const [cruce, setCruce] = useState(null)
  const [misCruces, setMisCruces] = useState({})
  const [gdtResultado, setGdtResultado] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const mesActual  = new Date().getMonth() + 1
  const anioActual = new Date().getFullYear()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const ts = await api.getTorneos()
      const activo = ts.find(t => t.activo === 1) || ts[0]
      if (!activo) return

      setTorneoActivo(activo)
      const [fs, tb] = await Promise.all([
        api.getFechas(activo.id),
        api.getTablaGeneral(activo.id)
      ])
      setFechas(fs)
      setTabla(tb)

      try {
        const tm = await api.getTablaMensual(activo.id, mesActual, anioActual)
        setTablaMensual(tm)
      } catch (_) {}

      try {
        const mc = await api.getMisCruces(activo.id)
        const map = {}
        for (const c of mc) map[c.fecha_id] = c
        setMisCruces(map)
      } catch (_) {}

      const fechaActiva = [...fs].reverse().find(f => f.estado === 'abierta' || f.estado === 'cerrada')
      if (fechaActiva) {
        try {
          const c = await api.getMiCruce(fechaActiva.id)
          setCruce(c)
          if (c?.id) {
            try {
              const gdt = await api.gdtGetResultado(c.id)
              if (gdt?.disponible) setGdtResultado(gdt)
            } catch (_) {}
          }
        } catch (_) {}
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading">Cargando...</div>

  const fechasVisibles = fechas.filter(f => f.estado !== 'borrador' || user.role === 'admin')
  const ultimaFecha    = [...fechasVisibles].reverse().find(f => f.estado === 'abierta' || f.estado === 'cerrada')
    || fechasVisibles[fechasVisibles.length - 1]
  const miPosicion     = tabla.findIndex(t => t.user_id === user.id) + 1
  const miEntrada      = tabla.find(t => t.user_id === user.id)
  const mensualConDatos = tablaMensual.filter(r => r.pj > 0)

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <div className="page-title">Bienvenido, {user.nombre} 👋</div>
          {torneoActivo && (
            <p className="text-muted" style={{fontSize: 13}}>
              {torneoActivo.nombre} · {torneoActivo.semestre}
            </p>
          )}
        </div>
        {user.role === 'admin' && (
          <Link to="/admin/fecha/nueva" className="btn btn-primary">+ Nueva Fecha</Link>
        )}
      </div>

      {error && <div className="error-msg">{error}</div>}

      {!torneoActivo ? (
        <div className="card" style={{textAlign: 'center', padding: 40}}>
          <p className="text-muted" style={{marginBottom: 12}}>No hay torneos activos</p>
          {user.role === 'admin' && (
            <button className="btn btn-primary" onClick={() => navigate('/admin/torneo/nuevo')}>Crear torneo</button>
          )}
        </div>
      ) : (
        <div style={{display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start'}}>

          {/* ── Columna principal ── */}
          <div>

            {/* Card fecha actual */}
            {ultimaFecha && (ultimaFecha.estado === 'abierta' || ultimaFecha.estado === 'cerrada') && (
              <div className="card" style={{marginBottom: 16, borderColor: 'var(--color-primary)'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14}}>
                  <div>
                    <div style={{fontSize: 11, color: 'var(--color-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.5px'}}>Fecha actual</div>
                    <div style={{fontSize: 18, fontWeight: 700}}>{ultimaFecha.nombre}</div>
                    <div style={{fontSize: 12, color: 'var(--color-muted)'}}>{ultimaFecha.bloque1_nombre} · {ultimaFecha.bloque2_nombre}</div>
                  </div>
                  <span className={`badge ${ESTADO_LABEL[ultimaFecha.estado].cls}`}>{ESTADO_LABEL[ultimaFecha.estado].label}</span>
                </div>

                {cruce
                  ? <div style={{marginBottom: 14}}><CruceDetalle cruce={cruce} fecha={ultimaFecha} gdtResultado={gdtResultado} /></div>
                  : <div style={{background:'var(--color-surface2)', borderRadius:'var(--radius)', padding:'12px 14px', marginBottom:14, fontSize:13, color:'var(--color-muted)', textAlign:'center'}}>Sin cruce asignado para esta fecha</div>
                }

                <div style={{display: 'flex', gap: 8}}>
                  <Link to={`/fecha/${ultimaFecha.id}/enfrentamientos`} className="btn btn-secondary" style={{flexShrink: 0}}>
                    ⚔️ Enfrentamientos
                  </Link>
                  <Link to={`/fecha/${ultimaFecha.id}`} className="btn btn-primary btn-lg" style={{flex: 1, justifyContent:'center'}}>
                    Ver mi fecha →
                  </Link>
                </div>
              </div>
            )}

            {/* Lista de fechas */}
            <div className="card">
              <div className="card-header">
                Fechas del torneo
                {user.role === 'admin' && <Link to="/admin/fecha/nueva" className="btn btn-secondary btn-sm">+ Nueva</Link>}
              </div>
              {fechasVisibles.length === 0 ? (
                <p className="text-muted" style={{textAlign: 'center', padding: '24px 0'}}>No hay fechas todavía</p>
              ) : (
                <div>
                  {fechasVisibles.slice().reverse().map(fecha => {
                    const c = misCruces[fecha.id]
                    return <FechaItem key={fecha.id} fecha={fecha} cruce={c} user={user} />
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Sidebar ── */}
          <div>
            {miEntrada && (
              <div className="card" style={{marginBottom: 16}}>
                <div className="card-header">Tu posición</div>
                <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
                  <div style={{fontSize: 48, fontWeight: 800, color: 'var(--color-primary)'}}>#{miPosicion}</div>
                  <div>
                    <div style={{fontWeight: 600}}>{user.nombre}</div>
                    <div style={{fontSize: 13, color: 'var(--color-muted)'}}>{miEntrada.puntos} pts · {miEntrada.pj} PJ</div>
                    <div style={{fontSize: 12, color: 'var(--color-muted)'}}>
                      {miEntrada.victorias}V {miEntrada.empates}E {miEntrada.derrotas}D
                      {miEntrada.bonus > 0 && ` · Bonus: ${miEntrada.bonus}`}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tabla.length > 0 && (
              <div className="card" style={{marginBottom: 16}}>
                <div className="card-header">
                  Tabla general
                  <Link to={`/tabla/${torneoActivo.id}`} className="btn btn-secondary btn-sm">Ver completa</Link>
                </div>
                <table className="liga-table">
                  <thead><tr><th>#</th><th style={{textAlign:'left'}}>Jugador</th><th>PJ</th><th>Pts</th></tr></thead>
                  <tbody>
                    {tabla.map((row, i) => (
                      <tr key={row.user_id} className={row.user_id === user.id ? 'highlight-top' : ''}>
                        <td className="pos">{i + 1}</td>
                        <td style={{fontWeight: row.user_id === user.id ? 700 : 400}}>
                          {row.nombre.toUpperCase()}
                        </td>
                        <td>{row.pj}</td>
                        <td className="pts">{row.puntos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="card">
              <div className="card-header">Tabla {MESES[mesActual - 1]}</div>
              {mensualConDatos.length === 0 ? (
                <p className="text-muted" style={{textAlign:'center', padding:'16px 0', fontSize:13}}>Sin fechas disputadas este mes</p>
              ) : (
                <table className="liga-table">
                  <thead><tr><th>#</th><th style={{textAlign:'left'}}>Jugador</th><th>PJ</th><th>Pts</th></tr></thead>
                  <tbody>
                    {mensualConDatos
                      .sort((a, b) => b.puntos - a.puntos || b.victorias - a.victorias)
                      .map((row, i) => (
                        <tr key={row.user_id} className={row.user_id === user.id ? 'highlight-top' : ''}>
                          <td className="pos">{i + 1}</td>
                          <td style={{fontWeight: row.user_id === user.id ? 700 : 400}}>{row.nombre.toUpperCase()}</td>
                          <td>{row.pj}</td>
                          <td className="pts">{row.puntos}</td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
