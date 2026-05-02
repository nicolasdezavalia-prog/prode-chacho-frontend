import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../../api/index.js'

const POSICIONES = ['ARQ', 'DEF', 'MED', 'DEL']

export default function AdminGDTLigaSlots() {
  const { ligaId } = useParams()

  const [liga,     setLiga]     = useState(null)
  const [slots,    setSlots]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [exito,    setExito]    = useState(null)

  // Modal agregar / editar
  const [modal,     setModal]     = useState(null)   // null | 'agregar' | { slot }
  const [form,      setForm]      = useState({ slot: '', posicion: 'MED', orden: '' })
  const [guardando, setGuardando] = useState(false)
  const [errModal,  setErrModal]  = useState(null)

  // Confirm eliminar
  const [confirmDel, setConfirmDel] = useState(null)  // null | slot object
  const [eliminando, setEliminando] = useState(false)

  useEffect(() => { cargar() }, [ligaId])

  async function cargar() {
    setLoading(true); setError(null)
    try {
      // Cargamos los slots y los metadatos de la liga al mismo tiempo
      const [slotsRes, ligasRes] = await Promise.all([
        api.gdtAdminGetSlots(ligaId),
        api.gdtAdminGetLigas(),
      ])
      setSlots(slotsRes.slots || [])
      const ligaEncontrada = (ligasRes.ligas || []).find(l => String(l.id) === String(ligaId))
      setLiga(ligaEncontrada || { id: ligaId, nombre: `Liga #${ligaId}` })
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  // ── Modal agregar ─────────────────────────────────────────────────────────
  function abrirAgregar() {
    const maxOrden = slots.length > 0 ? Math.max(...slots.map(s => s.orden ?? 0)) : 0
    setForm({ slot: '', posicion: 'MED', orden: String(maxOrden + 1) })
    setErrModal(null)
    setModal('agregar')
  }

  function abrirEditar(slot) {
    setForm({ slot: slot.slot, posicion: slot.posicion || 'MED', orden: String(slot.orden ?? '') })
    setErrModal(null)
    setModal({ slot })
  }

  function cerrarModal() { setModal(null); setErrModal(null) }

  async function handleGuardar() {
    if (!form.slot.trim()) { setErrModal('El nombre del slot es obligatorio.'); return }
    setGuardando(true); setErrModal(null)
    try {
      const payload = {
        slot:     form.slot.trim(),
        posicion: form.posicion,
        orden:    form.orden !== '' ? Number(form.orden) : undefined,
      }
      if (modal === 'agregar') {
        await api.gdtAdminAgregarSlot(ligaId, payload)
        setExito(`Slot "${form.slot.trim()}" agregado.`)
      } else {
        await api.gdtAdminEditarSlot(ligaId, modal.slot.id, payload)
        setExito(`Slot actualizado.`)
      }
      cerrarModal()
      await cargar()
    } catch (e) { setErrModal(e.message) }
    finally { setGuardando(false) }
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────
  async function handleEliminar() {
    if (!confirmDel) return
    setEliminando(true); setError(null)
    try {
      await api.gdtAdminEliminarSlot(ligaId, confirmDel.id)
      setExito(`Slot "${confirmDel.slot}" eliminado.`)
      setConfirmDel(null)
      await cargar()
    } catch (e) { setError(e.message); setConfirmDel(null) }
    finally { setEliminando(false) }
  }

  // ── Reordenar por drag simple (↑ / ↓ buttons) ────────────────────────────
  async function moverSlot(slot, dir) {
    const idx = slots.findIndex(s => s.id === slot.id)
    const swap = dir === 'up' ? slots[idx - 1] : slots[idx + 1]
    if (!swap) return
    setError(null)
    try {
      // Intercambiamos los valores de orden
      await Promise.all([
        api.gdtAdminEditarSlot(ligaId, slot.id,  { slot: slot.slot,  posicion: slot.posicion,  orden: swap.orden }),
        api.gdtAdminEditarSlot(ligaId, swap.id,  { slot: swap.slot,  posicion: swap.posicion,  orden: slot.orden }),
      ])
      await cargar()
    } catch (e) { setError(e.message) }
  }

  if (loading) return <div className="main-content"><p style={{ color: 'var(--color-muted)' }}>Cargando...</p></div>

  return (
    <div className="main-content">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <Link to="/admin/gdt/ligas" style={{ color: 'var(--color-muted)', fontSize: 13 }}>← Ligas GDT</Link>
          <h2 style={{ margin: '4px 0 0' }}>
            🎯 Slots — {liga?.nombre || `Liga #${ligaId}`}
            {liga?.formato && <span style={{ marginLeft: 10, ...formatoBadge(liga.formato) }}>{liga.formato}</span>}
          </h2>
        </div>
        <button className="btn btn-primary" onClick={abrirAgregar}>+ Agregar slot</button>
      </div>

      <p style={{ color: 'var(--color-muted)', fontSize: 12, marginBottom: 16 }}>
        {slots.length} slot{slots.length !== 1 ? 's' : ''} configurado{slots.length !== 1 ? 's' : ''}
        {slots.length > 0 && ' · Los slots con jugadores asignados no pueden eliminarse ni renombrarse.'}
      </p>

      {error && <Alert tipo="danger">{error}</Alert>}
      {exito && <Alert tipo="success">{exito}</Alert>}

      {slots.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-muted)' }}>
          <p>Esta liga no tiene slots configurados.</p>
          <button className="btn btn-primary" onClick={abrirAgregar} style={{ marginTop: 8 }}>
            Agregar primer slot
          </button>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                <th style={{ ...thStyle, width: 48 }}>#</th>
                <th style={thStyle}>Slot</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Posición</th>
                <th style={{ ...thStyle, textAlign: 'center', width: 80 }}>Orden</th>
                <th style={{ ...thStyle, textAlign: 'center', width: 120 }}>Mover</th>
                <th style={{ ...thStyle, textAlign: 'center', width: 140 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((s, idx) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ ...tdStyle, color: 'var(--color-muted)' }}>{idx + 1}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{s.slot}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={posicionBadge(s.posicion)}>{s.posicion || '—'}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-muted)' }}>{s.orden ?? '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => moverSlot(s, 'up')}
                      disabled={idx === 0}
                      style={{ minWidth: 32, marginRight: 4 }}
                      title="Subir"
                    >▲</button>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => moverSlot(s, 'down')}
                      disabled={idx === slots.length - 1}
                      style={{ minWidth: 32 }}
                      title="Bajar"
                    >▼</button>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => abrirEditar(s)} style={{ marginRight: 6 }}>
                      ✏️
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => { setError(null); setExito(null); setConfirmDel(s) }}
                      title="Eliminar slot"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal agregar / editar */}
      {modal && (
        <div style={overlayStyle} onClick={cerrarModal}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px' }}>
              {modal === 'agregar' ? 'Agregar slot' : `Editar slot: ${modal.slot.slot}`}
            </h3>

            {errModal && <Alert tipo="danger">{errModal}</Alert>}

            <label style={labelStyle}>Nombre del slot *</label>
            <input
              autoFocus
              value={form.slot}
              onChange={e => setForm(f => ({ ...f, slot: e.target.value }))}
              style={inputStyle}
              placeholder="Ej: DEL1, ARQ, MED_IZQUIERDA"
              disabled={modal !== 'agregar'}  // renombrar bloqueado si en uso (el backend lo rechaza igualmente)
            />
            {modal !== 'agregar' && (
              <p style={{ fontSize: 11, color: 'var(--color-muted)', margin: '4px 0 0' }}>
                El nombre del slot solo puede modificarse si no hay jugadores asignados. En ese caso el backend lo permitirá.
              </p>
            )}

            <label style={labelStyle}>Posición</label>
            <select value={form.posicion} onChange={e => setForm(f => ({ ...f, posicion: e.target.value }))} style={inputStyle}>
              {POSICIONES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            <label style={labelStyle}>Orden</label>
            <input
              type="number"
              value={form.orden}
              onChange={e => setForm(f => ({ ...f, orden: e.target.value }))}
              style={inputStyle}
              placeholder="Número de orden (1, 2, 3...)"
              min={1}
            />

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={cerrarModal} disabled={guardando}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleGuardar} disabled={guardando}>
                {guardando ? 'Guardando...' : (modal === 'agregar' ? 'Agregar' : 'Guardar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminar */}
      {confirmDel && (
        <div style={overlayStyle} onClick={() => setConfirmDel(null)}>
          <div style={{ ...modalStyle, maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px' }}>¿Eliminar slot?</h3>
            <p style={{ color: 'var(--color-muted)', fontSize: 13 }}>
              Vas a eliminar el slot <strong>{confirmDel.slot}</strong>. Si hay jugadores asignados en este slot, la operación será rechazada.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setConfirmDel(null)} disabled={eliminando}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleEliminar} disabled={eliminando}>
                {eliminando ? 'Eliminando...' : 'Eliminar'}
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

const POS_COLORS = {
  ARQ: { bg: 'rgba(234,179,8,0.15)',  color: '#ca8a04' },
  DEF: { bg: 'rgba(59,130,246,0.15)', color: '#2563eb' },
  MED: { bg: 'rgba(34,197,94,0.15)',  color: '#16a34a' },
  DEL: { bg: 'rgba(239,68,68,0.15)',  color: '#dc2626' },
}
function posicionBadge(pos) {
  const c = POS_COLORS[pos] || { bg: 'var(--color-surface2)', color: 'var(--color-muted)' }
  return { display: 'inline-block', padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', background: c.bg, color: c.color }
}

const thStyle    = { textAlign: 'left', padding: '7px 12px', color: 'var(--color-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }
const tdStyle    = { padding: '8px 12px', verticalAlign: 'middle' }
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 4, marginTop: 12 }
const inputStyle = { width: '100%', boxSizing: 'border-box', background: 'var(--color-surface2)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text)', padding: '7px 10px', fontSize: 13 }
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
const modalStyle   = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 24, width: '100%', maxWidth: 440 }
