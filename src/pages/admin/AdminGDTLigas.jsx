import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/index.js'

const FORMATOS = ['F5', 'F7', 'F9', 'F11', 'otro']

const EMPTY_FORM = { nombre: '', descripcion: '', formato: 'F11', pais_categoria: '' }

export default function AdminGDTLigas() {
  const [ligas,    setLigas]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [exito,    setExito]    = useState(null)

  // Modal crear / editar
  const [modal,     setModal]     = useState(null)   // null | 'crear' | { liga }
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [guardando, setGuardando] = useState(false)
  const [errModal,  setErrModal]  = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true); setError(null)
    try {
      const data = await api.gdtAdminGetLigas()
      setLigas(data.ligas || [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  function abrirCrear() {
    setForm(EMPTY_FORM); setErrModal(null); setModal('crear')
  }

  function abrirEditar(liga) {
    setForm({
      nombre:         liga.nombre         || '',
      descripcion:    liga.descripcion    || '',
      formato:        liga.formato        || 'F11',
      pais_categoria: liga.pais_categoria || '',
    })
    setErrModal(null)
    setModal({ liga })
  }

  function cerrarModal() { setModal(null); setErrModal(null) }

  async function handleGuardar() {
    if (!form.nombre.trim()) { setErrModal('El nombre es obligatorio.'); return }
    setGuardando(true); setErrModal(null)
    try {
      if (modal === 'crear') {
        await api.gdtAdminCrearLiga(form)
        setExito('Liga creada.')
      } else {
        await api.gdtAdminEditarLiga(modal.liga.id, form)
        setExito('Liga actualizada.')
      }
      cerrarModal()
      await cargar()
    } catch (e) { setErrModal(e.message) }
    finally { setGuardando(false) }
  }

  async function handleToggleActivo(liga) {
    setExito(null); setError(null)
    try {
      const res = await api.gdtAdminToggleActivo(liga.id)
      setExito(res.mensaje || 'Estado actualizado.')
      await cargar()
    } catch (e) { setError(e.message) }
  }

  async function handleSetDefault(liga) {
    setExito(null); setError(null)
    try {
      const res = await api.gdtAdminSetDefault(liga.id)
      setExito(res.mensaje || 'Liga default actualizada.')
      await cargar()
    } catch (e) { setError(e.message) }
  }

  if (loading) return <div className="main-content"><p style={{ color: 'var(--color-muted)' }}>Cargando...</p></div>

  return (
    <div className="main-content">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>🏟️ Ligas GDT</h2>
        <button className="btn btn-primary" onClick={abrirCrear}>+ Nueva liga</button>
      </div>

      {error && <Alert tipo="danger">{error}</Alert>}
      {exito && <Alert tipo="success">{exito}</Alert>}

      {ligas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-muted)' }}>
          <p>No hay ligas registradas todavía.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                {['Nombre', 'Formato', 'País/Cat.', 'Slots', 'Usuarios', 'Estado', 'Default', 'Acciones'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ligas.map(liga => (
                <tr key={liga.id} style={{ borderBottom: '1px solid var(--color-border)', opacity: liga.activo ? 1 : 0.55 }}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 600 }}>{liga.nombre}</span>
                    {liga.descripcion && <span style={{ color: 'var(--color-muted)', marginLeft: 8, fontSize: 11 }}>{liga.descripcion}</span>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={formatoBadge(liga.formato)}>{liga.formato || '—'}</span>
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--color-muted)' }}>{liga.pais_categoria || '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{liga.slots_count ?? 0}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{liga.usuarios_count ?? 0}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <button
                      className={`btn btn-sm ${liga.activo ? 'btn-success' : 'btn-secondary'}`}
                      onClick={() => handleToggleActivo(liga)}
                      title={liga.activo ? 'Desactivar liga' : 'Activar liga'}
                      style={{ minWidth: 72 }}
                    >
                      {liga.activo ? '✓ Activa' : 'Inactiva'}
                    </button>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {liga.es_default ? (
                      <span style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: 12 }}>★ Default</span>
                    ) : (
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleSetDefault(liga)}
                        disabled={!liga.activo}
                        title={liga.activo ? 'Hacer default' : 'Activá la liga primero'}
                      >
                        Hacer default
                      </button>
                    )}
                  </td>
                  <td style={{ ...tdStyle, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => abrirEditar(liga)}>
                      ✏️ Editar
                    </button>
                    <Link to={`/admin/gdt/ligas/${liga.id}/slots`} className="btn btn-sm btn-secondary">
                      🎯 Slots
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear / editar */}
      {modal && (
        <div style={overlayStyle} onClick={cerrarModal}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px' }}>
              {modal === 'crear' ? 'Nueva liga' : `Editar: ${modal.liga.nombre}`}
            </h3>

            {errModal && <Alert tipo="danger">{errModal}</Alert>}

            <label style={labelStyle}>Nombre *</label>
            <input
              autoFocus
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              style={inputStyle}
              placeholder="Ej: Liga Argentina"
            />

            <label style={labelStyle}>Descripción</label>
            <input
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              style={inputStyle}
              placeholder="Opcional"
            />

            <label style={labelStyle}>Formato</label>
            <select value={form.formato} onChange={e => setForm(f => ({ ...f, formato: e.target.value }))} style={inputStyle}>
              {FORMATOS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>

            <label style={labelStyle}>País / Categoría</label>
            <input
              value={form.pais_categoria}
              onChange={e => setForm(f => ({ ...f, pais_categoria: e.target.value }))}
              style={inputStyle}
              placeholder="Ej: Argentina, Europa, etc."
            />

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={cerrarModal} disabled={guardando}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleGuardar} disabled={guardando}>
                {guardando ? 'Guardando...' : (modal === 'crear' ? 'Crear liga' : 'Guardar cambios')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Alert({ tipo, children }) {
  const colors = {
    danger:  { bg: 'rgba(239,68,68,0.1)',  border: 'var(--color-danger)',  color: 'var(--color-danger)' },
    success: { bg: 'rgba(34,197,94,0.1)',  border: 'var(--color-success)', color: 'var(--color-success)' },
  }
  const c = colors[tipo] || colors.danger
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 12, color: c.color }}>
      {children}
    </div>
  )
}

const FORMATO_COLORS = {
  F5:   { bg: 'rgba(139,92,246,0.15)', color: '#7c3aed' },
  F7:   { bg: 'rgba(59,130,246,0.15)', color: '#2563eb' },
  F9:   { bg: 'rgba(34,197,94,0.15)',  color: '#16a34a' },
  F11:  { bg: 'rgba(234,179,8,0.15)', color: '#ca8a04' },
  otro: { bg: 'var(--color-surface2)', color: 'var(--color-muted)' },
}
function formatoBadge(formato) {
  const c = FORMATO_COLORS[formato] || FORMATO_COLORS.otro
  return { display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color }
}

const thStyle   = { textAlign: 'left', padding: '7px 12px', color: 'var(--color-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }
const tdStyle   = { padding: '8px 12px', verticalAlign: 'middle' }
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 4, marginTop: 12 }
const inputStyle = { width: '100%', boxSizing: 'border-box', background: 'var(--color-surface2)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text)', padding: '7px 10px', fontSize: 13 }
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
const modalStyle   = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 24, width: '100%', maxWidth: 440 }
