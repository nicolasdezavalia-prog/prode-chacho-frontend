import { useState, useEffect } from 'react'
import { api } from '../../api/index.js'

const POSICION_LABELS = { ARQ: 'Arquero', DEF: 'Defensor', MED: 'Mediocampista', DEL: 'Delantero' }

export default function AdminGDTPendientes() {
  const [pendientes, setPendientes] = useState([])
  const [catalogo, setCatalogo] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(null)

  // Modal aprobar/editar
  const [modalAprobar, setModalAprobar] = useState(null) // { jugador }
  const [formAprobar, setFormAprobar] = useState({ nombre_canonico: '', equipo_catalogo_id: '', posicion: '' })

  // Modal unificar
  const [modalUnificar, setModalUnificar] = useState(null) // { jugador }
  const [busquedaUnificar, setBusquedaUnificar] = useState('')
  const [candidatosUnificar, setCandidatosUnificar] = useState([])

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true); setError(null)
    try {
      const [pendRes, catRes] = await Promise.all([
        api.gdtGetPendientes(),
        api.gdtGetCatalogo(),
      ])
      setPendientes(pendRes.pendientes || [])
      setCatalogo(catRes || [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function aprobarDirecto(id) {
    try {
      await api.gdtAprobarPendiente(id, {})
      setExito('✅ Jugador aprobado')
      cargar()
    } catch (e) { setError(e.message) }
  }

  async function rechazar(id) {
    if (!confirm('¿Rechazar este jugador? El slot quedará vacío para ese usuario hasta que lo corrija.')) return
    try {
      await api.gdtRechazarPendiente(id)
      setExito('🚫 Jugador rechazado')
      cargar()
    } catch (e) { setError(e.message) }
  }

  function abrirModalAprobar(jugador) {
    setModalAprobar(jugador)
    setFormAprobar({
      nombre_canonico: jugador.nombre_canonico || jugador.nombre || '',
      equipo_catalogo_id: jugador.equipo_catalogo_id ? String(jugador.equipo_catalogo_id) : '',
      posicion: jugador.posicion || '',
    })
  }

  async function confirmarAprobarEditar() {
    if (!modalAprobar) return
    try {
      const data = {}
      if (formAprobar.nombre_canonico?.trim()) data.nombre_canonico = formAprobar.nombre_canonico.trim()
      if (formAprobar.equipo_catalogo_id) data.equipo_catalogo_id = Number(formAprobar.equipo_catalogo_id)
      if (formAprobar.posicion) data.posicion = formAprobar.posicion

      await api.gdtAprobarPendiente(modalAprobar.id, data)
      setExito('✅ Jugador aprobado con edición')
      setModalAprobar(null)
      cargar()
    } catch (e) { setError(e.message) }
  }

  function abrirModalUnificar(jugador) {
    setModalUnificar(jugador)
    setBusquedaUnificar('')
    setCandidatosUnificar([])
  }

  async function buscarParaUnificar(texto) {
    setBusquedaUnificar(texto)
    if (texto.trim().length < 2) { setCandidatosUnificar([]); return }
    try {
      const res = await api.gdtBuscarJugador(texto, null)
      // Combinar exacto y similares, excluir el propio jugador y pendientes
      const todos = [
        ...(res.exacto ? [res.exacto] : []),
        ...(res.similares || [])
      ].filter(j => j.id !== modalUnificar?.id && j.estado !== 'pendiente' && j.estado !== 'rechazado')
      setCandidatosUnificar(todos)
    } catch (_) { setCandidatosUnificar([]) }
  }

  async function confirmarUnificar(keepId) {
    if (!modalUnificar) return
    if (!confirm(`¿Unificar "${modalUnificar.nombre}" con el jugador seleccionado? Esta acción no se puede deshacer.`)) return
    try {
      await api.gdtUnificarPendiente(modalUnificar.id, keepId)
      setExito('🔗 Jugadores unificados')
      setModalUnificar(null)
      cargar()
    } catch (e) { setError(e.message) }
  }

  if (loading) return <div className="main-content"><p style={{ color: 'var(--color-muted)' }}>Cargando...</p></div>

  return (
    <div className="main-content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>⏳ Jugadores Pendientes de Revisión</h2>
        <button className="btn btn-secondary btn-sm" onClick={cargar}>↻ Actualizar</button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14, color: 'var(--color-danger)' }}>
          {error}
        </div>
      )}
      {exito && (
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid var(--color-success)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14, color: 'var(--color-success)' }}>
          {exito}
          <button onClick={() => setExito(null)} style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', fontSize: 12 }}>✕</button>
        </div>
      )}

      {pendientes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-muted)' }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>✅</p>
          <p>No hay jugadores pendientes de revisión.</p>
        </div>
      ) : (
        <>
          <p style={{ color: 'var(--color-muted)', fontSize: 13, marginBottom: 16 }}>
            {pendientes.length} jugador{pendientes.length > 1 ? 'es' : ''} pendiente{pendientes.length > 1 ? 's' : ''}. Revisá cada uno y aprobá, editá, rechazá o unificá con uno existente.
          </p>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                <th style={thStyle}>Nombre recibido</th>
                <th style={thStyle}>Equipo recibido</th>
                <th style={thStyle}>Posición</th>
                <th style={thStyle}>Usuarios que lo tienen</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pendientes.map(j => (
                <tr key={j.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 500 }}>{j.nombre}</div>
                    {j.nombre_raw && j.nombre_raw !== j.nombre && (
                      <div style={{ color: 'var(--color-muted)', fontSize: 11, marginTop: 2 }}>
                        Original: "{j.nombre_raw}"
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <div>{j.equipo_real || j.equipo_raw || '—'}</div>
                    {j.equipo_catalogo_nombre && (
                      <div style={{ color: 'var(--color-success)', fontSize: 11, marginTop: 2 }}>✓ {j.equipo_catalogo_nombre}</div>
                    )}
                    {!j.equipo_catalogo_id && (
                      <div style={{ color: '#a78bfa', fontSize: 11, marginTop: 2 }}>⚠ Sin match en catálogo</div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--color-muted)' }}>
                    {j.posicion ? POSICION_LABELS[j.posicion] || j.posicion : '—'}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {j.usuarios.map(u => (
                        <span key={u.user_id} style={{
                          background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
                          borderRadius: 4, padding: '2px 7px', fontSize: 11, color: 'var(--color-text)',
                        }}>
                          {u.usuario_nombre} ({u.slot})
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-sm"
                        style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid var(--color-success)', color: 'var(--color-success)', fontSize: 12 }}
                        onClick={() => aprobarDirecto(j.id)}
                        title="Aprobar tal como está"
                      >
                        ✅ Aprobar
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid #3b82f6', color: '#3b82f6', fontSize: 12 }}
                        onClick={() => abrirModalAprobar(j)}
                        title="Editar nombre/equipo y aprobar"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid #a78bfa', color: '#a78bfa', fontSize: 12 }}
                        onClick={() => abrirModalUnificar(j)}
                        title="Unificar con jugador existente"
                      >
                        🔗 Unificar
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', fontSize: 12 }}
                        onClick={() => rechazar(j.id)}
                        title="Rechazar — el slot queda vacío"
                      >
                        🚫 Rechazar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ── Modal: Aprobar con edición ── */}
      {modalAprobar && (
        <div style={overlayStyle} onClick={() => setModalAprobar(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 4px 0' }}>✏️ Editar y aprobar jugador</h3>
            <p style={{ color: 'var(--color-muted)', fontSize: 13, marginBottom: 16 }}>
              Corregí los datos y confirmá. Se actualizará para todos los usuarios que lo tienen.
            </p>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Nombre canónico (corregido)</label>
              <input
                type="text"
                value={formAprobar.nombre_canonico}
                onChange={e => setFormAprobar(f => ({ ...f, nombre_canonico: e.target.value }))}
                placeholder={modalAprobar.nombre}
                style={{ ...inputStyle, width: '100%' }}
              />
              <p style={{ color: 'var(--color-muted)', fontSize: 11, marginTop: 4 }}>
                Original: "{modalAprobar.nombre_raw || modalAprobar.nombre}"
              </p>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Equipo del catálogo (opcional)</label>
              <select
                value={formAprobar.equipo_catalogo_id}
                onChange={e => setFormAprobar(f => ({ ...f, equipo_catalogo_id: e.target.value }))}
                style={{ ...inputStyle, width: '100%' }}
              >
                <option value="">— Sin asignar (mantener texto libre) —</option>
                {catalogo.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
              <p style={{ color: 'var(--color-muted)', fontSize: 11, marginTop: 4 }}>
                Equipo recibido: "{modalAprobar.equipo_raw || modalAprobar.equipo_real}"
              </p>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Posición canónica (opcional)</label>
              <select
                value={formAprobar.posicion}
                onChange={e => setFormAprobar(f => ({ ...f, posicion: e.target.value }))}
                style={{ ...inputStyle, width: '100%' }}
              >
                <option value="">— Sin cambiar —</option>
                <option value="ARQ">Arquero</option>
                <option value="DEF">Defensor</option>
                <option value="MED">Mediocampista</option>
                <option value="DEL">Delantero</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setModalAprobar(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={confirmarAprobarEditar}>✅ Aprobar con estos datos</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Unificar ── */}
      {modalUnificar && (
        <div style={overlayStyle} onClick={() => setModalUnificar(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 4px 0' }}>🔗 Unificar con jugador existente</h3>
            <p style={{ color: 'var(--color-muted)', fontSize: 13, marginBottom: 4 }}>
              Buscá el jugador canónico con el que se debe unificar "<strong>{modalUnificar.nombre}</strong>".
              Las referencias de todos los usuarios se redirigirán al jugador seleccionado.
            </p>
            <p style={{ color: 'var(--color-danger)', fontSize: 12, marginBottom: 16 }}>
              ⚠️ Esta acción es irreversible.
            </p>

            <div style={{ marginBottom: 14 }}>
              <input
                type="text"
                placeholder="Buscar jugador aprobado..."
                value={busquedaUnificar}
                onChange={e => buscarParaUnificar(e.target.value)}
                style={{ ...inputStyle, width: '100%' }}
                autoFocus
              />
            </div>

            {candidatosUnificar.length > 0 ? (
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 14 }}>
                {candidatosUnificar.map((c, i) => (
                  <div
                    key={c.id}
                    style={{
                      padding: '10px 14px',
                      borderBottom: i < candidatosUnificar.length - 1 ? '1px solid var(--color-border)' : 'none',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 500 }}>{c.nombre}</span>
                      <span style={{ color: 'var(--color-muted)', fontSize: 12, marginLeft: 8 }}>({c.equipo_real})</span>
                      {c.posicion && <span style={{ color: 'var(--color-muted)', fontSize: 11, marginLeft: 6 }}>{POSICION_LABELS[c.posicion] || c.posicion}</span>}
                    </div>
                    <button
                      className="btn btn-sm"
                      style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid #a78bfa', color: '#a78bfa', fontSize: 12 }}
                      onClick={() => confirmarUnificar(c.id)}
                    >
                      Unificar con este
                    </button>
                  </div>
                ))}
              </div>
            ) : busquedaUnificar.length >= 2 ? (
              <p style={{ color: 'var(--color-muted)', fontSize: 13, marginBottom: 14 }}>No se encontraron jugadores aprobados con ese nombre.</p>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setModalUnificar(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const thStyle = { textAlign: 'left', padding: '8px 12px', color: 'var(--color-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }
const tdStyle = { padding: '10px 12px', fontSize: 13, verticalAlign: 'top' }
const inputStyle = { background: 'var(--color-surface2)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text)', padding: '6px 10px', fontSize: 13 }
const labelStyle = { display: 'block', color: 'var(--color-muted)', fontSize: 12, marginBottom: 5, fontWeight: 600 }
const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
}
const modalStyle = {
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)', padding: 24, width: '100%', maxWidth: 520,
  maxHeight: '90vh', overflowY: 'auto',
}
