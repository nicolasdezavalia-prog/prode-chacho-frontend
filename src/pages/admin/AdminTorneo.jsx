import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../../api/index.js'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function TorneoRow({ torneo, usuarios, onUpdated }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    nombre:        torneo.nombre,
    semestre:      torneo.semestre,
    bloque1_nombre: torneo.bloque1_nombre || 'Bloque 1',
    bloque2_nombre: torneo.bloque2_nombre || 'Bloque 2',
  })
  const [saving, setSaving] = useState(false)
  const [togglingActivo, setTogglingActivo] = useState(false)
  const [expandido, setExpandido] = useState(false)
  const [jugTorneo, setJugTorneo] = useState(null)
  const [addUserId, setAddUserId] = useState('')
  const [loadingJug, setLoadingJug] = useState(false)

  const handleSave = async () => {
    if (!form.nombre || !form.semestre) return
    setSaving(true)
    try {
      await api.updateTorneo(torneo.id, form)
      onUpdated()
      setEditing(false)
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setForm({
      nombre:        torneo.nombre,
      semestre:      torneo.semestre,
      bloque1_nombre: torneo.bloque1_nombre || 'Bloque 1',
      bloque2_nombre: torneo.bloque2_nombre || 'Bloque 2',
    })
    setEditing(false)
  }

  const handleToggleActivo = async () => {
    setTogglingActivo(true)
    try {
      await api.updateTorneo(torneo.id, { activo: torneo.activo ? 0 : 1 })
      onUpdated()
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setTogglingActivo(false)
    }
  }

  const loadJugadores = async () => {
    setLoadingJug(true)
    try {
      const t = await api.getTorneo(torneo.id)
      setJugTorneo(t.jugadores || [])
    } catch (_) {} finally { setLoadingJug(false) }
  }

  const handleExpandir = () => {
    setExpandido(v => !v)
    if (!expandido && !jugTorneo) loadJugadores()
  }

  const handleAgregarJug = async () => {
    if (!addUserId) return
    try {
      await api.addJugadorTorneo(torneo.id, parseInt(addUserId))
      setAddUserId('')
      await loadJugadores()
    } catch (err) { alert('Error: ' + err.message) }
  }

  const handleQuitarJug = async (userId) => {
    if (!confirm('¿Quitar este jugador del torneo?')) return
    try {
      await api.removeJugadorTorneo(torneo.id, userId)
      await loadJugadores()
    } catch (err) { alert('Error: ' + err.message) }
  }

  const cellStyle = {
    padding: '8px 10px',
    borderBottom: '1px solid var(--color-border)',
    fontSize: 13,
    verticalAlign: 'middle',
  }

  const inputStyle = {
    width: '100%',
    border: '1px solid var(--color-primary)',
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: 13,
    outline: 'none',
    background: 'white',
  }

  return (
    <>
      <tr style={{ background: torneo.activo ? 'white' : 'rgba(0,0,0,0.02)' }}>
        {/* Nombre */}
        <td style={cellStyle}>
          {editing
            ? <input style={inputStyle} value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            : <span style={{ fontWeight: 600 }}>{torneo.nombre}</span>
          }
        </td>

        {/* Semestre */}
        <td style={cellStyle}>
          {editing
            ? <input style={{ ...inputStyle, maxWidth: 90 }} value={form.semestre} onChange={e => setForm(f => ({ ...f, semestre: e.target.value }))} placeholder="2025-1" />
            : torneo.semestre
          }
        </td>

        {/* Bloque A */}
        <td style={cellStyle}>
          {editing
            ? <input style={inputStyle} value={form.bloque1_nombre} onChange={e => setForm(f => ({ ...f, bloque1_nombre: e.target.value }))} />
            : <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>{torneo.bloque1_nombre || 'Bloque 1'}</span>
          }
        </td>

        {/* Bloque B */}
        <td style={cellStyle}>
          {editing
            ? <input style={inputStyle} value={form.bloque2_nombre} onChange={e => setForm(f => ({ ...f, bloque2_nombre: e.target.value }))} />
            : <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>{torneo.bloque2_nombre || 'Bloque 2'}</span>
          }
        </td>

        {/* Estado */}
        <td style={cellStyle}>
          <button
            onClick={handleToggleActivo}
            disabled={togglingActivo}
            style={{
              fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99, border: 'none', cursor: 'pointer',
              background: torneo.activo ? 'rgba(22,163,74,0.12)' : 'rgba(0,0,0,0.07)',
              color: torneo.activo ? 'var(--color-success)' : 'var(--color-muted)',
            }}
          >
            {torneo.activo ? '🟢 Abierto' : '⚫ Cerrado'}
          </button>
        </td>

        {/* Acciones */}
        <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
          {editing ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving} style={{ fontSize: 11 }}>
                {saving ? '...' : '✓ Guardar'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={handleCancel} style={{ fontSize: 11 }}>
                Cancelar
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Link
                to={`/admin/torneo/${torneo.id}/fechas`}
                className="btn btn-primary btn-sm"
                style={{ fontSize: 11 }}
              >
                📅 Fechas
              </Link>
              <Link
                to={`/admin/torneo/${torneo.id}/resultados`}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11 }}
              >
                📋 Resultados
              </Link>
              <Link
                to={`/admin/torneo/${torneo.id}/gdt`}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11 }}
              >
                ⚽ Gran DT
              </Link>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)} style={{ fontSize: 11 }}>
                ✏️ Editar
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleExpandir}
                style={{ fontSize: 11 }}
                title="Jugadores del torneo"
              >
                👥 {expandido ? '▲' : '▼'}
              </button>
            </div>
          )}
        </td>
      </tr>

      {/* Fila expandida: jugadores del torneo */}
      {expandido && (
        <tr>
          <td colSpan={6} style={{ padding: '12px 16px', background: 'rgba(59,130,246,0.03)', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--color-muted)' }}>
              JUGADORES DEL TORNEO
            </div>
            {loadingJug && <span style={{ fontSize: 12 }}>Cargando...</span>}
            {jugTorneo && (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {jugTorneo.map(j => (
                    <span key={j.id} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: 'white', border: '1px solid var(--color-border)',
                      borderRadius: 99, padding: '3px 10px', fontSize: 12
                    }}>
                      {j.nombre}
                      <button
                        onClick={() => handleQuitarJug(j.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: 13, lineHeight: 1, padding: 0 }}
                      >×</button>
                    </span>
                  ))}
                  {jugTorneo.length === 0 && (
                    <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Sin jugadores</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    value={addUserId}
                    onChange={e => setAddUserId(e.target.value)}
                    style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 4 }}
                  >
                    <option value="">+ Agregar jugador...</option>
                    {usuarios
                      .filter(u => !jugTorneo.some(j => j.id === u.id))
                      .map(u => (
                        <option key={u.id} value={u.id}>{u.nombre}</option>
                      ))
                    }
                  </select>
                  <button className="btn btn-primary btn-sm" onClick={handleAgregarJug} disabled={!addUserId} style={{ fontSize: 11 }}>
                    Agregar
                  </button>
                </div>
              </>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

export default function AdminTorneo() {
  const [torneos, setTorneos] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNuevo, setShowNuevo] = useState(false)
  const [nuevoForm, setNuevoForm] = useState({ nombre: '', semestre: '', bloque1_nombre: '', bloque2_nombre: '' })
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const [ts, us] = await Promise.all([api.getTorneos(), api.getUsuarios()])
      setTorneos(ts)
      setUsuarios(us)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const handleCrear = async (e) => {
    e.preventDefault()
    if (!nuevoForm.nombre || !nuevoForm.semestre) return
    setCreando(true)
    try {
      await api.createTorneo({
        nombre: nuevoForm.nombre,
        semestre: nuevoForm.semestre,
        bloque1_nombre: nuevoForm.bloque1_nombre || 'Bloque 1',
        bloque2_nombre: nuevoForm.bloque2_nombre || 'Bloque 2',
      })
      setNuevoForm({ nombre: '', semestre: '', bloque1_nombre: '', bloque2_nombre: '' })
      setShowNuevo(false)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreando(false)
    }
  }

  if (loading) return <div className="loading">Cargando...</div>

  const thStyle = {
    padding: '8px 10px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--color-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '2px solid var(--color-border)',
    background: 'var(--color-surface2)',
    whiteSpace: 'nowrap',
  }

  return (
    <div>
      <div className="flex-between mb-16">
        <div className="page-title">🏆 Admin Torneo</div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNuevo(v => !v)}>
          {showNuevo ? 'Cancelar' : '+ Nuevo Torneo'}
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* Formulario nuevo torneo */}
      {showNuevo && (
        <div className="card" style={{ marginBottom: 16, maxWidth: 560 }}>
          <div className="card-header">Nuevo Torneo</div>
          <form onSubmit={handleCrear}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Nombre</label>
                <input
                  value={nuevoForm.nombre}
                  onChange={e => setNuevoForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Prode Chacho 2025"
                  required
                />
              </div>
              <div className="form-group">
                <label>Semestre</label>
                <input
                  value={nuevoForm.semestre}
                  onChange={e => setNuevoForm(f => ({ ...f, semestre: e.target.value }))}
                  placeholder="Ej: 2025-1"
                  required
                />
              </div>
              <div className="form-group">
                <label>Nombre Bloque A (eventos 1–15)</label>
                <input
                  value={nuevoForm.bloque1_nombre}
                  onChange={e => setNuevoForm(f => ({ ...f, bloque1_nombre: e.target.value }))}
                  placeholder="Bloque 1"
                />
              </div>
              <div className="form-group">
                <label>Nombre Bloque B (eventos 16–30)</label>
                <input
                  value={nuevoForm.bloque2_nombre}
                  onChange={e => setNuevoForm(f => ({ ...f, bloque2_nombre: e.target.value }))}
                  placeholder="Bloque 2"
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={creando}>
              {creando ? 'Creando...' : 'Crear Torneo'}
            </button>
          </form>
        </div>
      )}

      {/* Tabla de torneos */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Nombre</th>
              <th style={thStyle}>Semestre</th>
              <th style={thStyle}>Bloque A</th>
              <th style={thStyle}>Bloque B</th>
              <th style={thStyle}>Estado</th>
              <th style={thStyle}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {torneos.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>
                  No hay torneos creados todavía
                </td>
              </tr>
            )}
            {torneos.map(t => (
              <TorneoRow key={t.id} torneo={t} usuarios={usuarios} onUpdated={load} />
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--color-muted)' }}>
        Los nombres de Bloque A y B aplican a todas las fechas de ese torneo.
        Cerrar un torneo no elimina datos, solo lo marca como inactivo.
      </div>
    </div>
  )
}
