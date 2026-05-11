import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api/index.js'

export default function AdminGDTVentana() {
  const [searchParams, setSearchParams] = useSearchParams()
  const ligaId = searchParams.get('liga_id') || undefined
  const [ventanas, setVentanas]     = useState([])
  const [ligas, setLigas]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [exito, setExito]           = useState(null)
  const [detalle, setDetalle]       = useState(null)  // { ventanaId, cambios }
  const [formNueva, setFormNueva]   = useState({ nombre: '', cambios: 2 })
  const [abriendo, setAbriendo]     = useState(false)
  // Slots de la liga actual: usado para que `max` de "cambios por usuario" sea dinámico
  // (no tiene sentido permitir 11 cambios en una liga F5 con 5 slots).
  const [slotsLiga, setSlotsLiga]   = useState({ total: 11 })

  useEffect(() => {
    api.gdtGetLigas().then(ls => setLigas(Array.isArray(ls) ? ls : [])).catch(() => {})
  }, [])

  useEffect(() => { cargar() }, [ligaId])

  // Cargar config de slots de la liga seleccionada para limitar "cambios por usuario"
  useEffect(() => {
    if (!ligaId) { setSlotsLiga({ total: 11 }); return }
    api.gdtGetLigaSlots(ligaId)
      .then(data => setSlotsLiga({ total: data?.total || 11 }))
      .catch(() => setSlotsLiga({ total: 11 }))
  }, [ligaId])

  async function cargar() {
    setLoading(true); setError(null)
    try { setVentanas(await api.gdtGetVentanas(ligaId)) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function abrir() {
    if (!formNueva.nombre.trim()) { setError('Escribí un nombre para la ventana'); return }
    setAbriendo(true); setError(null)
    try {
      await api.gdtAbrirVentana(formNueva.nombre.trim(), Number(formNueva.cambios) || 2, ligaId ? Number(ligaId) : null)
      setExito(`✅ Ventana "${formNueva.nombre}" abierta`)
      setFormNueva({ nombre: '', cambios: 2 })
      cargar()
    } catch (e) { setError(e.message) }
    finally { setAbriendo(false) }
  }

  async function cerrar(id, nombre) {
    if (!confirm(`¿Cerrar la ventana "${nombre}"? Los usuarios ya no podrán hacer cambios.`)) return
    try {
      await api.gdtCerrarVentana(id)
      setExito(`Ventana "${nombre}" cerrada`)
      cargar()
    } catch (e) { setError(e.message) }
  }

  async function verDetalle(id) {
    try {
      const cambios = await api.gdtGetDetalleVentana(id)
      setDetalle({ ventanaId: id, cambios })
    } catch (e) { setError(e.message) }
  }

  const ventanaAbierta = ventanas.find(v => v.estado === 'abierta')

  if (loading) return <div className="main-content"><p style={{ color: 'var(--color-muted)' }}>Cargando...</p></div>

  return (
    <div className="main-content">
      <h2 style={{ marginBottom: 20 }}>🔄 Ventanas de Cambios GDT</h2>

      {/* Selector de liga — visible si hay más de una */}
      {ligas.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap', background: 'var(--color-surface2)', padding: '10px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 4 }}>Liga</span>
          {ligas.map(l => {
            const sel = ligaId === String(l.id)
            return (
              <button
                key={l.id}
                onClick={() => setSearchParams(prev => { prev.set('liga_id', String(l.id)); return prev })}
                style={{ padding: '5px 14px', borderRadius: 99, border: `2px solid ${sel ? 'var(--color-primary)' : 'transparent'}`, background: sel ? 'rgba(59,130,246,0.15)' : 'transparent', color: sel ? 'var(--color-primary)' : 'var(--color-muted)', fontWeight: sel ? 700 : 500, fontSize: 13, cursor: 'pointer' }}
              >
                {l.nombre}{l.es_default ? ' ★' : ''}{l.formato ? ` (${l.formato})` : ''}
              </button>
            )
          })}
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14, color: 'var(--color-danger)' }}>
          {error} <button onClick={() => setError(null)} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
        </div>
      )}
      {exito && (
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid var(--color-success)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14, color: 'var(--color-success)' }}>
          {exito} <button onClick={() => setExito(null)} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
        </div>
      )}

      {/* Ventana activa */}
      {ventanaAbierta ? (
        <div style={{ background: 'rgba(34,197,94,0.08)', border: '2px solid var(--color-success)', borderRadius: 'var(--radius)', padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ color: 'var(--color-success)', margin: '0 0 6px 0' }}>🟢 Ventana abierta: {ventanaAbierta.nombre}</h3>
              <p style={{ color: 'var(--color-muted)', fontSize: 13, margin: 0 }}>
                {ventanaAbierta.cambios_por_usuario} cambios por usuario ·
                {ventanaAbierta.usuarios_activos} usuario(s) ya hicieron cambios ·
                {ventanaAbierta.total_cambios} cambio(s) totales
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => verDetalle(ventanaAbierta.id)}>
                Ver cambios
              </button>
              <button
                className="btn btn-sm"
                style={{ background: 'var(--color-danger)', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => cerrar(ventanaAbierta.id, ventanaAbierta.nombre)}
              >
                🔒 Cerrar ventana
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Formulario nueva ventana */
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 20, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: 15 }}>Abrir nueva ventana de cambios</h3>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={labelStyle}>Nombre de la ventana</label>
              <input
                type="text"
                placeholder="Ej: Cambios Mayo"
                value={formNueva.nombre}
                onChange={e => setFormNueva(f => ({ ...f, nombre: e.target.value }))}
                style={{ ...inputStyle, width: 220 }}
              />
            </div>
            <div>
              <label style={labelStyle}>Cambios por usuario</label>
              <input
                type="number"
                min={1} max={slotsLiga.total || 11}
                value={formNueva.cambios}
                onChange={e => setFormNueva(f => ({ ...f, cambios: e.target.value }))}
                style={{ ...inputStyle, width: 80 }}
              />
            </div>
            <button className="btn btn-primary" onClick={abrir} disabled={abriendo || (ligas.length > 1 && !ligaId)}>
              {abriendo ? 'Abriendo...' : '🟢 Abrir ventana'}
            </button>
          </div>
          {ligas.length > 1 && !ligaId && (
            <p style={{ color: 'var(--color-warning)', fontSize: 12, marginTop: 10, fontWeight: 600 }}>
              ⚠️ Seleccioná una liga arriba antes de abrir la ventana — si no, abriría en la liga default sin que lo notes.
            </p>
          )}
          <p style={{ color: 'var(--color-muted)', fontSize: 12, marginTop: 10 }}>
            Al abrir, los usuarios verán los jugadores disponibles (los que nadie tiene) y podrán hacer hasta N cambios.
            Si 4 o más usuarios eligen el mismo jugador, ese jugador queda eliminado (0 pts en duelos).
          </p>
        </div>
      )}

      {/* Historial */}
      <h3 style={{ marginBottom: 12, fontSize: 15 }}>Historial de ventanas</h3>
      {ventanas.length === 0 ? (
        <p style={{ color: 'var(--color-muted)' }}>No hay ventanas registradas.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
              <th style={thStyle}>Ventana</th>
              <th style={thStyle}>Estado</th>
              <th style={thStyle}>Cambios por usuario</th>
              <th style={thStyle}>Usuarios activos</th>
              <th style={thStyle}>Total cambios</th>
              <th style={thStyle}>Abierta</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ventanas.map(v => (
              <tr key={v.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={tdStyle}><strong>{v.nombre}</strong></td>
                <td style={tdStyle}>
                  <span style={{ color: v.estado === 'abierta' ? 'var(--color-success)' : 'var(--color-muted)', fontWeight: 600, fontSize: 12 }}>
                    {v.estado === 'abierta' ? '🟢 Abierta' : '🔒 Cerrada'}
                  </span>
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{v.cambios_por_usuario}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{v.usuarios_activos}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{v.total_cambios}</td>
                <td style={{ ...tdStyle, color: 'var(--color-muted)', fontSize: 12 }}>
                  {new Date(v.created_at).toLocaleDateString('es-AR')}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => verDetalle(v.id)}>
                      Ver cambios
                    </button>
                    {v.estado === 'abierta' && (
                      <button
                        className="btn btn-sm"
                        style={{ background: 'var(--color-danger)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                        onClick={() => cerrar(v.id, v.nombre)}
                      >
                        Cerrar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal detalle */}
      {detalle && (
        <div style={overlayStyle} onClick={() => setDetalle(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Cambios realizados</h3>
              <button onClick={() => setDetalle(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', fontSize: 18 }}>✕</button>
            </div>
            {detalle.cambios.length === 0 ? (
              <p style={{ color: 'var(--color-muted)' }}>Nadie hizo cambios en esta ventana.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th style={thStyle}>Usuario</th>
                    <th style={thStyle}>Slot</th>
                    <th style={thStyle}>Tipo</th>
                    <th style={thStyle}>Salió</th>
                    <th style={thStyle}>Entró</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.cambios.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={tdStyle}><strong>{c.usuario}</strong></td>
                      <td style={{ ...tdStyle, color: 'var(--color-primary)', fontWeight: 600 }}>{c.slot}</td>
                      <td style={tdStyle}>
                        {c.es_correccion
                          ? <span style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--color-danger)', borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 600 }}>Corrección</span>
                          : <span style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--color-success)', borderRadius: 4, padding: '2px 7px', fontSize: 11 }}>Libre</span>
                        }
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--color-danger)', fontSize: 12 }}>
                        {c.jugador_anterior ? `${c.jugador_anterior} (${c.equipo_anterior})` : '—'}
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--color-success)', fontSize: 12 }}>
                        {c.jugador_nuevo} ({c.equipo_nuevo})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const thStyle = { textAlign: 'left', padding: '6px 10px', color: 'var(--color-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }
const tdStyle = { padding: '8px 10px' }
const labelStyle = { display: 'block', fontSize: 11, color: 'var(--color-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }
const inputStyle = { background: 'var(--color-surface2)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text)', padding: '7px 10px', fontSize: 13 }
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }
const modalStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 24, width: '100%', maxWidth: 640, maxHeight: '80vh', overflowY: 'auto' }
