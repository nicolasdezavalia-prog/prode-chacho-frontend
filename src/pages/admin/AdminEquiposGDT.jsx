import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api/index.js'

const SLOTS = ['ARQ', 'DEF1', 'DEF2', 'DEF3', 'DEF4', 'MED1', 'MED2', 'MED3', 'MED4', 'DEL1', 'DEL2']

const ESTADO_CONFIG = {
  valido:              { label: '✅ Válido',              color: 'var(--color-success)',  bg: 'rgba(34,197,94,0.08)' },
  observado:           { label: '⚠️ Observado',           color: 'var(--color-warning)',  bg: 'rgba(245,158,11,0.08)' },
  requiere_correccion: { label: '❌ Requiere corrección',  color: 'var(--color-danger)',   bg: 'rgba(239,68,68,0.08)' },
  sin_equipo:          { label: '🔘 Sin equipo',          color: 'var(--color-muted)',    bg: 'transparent' },
}

function EstadoBadge({ estado }) {
  const cfg = ESTADO_CONFIG[estado] || ESTADO_CONFIG.sin_equipo
  return <span style={{ color: cfg.color, fontWeight: 600, fontSize: 12 }}>{cfg.label}</span>
}

export default function AdminEquiposGDT() {
  const [searchParams] = useSearchParams()
  const ligaId = searchParams.get('liga_id') || undefined
  const [slotsConfig, setSlotsConfig] = useState({ slotNames: SLOTS, total: 11 })
  const [data, setData]           = useState(null)
  const [todosJugadores, setTodosJugadores] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [modalInvalidar, setModalInvalidar] = useState(null)
  const [motivoInput, setMotivoInput]       = useState('')
  const [accionando, setAccionando]         = useState(false)

  useEffect(() => { cargar() }, [ligaId])

  useEffect(() => {
    api.gdtGetLigaSlots(ligaId)
      .then(data => {
        if (data?.slots?.length > 0)
          setSlotsConfig({ slotNames: data.slots.map(s => s.slot), total: data.total })
      })
      .catch(() => {}) // fallback: mantiene SLOTS F11
  }, [ligaId])

  async function cargar() {
    setLoading(true); setError(null)
    try {
      const [equiposData, jugadores] = await Promise.all([
        api.gdtGetEquipos(ligaId),
        api.gdtGetTodosJugadores(ligaId),
      ])
      setData(equiposData)
      setTodosJugadores(jugadores)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleValidar(userId) {
    setAccionando(true)
    try { await api.gdtValidarEquipo(userId); await cargar() }
    catch (e) { setError(e.message) }
    finally { setAccionando(false) }
  }

  async function handleInvalidar() {
    if (!modalInvalidar) return
    setAccionando(true)
    try {
      await api.gdtInvalidarEquipo(modalInvalidar.user_id, motivoInput.trim() || null)
      setModalInvalidar(null); setMotivoInput('')
      await cargar()
    } catch (e) { setError(e.message) }
    finally { setAccionando(false) }
  }

  if (loading) return <div className="main-content"><p style={{ color: 'var(--color-muted)' }}>Cargando...</p></div>

  const equipos      = data?.equipos || []
  const estadoGlobal = data?.estado_global || []
  const bloqueados   = estadoGlobal.filter(j => j.estado === 'bloqueado')
  const eliminados   = estadoGlobal.filter(j => j.estado === 'eliminado')
  const observados   = equipos.filter(e => e.estado === 'observado' || e.estado === 'requiere_correccion')
  const validos      = equipos.filter(e => e.estado === 'valido')
  const sinEquipo    = equipos.filter(e => e.jugadores.length < slotsConfig.total && e.estado !== 'observado' && e.estado !== 'requiere_correccion')

  return (
    <div className="main-content">
      <h2 style={{ marginBottom: 20 }}>🏆 Equipos Gran DT — Vista Admin</h2>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14, color: 'var(--color-danger)' }}>
          {error}
        </div>
      )}

      {/* Solo Eliminados (4+) — los bloqueados no son un concepto de scoring, son de ventana de cambios */}
      {eliminados.length > 0 && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 24 }}>
          <h3 style={{ color: 'var(--color-danger)', fontSize: 13, marginBottom: 6 }}>❌ Eliminados ({eliminados.length})</h3>
          <p style={{ color: 'var(--color-muted)', fontSize: 11, marginBottom: 8 }}>4+ usuarios tienen el mismo jugador → cuenta 0 pts / no jugó en duelos.</p>
          {eliminados.map(j => (
            <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, borderBottom: '1px solid var(--color-border)' }}>
              <span>{j.nombre} <span style={{ color: 'var(--color-muted)' }}>({j.equipo_real})</span></span>
              <span style={{ color: 'var(--color-danger)' }}>{j.count} usuarios</span>
            </div>
          ))}
        </div>
      )}

      {observados.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ color: 'var(--color-warning)', marginBottom: 12 }}>⚠️ Excluidos del GDT ({observados.length})</h3>
          {observados.map(eq => <EquipoCard key={eq.user_id} equipo={eq} slotsConfig={slotsConfig} todosJugadores={todosJugadores} onValidar={handleValidar} onInvalidar={setModalInvalidar} onRecargar={cargar} accionando={accionando} />)}
        </div>
      )}

      {validos.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ color: 'var(--color-success)', marginBottom: 12 }}>✅ Equipos válidos ({validos.length})</h3>
          {validos.map(eq => <EquipoCard key={eq.user_id} equipo={eq} slotsConfig={slotsConfig} todosJugadores={todosJugadores} onValidar={handleValidar} onInvalidar={setModalInvalidar} onRecargar={cargar} accionando={accionando} />)}
        </div>
      )}

      {sinEquipo.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ color: 'var(--color-muted)', marginBottom: 8, fontSize: 13 }}>🔘 Sin equipo ({sinEquipo.length})</h3>
          {sinEquipo.map(eq => <EquipoCard key={eq.user_id} equipo={eq} slotsConfig={slotsConfig} todosJugadores={todosJugadores} onValidar={handleValidar} onInvalidar={setModalInvalidar} onRecargar={cargar} accionando={accionando} />)}
        </div>
      )}

      {/* Modal invalidar */}
      {modalInvalidar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius)', padding: 24, width: 420, border: '1px solid var(--color-border)' }}>
            <h3 style={{ marginBottom: 12 }}>Invalidar equipo de {modalInvalidar.usuario}</h3>
            <p style={{ color: 'var(--color-muted)', fontSize: 13, marginBottom: 12 }}>
              El equipo quedará en <strong>Requiere corrección</strong> y no participará en GDT.
            </p>
            <textarea
              value={motivoInput}
              onChange={e => setMotivoInput(e.target.value)}
              placeholder="Motivo (opcional, lo ve el usuario)..."
              rows={3}
              style={{ width: '100%', background: 'var(--color-surface2)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text)', padding: '8px 10px', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => { setModalInvalidar(null); setMotivoInput('') }}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleInvalidar} disabled={accionando}
                style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>
                {accionando ? 'Invalidando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── EquipoCard ───────────────────────────────────────────────────────────────

function EquipoCard({ equipo, slotsConfig, todosJugadores, onValidar, onInvalidar, onRecargar, accionando }) {
  const [abierto, setAbierto]   = useState(equipo.estado !== 'valido')
  const [editSlot, setEditSlot] = useState(null)   // slot en edición
  const [busqueda, setBusqueda] = useState('')
  const [guardando, setGuardando] = useState(false)
  const cfg = ESTADO_CONFIG[equipo.estado] || ESTADO_CONFIG.sin_equipo

  // Búsqueda local sobre todos los jugadores
  const candidatos = busqueda.trim().length >= 2
    ? todosJugadores.filter(j =>
        j.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (j.equipo_real || '').toLowerCase().includes(busqueda.toLowerCase())
      ).slice(0, 8)
    : []

  async function asignarJugador(jugadorId) {
    setGuardando(true)
    try {
      await api.gdtEditarSlot(equipo.user_id, editSlot, { jugador_id: jugadorId })
      setEditSlot(null); setBusqueda('')
      await onRecargar()
    } catch (e) { alert(e.message) }
    finally { setGuardando(false) }
  }

  async function crearYAsignar() {
    if (!busqueda.trim()) return
    const partes = busqueda.trim().split('/')
    const nombre = partes[0].trim()
    const equipoReal = partes[1]?.trim() || ''
    if (!equipoReal) { alert('Para crear nuevo: escribí "Nombre / Equipo"'); return }
    setGuardando(true)
    try {
      await api.gdtEditarSlot(equipo.user_id, editSlot, { nombre, equipo_real: equipoReal })
      setEditSlot(null); setBusqueda('')
      await onRecargar()
    } catch (e) { alert(e.message) }
    finally { setGuardando(false) }
  }

  return (
    <div style={{ background: 'var(--color-surface)', border: `1px solid ${equipo.estado !== 'valido' ? 'var(--color-warning)' : 'var(--color-border)'}`, borderRadius: 'var(--radius)', marginBottom: 10, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: cfg.bg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setAbierto(!abierto)} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: 12 }}>
            {abierto ? '▲' : '▼'}
          </button>
          <strong>{equipo.usuario}</strong>
          <EstadoBadge estado={equipo.estado} />
          <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>{equipo.jugadores.length}/{slotsConfig.total} slots</span>
          {(equipo.pendientes_count > 0) && <span style={{ color: '#a78bfa', fontSize: 12 }}>⏳ {equipo.pendientes_count} pendientes</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {equipo.estado !== 'valido' && (
            <button className="btn btn-sm" onClick={() => onValidar(equipo.user_id)} disabled={accionando}
              style={{ fontSize: 12, padding: '4px 10px', background: 'var(--color-success)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
              Marcar válido
            </button>
          )}
          {equipo.estado !== 'requiere_correccion' && equipo.jugadores.length === slotsConfig.total && (
            <button className="btn btn-sm" onClick={() => onInvalidar({ user_id: equipo.user_id, usuario: equipo.usuario })} disabled={accionando}
              style={{ fontSize: 12, padding: '4px 10px', background: 'var(--color-danger)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
              Invalidar
            </button>
          )}
        </div>
      </div>

      {/* Observaciones */}
      {equipo.motivo_admin && (
        <div style={{ padding: '6px 14px', background: 'rgba(239,68,68,0.06)', fontSize: 12, color: 'var(--color-danger)', borderBottom: '1px solid var(--color-border)' }}>
          Motivo admin: {equipo.motivo_admin}
        </div>
      )}
      {equipo.observaciones?.length > 0 && (
        <div style={{ padding: '6px 14px', background: 'rgba(245,158,11,0.06)', fontSize: 12, color: 'var(--color-warning)', borderBottom: '1px solid var(--color-border)' }}>
          {equipo.observaciones.map((o, i) => (
            <span key={i} style={{ marginRight: 12 }}>
              {o.slot}: {o.jugador} es {o.posicion_jugador} (esperaba {o.posicion_esperada})
            </span>
          ))}
        </div>
      )}

      {/* Tabla de slots */}
      {abierto && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <th style={thStyle}>Slot</th>
              <th style={thStyle}>Jugador</th>
              <th style={thStyle}>Equipo real</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Pos.</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Estado</th>
              <th style={{ ...thStyle, width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {slotsConfig.slotNames.map(slot => {
              const j   = equipo.jugadores.find(jj => jj.slot === slot)
              const obs = equipo.observaciones?.find(o => o.slot === slot)
              const enEdicion = editSlot === slot

              return (
                <>
                  <tr key={slot} style={{ borderBottom: enEdicion ? 'none' : '1px solid var(--color-border)', background: obs ? 'rgba(245,158,11,0.04)' : j?.estado_jugador === 'eliminado' ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                    <td style={{ ...tdStyle, color: 'var(--color-primary)', fontWeight: 600 }}>{slot}</td>
                    <td style={{ ...tdStyle, color: j?.estado_jugador === 'pendiente' ? '#a78bfa' : j?.estado_jugador === 'rechazado' ? 'var(--color-danger)' : 'var(--color-text)' }}>
                      {j?.nombre || <span style={{ color: 'var(--color-muted)' }}>—</span>}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--color-muted)', fontSize: 12 }}>{j?.equipo_real || '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontSize: 12 }}>
                      {j?.posicion || '—'}
                      {obs && <span style={{ color: 'var(--color-warning)', marginLeft: 4 }}>⚠️</span>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontSize: 12 }}>
                      {j?.estado_jugador === 'eliminado' && <span style={{ color: 'var(--color-danger)' }}>❌</span>}
                      {j?.estado_jugador === 'bloqueado' && <span style={{ color: 'var(--color-warning)' }}>⚠️</span>}
                      {j?.estado_jugador === 'pendiente' && <span style={{ color: '#a78bfa' }}>⏳</span>}
                      {j?.estado_jugador === 'ok' && <span style={{ color: 'var(--color-success)' }}>✅</span>}
                      {!j && '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <button
                        onClick={() => { setEditSlot(enEdicion ? null : slot); setBusqueda('') }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: enEdicion ? 'var(--color-danger)' : 'var(--color-muted)', fontSize: 14, padding: 2 }}
                        title={enEdicion ? 'Cancelar' : 'Editar slot'}
                      >
                        {enEdicion ? '✕' : '✏️'}
                      </button>
                    </td>
                  </tr>

                  {/* Fila de edición inline */}
                  {enEdicion && (
                    <tr key={`${slot}-edit`} style={{ borderBottom: '1px solid var(--color-border)', background: 'rgba(59,130,246,0.06)' }}>
                      <td colSpan={6} style={{ padding: '8px 10px' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                            <input
                              autoFocus
                              type="text"
                              value={busqueda}
                              onChange={e => setBusqueda(e.target.value)}
                              placeholder='Buscar jugador... o "Nombre / Equipo" para crear'
                              style={{ ...inputStyle, width: '100%' }}
                              disabled={guardando}
                            />
                            {candidatos.length > 0 && (
                              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', maxHeight: 200, overflowY: 'auto' }}>
                                {candidatos.map(c => (
                                  <div
                                    key={c.id}
                                    onClick={() => asignarJugador(c.id)}
                                    style={{ padding: '7px 10px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--color-border)' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface2)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                  >
                                    <strong>{c.nombre}</strong>
                                    <span style={{ color: 'var(--color-muted)', marginLeft: 8, fontSize: 12 }}>
                                      ({c.equipo_real}) {c.posicion}
                                    </span>
                                    <span style={{ marginLeft: 8, fontSize: 11, color: c.estado === 'aprobado' ? 'var(--color-success)' : '#a78bfa' }}>
                                      {c.estado}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={crearYAsignar}
                            disabled={guardando || !busqueda.trim()}
                            title='Usá "Nombre / Equipo" para crear jugador nuevo'
                          >
                            {guardando ? '...' : '➕ Crear y asignar'}
                          </button>
                          <span style={{ color: 'var(--color-muted)', fontSize: 11 }}>
                            Buscá existente o escribí "Nombre / Equipo" para crear nuevo
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

const thStyle = { textAlign: 'left', padding: '6px 10px', color: 'var(--color-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }
const tdStyle = { padding: '6px 10px', fontSize: 13 }
const inputStyle = { background: 'var(--color-surface2)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text)', padding: '5px 8px', fontSize: 13 }
