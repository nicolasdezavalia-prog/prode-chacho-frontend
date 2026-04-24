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

function formatARS(importe) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(importe)
}

// ─── Componente reutilizable de detalle de cruce ─────────────────────────────
function CruceDetalle({ cruce, fecha, gdtResultado }) {
  // Un único state para apertura de secciones — abrir una cierra las otras.
  const [seccionAbierta, setSeccionAbierta] = useState(null) // 'A' | 'B' | 'GDT' | null
  const [eventosData, setEventosData] = useState(null)
  const [eventosCargando, setEventosCargando] = useState(false)

  const puedeVerRival = fecha.estado === 'cerrada' || fecha.estado === 'finalizada'

  const toggleSeccion = async (sec) => {
    if (seccionAbierta === sec) { setSeccionAbierta(null); return }
    setSeccionAbierta(sec)
    // Lazy-load de eventos la primera vez que se abre A o B
    if ((sec === 'A' || sec === 'B') && !eventosData && !eventosCargando) {
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
            borderRadius: 6, border: `1px solid ${seccionAbierta === b.key ? 'var(--color-primary)' : 'var(--color-border)'}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            cursor: 'pointer'
          }}
            onClick={() => toggleSeccion(b.key)}
          >
            <span style={{color: 'var(--color-muted)'}}>{b.emoji} {b.nombre}</span>
            <span style={{fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4}}>
              {b.yoPts} – {b.rivalPts}
              {' '}{b.ganador === 'empate' ? '🤝' : b.yoGana ? '✅' : '❌'}
              <span style={{fontSize: 10, color: 'var(--color-muted)'}}>{seccionAbierta === b.key ? '▲' : '▼'}</span>
            </span>
          </div>
        ))}
        {/* GDT */}
        <div style={{
          flex: 1, padding: '5px 8px', background: 'var(--color-surface)',
          borderRadius: 6, border: `1px solid ${seccionAbierta === 'GDT' ? 'var(--color-primary)' : 'var(--color-border)'}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: gdtResultado ? 'pointer' : 'default'
        }}
          onClick={() => gdtResultado && toggleSeccion('GDT')}
        >
          <span style={{color: 'var(--color-muted)'}}>🟪 GDT</span>
          <span style={{fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4}}>
            {cruce.yo_gdt_duelos != null
              ? <>{cruce.yo_gdt_duelos} – {cruce.rival_gdt_duelos} {cruce.ganador_gdt === 'empate' ? '🤝' : cruce.yo_ganador_gdt ? '✅' : '❌'}</>
              : <span style={{color: 'var(--color-muted)', fontSize: 11}}>Pend.</span>
            }
            {gdtResultado && <span style={{fontSize: 10, color: 'var(--color-muted)', marginLeft: 2}}>{seccionAbierta === 'GDT' ? '▲' : '▼'}</span>}
          </span>
        </div>
      </div>

      {/* Detalle Bloque A o B */}
      {(seccionAbierta === 'A' || seccionAbierta === 'B') && (
        <div style={{marginTop: 8, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden'}}>
          {eventosCargando ? (
            <div style={{padding: '12px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 12}}>Cargando...</div>
          ) : eventosData ? (() => {
            const inicio = seccionAbierta === 'A' ? 1 : 16
            const fin    = seccionAbierta === 'A' ? 15 : 30
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
      {gdtResultado && seccionAbierta === 'GDT' && (
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
                const miPts       = yo ? d.pts_u1 : d.pts_u2
                const rvPts       = yo ? d.pts_u2 : d.pts_u1
                const miElim      = yo ? d.eliminado_u1 : d.eliminado_u2
                const rvElim      = yo ? d.eliminado_u2 : d.eliminado_u1
                const miJugo      = yo ? d.jugo_u1 : d.jugo_u2
                const rvJugo      = yo ? d.jugo_u2 : d.jugo_u1
                const miHayPuntaje = yo ? d.hayPuntaje_u1 : d.hayPuntaje_u2
                const rvHayPuntaje = yo ? d.hayPuntaje_u2 : d.hayPuntaje_u1
                const miGana = (yo && d.ganador === 'a') || (!yo && d.ganador === 'b')
                const rvGana = (yo && d.ganador === 'b') || (!yo && d.ganador === 'a')
                const td = {padding: '5px 7px', fontSize: 12}
                return (
                  <tr key={d.slot} style={{borderBottom: '1px solid var(--color-border)'}}>
                    <td style={{...td, color: 'var(--color-primary)', fontWeight: 700}}>{d.slot}</td>
                    <td style={{...td, color: miElim ? 'var(--color-danger)' : 'inherit'}}>
                      {miJug || '—'}{miEq && <span style={{color:'var(--color-muted)',fontSize:10}}> ({miEq})</span>}{miElim ? ' ❌' : ''}
                    </td>
                    <td style={{...td, textAlign:'center', fontWeight:700, color: miGana ? 'var(--color-success)' : 'inherit'}}>
                      {!miHayPuntaje ? <span style={{color:'var(--color-muted)', fontWeight:400}}>—</span>
                        : miHayPuntaje && !miJugo && !miElim
                          ? <span>{miPts} <span style={{fontSize:9, color:'var(--color-muted)', fontWeight:400}}>NJ</span></span>
                          : miPts}
                    </td>
                    <td style={{...td, textAlign:'center', color:'var(--color-muted)'}}>vs</td>
                    <td style={{...td, textAlign:'center', fontWeight:700, color: rvGana ? 'var(--color-danger)' : 'inherit'}}>
                      {!rvHayPuntaje ? <span style={{color:'var(--color-muted)', fontWeight:400}}>—</span>
                        : rvHayPuntaje && !rvJugo && !rvElim
                          ? <span>{rvPts} <span style={{fontSize:9, color:'var(--color-muted)', fontWeight:400}}>NJ</span></span>
                          : rvPts}
                    </td>
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

// ─── Fila de deuda individual con confirmar pago ─────────────────────────────
function DeudaRow({ mov, onPaid }) {
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)

  const aQuien = mov.acreedor_nombre ? mov.acreedor_nombre.toUpperCase() : 'POZO'

  const handlePagar = async () => {
    setSaving(true)
    try {
      await api.togglePagadoMovimiento(mov.id)
      onPaid()
    } catch (e) {
      alert(e.message)
      setSaving(false)
      setConfirming(false)
    }
  }

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 0', borderBottom: '1px solid var(--color-border)', gap: 8
    }}>
      <div style={{flex: 1, minWidth: 0}}>
        <div style={{fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
          {mov.concepto}
        </div>
        <div style={{fontSize: 11, color: 'var(--color-muted)'}}>
          → <strong>{aQuien}</strong> · <span style={{color: '#dc2626', fontWeight: 700}}>{formatARS(mov.importe)}</span>
        </div>
      </div>
      {!confirming ? (
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setConfirming(true)}
          style={{fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0}}
        >
          ✓ Marcar como pagado
        </button>
      ) : (
        <div style={{display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0}}>
          <span style={{fontSize: 10, color: 'var(--color-muted)'}}>¿Seguro?</span>
          <button
            className="btn btn-success btn-sm"
            onClick={handlePagar}
            disabled={saving}
            style={{fontSize: 11}}
          >
            {saving ? '...' : 'Sí'}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setConfirming(false)}
            style={{fontSize: 11}}
          >
            No
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Tarjeta de deudas por fecha ─────────────────────────────────────────────
function DeudaFechaCard({ fecha, items, onPaid }) {
  const total = items.reduce((s, m) => s + m.importe, 0)
  return (
    <div style={{
      border: '1px solid #fecaca',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      marginBottom: 10,
    }}>
      {/* Header */}
      <div style={{
        background: '#fef2f2',
        borderBottom: '1px solid #fecaca',
        padding: '8px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <span style={{fontWeight: 700, fontSize: 14}}>💸 {fecha.nombre}</span>
          <span style={{fontSize: 12, color: 'var(--color-muted)', marginLeft: 8}}>
            {MESES[(fecha.mes || 1) - 1]} {fecha.anio}
          </span>
        </div>
        <span style={{fontWeight: 800, color: '#dc2626', fontSize: 15}}>
          {formatARS(total)}
        </span>
      </div>
      {/* Filas de deuda */}
      <div style={{padding: '4px 14px 8px'}}>
        {items.map(m => <DeudaRow key={m.id} mov={m} onPaid={onPaid} />)}
      </div>
    </div>
  )
}

// ─── Item colapsable de fecha en la lista ────────────────────────────────────
function FechaItem({ fecha, cruce, user, destacado = false }) {
  const esAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const [abierto, setAbierto] = useState(fecha.estado === 'abierta' || fecha.estado === 'cerrada')
  const [gdtResultado, setGdtResultado] = useState(null)
  const [gdtCargado, setGdtCargado] = useState(false)

  // Helper: carga el GDT de este cruce una sola vez.
  const cargarGdt = async () => {
    if (gdtCargado || !cruce?.id) return
    setGdtCargado(true)
    try {
      const gdt = await api.gdtGetResultado(cruce.id)
      if (gdt?.disponible) setGdtResultado(gdt)
    } catch (_) {}
  }

  // Si el item arranca expandido (abierta/cerrada), cargar GDT al mount.
  // Sin este efecto, el GDT solo se cargaba en handleToggle y el chip quedaba
  // no-clickeable dentro de la lista (bug reportado).
  useEffect(() => {
    if (abierto) cargarGdt()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleToggle = () => {
    const nuevo = !abierto
    setAbierto(nuevo)
    if (nuevo) cargarGdt()
  }

  const gane  = cruce?.yo_ganador_fecha === true
  const perdi = cruce?.yo_ganador_fecha === false && cruce?.ganador_fecha && cruce?.ganador_fecha !== 'empate'
  const empate = cruce?.ganador_fecha === 'empate'

  return (
    <div style={destacado
      ? {
          border: '2px solid var(--color-primary)',
          borderRadius: 'var(--radius)',
          background: 'var(--color-surface)',
          padding: '4px 14px',
          marginBottom: 10,
        }
      : { borderBottom: '1px solid var(--color-border)' }
    }>
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
              {MESES[(fecha.mes || 1) - 1]} {fecha.anio}
              {' · '}{fecha.bloque1_nombre} · {fecha.bloque2_nombre}
              {fecha.importe_apuesta > 0 && (
                <span style={{marginLeft: 6, color: 'var(--color-warning)', fontWeight: 600}}>
                  💰 {formatARS(fecha.importe_apuesta)}
                </span>
              )}
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
          {fecha.estado === 'abierta' && (
            <Link to={`/fecha/${fecha.id}`} className="btn btn-secondary btn-sm" onClick={e => e.stopPropagation()}>Ver</Link>
          )}
          {fecha.estado !== 'borrador' && (
            <Link to={`/fecha/${fecha.id}/enfrentamientos`} className="btn btn-secondary btn-sm" onClick={e => e.stopPropagation()}>⚔️</Link>
          )}
          {esAdmin && fecha.estado === 'abierta' && (
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

// ─── Alerta de deudas pendientes (colapsable, estilo rojo) ───────────────────
function DeudasAlert({ total, fechasConDeuda, economia, onPaid, esAdmin }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <div style={{
      border: '1px solid #fecaca',
      background: '#fef2f2',
      borderRadius: 'var(--radius)',
      padding: '12px 14px',
      marginBottom: 16,
    }}>
      {/* Header tipo alerta */}
      <div
        onClick={() => setAbierto(a => !a)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', userSelect: 'none',
          gap: 12,
        }}
      >
        <div style={{fontWeight: 700, fontSize: 14, color: '#991b1b'}}>
          ⚠️ Tenés deudas pendientes por{' '}
          <span style={{color: '#dc2626', fontWeight: 800}}>{formatARS(total)}</span>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0}}>
          <span style={{
            fontSize: 11, color: '#dc2626', fontWeight: 600,
            textDecoration: 'underline', textUnderlineOffset: 2,
          }}>
            {abierto ? 'Ocultar detalle' : 'Ver detalle por fecha'}
          </span>
          <span style={{color: '#dc2626', fontSize: 12}}>{abierto ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Detalle colapsable */}
      {abierto && (
        <div style={{marginTop: 12}}>
          {fechasConDeuda.slice().reverse().map(f => (
            <DeudaFechaCard
              key={f.id}
              fecha={f}
              items={economia.porFecha[f.id].items}
              onPaid={onPaid}
            />
          ))}
          {esAdmin && (
            <Link
              to="/admin/deudores"
              className="btn btn-secondary btn-sm"
              style={{width: '100%', justifyContent: 'center', marginTop: 4}}
            >
              📊 Ver cuadro de deudores
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sección colapsable de fechas finalizadas ────────────────────────────────
function FechasFinalizadasSection({ fechas, misCruces, user }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <div className="card" style={{marginTop: 16}}>
      <div
        className="card-header"
        style={{cursor: 'pointer', userSelect: 'none'}}
        onClick={() => setAbierto(a => !a)}
      >
        <span>📁 Fechas finalizadas <span style={{color: 'var(--color-muted)', fontWeight: 400, fontSize: 13}}>({fechas.length})</span></span>
        <span style={{color: 'var(--color-muted)', fontSize: 13}}>{abierto ? '▲' : '▼'}</span>
      </div>
      {abierto && (
        <div>
          {fechas.slice().reverse().map(fecha => {
            const c = misCruces[fecha.id]
            return <FechaItem key={fecha.id} fecha={fecha} cruce={c} user={user} />
          })}
        </div>
      )}
    </div>
  )
}

// ─── Home ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const esAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const [torneoActivo, setTorneoActivo] = useState(null)
  const [fechas, setFechas] = useState([])
  const [tabla, setTabla] = useState([])
  const [tablaMensual, setTablaMensual] = useState([])
  const [misCruces, setMisCruces] = useState({})
  const [economia, setEconomia] = useState(null)
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

      try {
        const eco = await api.getResumenEconomico()
        setEconomia(eco)
      } catch (_) {}

      // Ya no precargamos cruce + GDT de la "última" fecha: cada FechaItem
      // de la lista maneja su propio cruce (misCruces) y carga su GDT al abrirse.
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading">Cargando...</div>

  const fechasVisibles = fechas.filter(f => f.estado !== 'borrador' || esAdmin)
  const fechasEnCurso    = fechasVisibles.filter(f => f.estado !== 'finalizada')
  const fechasFinalizadas = fechasVisibles.filter(f => f.estado === 'finalizada')
  // La fecha abierta (si existe) se destaca visualmente dentro de la lista.
  const fechaAbiertaId = fechasEnCurso.find(f => f.estado === 'abierta')?.id || null
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
        {esAdmin && (
          <Link to="/admin/fecha/nueva" className="btn btn-primary">+ Nueva Fecha</Link>
        )}
      </div>

      {error && <div className="error-msg">{error}</div>}

      {!torneoActivo ? (
        <div className="card" style={{textAlign: 'center', padding: 40}}>
          <p className="text-muted" style={{marginBottom: 12}}>No hay torneos activos</p>
          {esAdmin && (
            <button className="btn btn-primary" onClick={() => navigate('/admin/torneo/nuevo')}>Crear torneo</button>
          )}
        </div>
      ) : (
        <div style={{display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start'}}>

          {/* ── Columna principal ── */}
          <div>

            {/* Alerta de deudas pendientes (colapsable) */}
            {economia?.totalPendiente > 0 && (() => {
              const fechasConDeuda = fechasVisibles.filter(f =>
                economia.porFecha?.[f.id]?.items?.length > 0
              )
              if (fechasConDeuda.length === 0) return null
              return (
                <DeudasAlert
                  total={economia.totalPendiente}
                  fechasConDeuda={fechasConDeuda}
                  economia={economia}
                  onPaid={loadData}
                  esAdmin={esAdmin}
                />
              )
            })()}

            {/* Lista de fechas en curso (borrador / abierta / cerrada) */}
            <div className="card">
              <div className="card-header">
                Fechas en curso
                {esAdmin && <Link to="/admin/fecha/nueva" className="btn btn-secondary btn-sm">+ Nueva</Link>}
              </div>
              {fechasEnCurso.length === 0 ? (
                <p className="text-muted" style={{textAlign: 'center', padding: '24px 0'}}>No hay fechas en curso</p>
              ) : (
                <div>
                  {fechasEnCurso.slice().reverse().map(fecha => {
                    const c = misCruces[fecha.id]
                    return (
                      <FechaItem
                        key={fecha.id}
                        fecha={fecha}
                        cruce={c}
                        user={user}
                        destacado={fecha.id === fechaAbiertaId}
                      />
                    )
                  })}
                </div>
              )}
            </div>

            {/* Fechas finalizadas (colapsable, cerrado por defecto) */}
            {fechasFinalizadas.length > 0 && (
              <FechasFinalizadasSection
                fechas={fechasFinalizadas}
                misCruces={misCruces}
                user={user}
              />
            )}
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

            {esAdmin && (
              <div className="card" style={{marginBottom: 16}}>
                <Link to="/admin/deudores" className="btn btn-secondary btn-sm" style={{width: '100%', justifyContent: 'center'}}>
                  📊 Cuadro de deudores
                </Link>
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
