import { useEffect, useState } from 'react'
import { api } from '../../api/index.js'

/**
 * Tab "Equipos" del AdminMundialHub — Fase 2.1.
 *
 * Responsabilidades:
 *   - Listar el catálogo de equipos (mundial_equipos_catalogo) ordenado por grupo+código.
 *   - Permitir alta masiva ("Cargar 48 equipos del Mundial 2026") — idempotente.
 *   - Permitir alta manual de equipos individuales.
 *   - Edición inline de nombre / emoji / grupo / activo.
 *   - Borrado.
 *   - Bloqueo total de acciones cuando el torneo no está en 'configuracion' o 'abierto'
 *     (el backend también lo valida — el bloqueo en UI es solo afordance).
 *
 * Props:
 *   torneoId  — id del torneo Mundial.
 *   estado    — estado actual del torneo (de mundial_config). Usado para habilitar/deshabilitar.
 *   onChanged — callback opcional que se dispara cuando hay un cambio que el parent
 *               quiera reflejar (p. ej. recargar config o contador).
 */

const ESTADOS_EDITABLES = new Set(['configuracion', 'abierto'])
const GRUPOS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
const TOTAL_ESPERADO = 48

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

export default function AdminMundialEquipos({ torneoId, estado, onChanged }) {
  const [equipos, setEquipos]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [info, setInfo]           = useState('')
  const [seeding, setSeeding]     = useState(false)
  const [showNuevo, setShowNuevo] = useState(false)
  const [nuevoForm, setNuevoForm] = useState({ codigo: '', nombre: '', emoji: '', grupo: '' })
  const [creando, setCreando]     = useState(false)

  const editable = ESTADOS_EDITABLES.has(estado)

  useEffect(() => { load() /* eslint-disable-next-line */ }, [torneoId])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await api.getMundialEquiposCatalogo(torneoId)
      setEquipos(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSeed() {
    if (!editable) return
    const ok = confirm(
      `¿Cargar los 48 equipos del Mundial 2026?\n\n` +
      `Si ya hay equipos cargados, los que coinciden por código se respetan ` +
      `(idempotente — no duplica ni pisa nombres editados).`
    )
    if (!ok) return
    setSeeding(true)
    setError('')
    setInfo('')
    try {
      const r = await api.seedMundial2026Equipos(torneoId)
      setInfo(`Carga OK · creados: ${r.creados} · actualizados: ${r.actualizados} · total: ${r.total}`)
      await load()
      onChanged?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setSeeding(false)
    }
  }

  async function handleCrear(e) {
    e.preventDefault()
    if (!editable) return
    if (!nuevoForm.codigo || !nuevoForm.nombre) return
    setCreando(true)
    setError('')
    setInfo('')
    try {
      await api.createMundialEquipo(torneoId, {
        codigo: nuevoForm.codigo,
        nombre: nuevoForm.nombre,
        emoji:  nuevoForm.emoji || null,
        grupo:  nuevoForm.grupo || null,
      })
      setInfo(`Equipo ${String(nuevoForm.codigo).toUpperCase()} agregado.`)
      setNuevoForm({ codigo: '', nombre: '', emoji: '', grupo: '' })
      setShowNuevo(false)
      await load()
      onChanged?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setCreando(false)
    }
  }

  async function handleSave(equipoId, patch) {
    setError('')
    setInfo('')
    try {
      await api.updateMundialEquipo(torneoId, equipoId, patch)
      await load()
      onChanged?.()
      return true
    } catch (e) {
      setError(e.message)
      return false
    }
  }

  async function handleDelete(equipo) {
    if (!editable) return
    const ok = confirm(`¿Borrar el equipo ${equipo.codigo} (${equipo.nombre})?\n\nEsta acción no se puede deshacer.`)
    if (!ok) return
    setError('')
    setInfo('')
    try {
      await api.deleteMundialEquipo(torneoId, equipo.id)
      setInfo(`Equipo ${equipo.codigo} borrado.`)
      await load()
      onChanged?.()
    } catch (e) {
      setError(e.message)
    }
  }

  if (loading) return <div className="loading">Cargando equipos...</div>

  return (
    <div>
      {/* Banner si estado bloqueado */}
      {!editable && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(0,0,0,0.04)',
          color: 'var(--color-muted)',
          borderRadius: 6,
          marginBottom: 12,
          fontSize: 13,
        }}>
          ℹ️ El catálogo de equipos solo se puede editar mientras el estado del torneo es{' '}
          <strong>Configuración</strong> o <strong>Abierto</strong>.
          Actualmente está en <strong>{estado}</strong>. Las acciones quedan deshabilitadas.
        </div>
      )}

      {/* Header */}
      <div className="flex-between mb-16" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 14 }}>
          <strong>{equipos.length}</strong> / {TOTAL_ESPERADO} equipos cargados
          {equipos.length < TOTAL_ESPERADO && editable && (
            <span style={{ color: 'var(--color-muted)', marginLeft: 8 }}>
              · faltan {TOTAL_ESPERADO - equipos.length}
            </span>
          )}
          {equipos.length > TOTAL_ESPERADO && (
            <span style={{ color: 'var(--color-muted)', marginLeft: 8 }}>
              · {equipos.length - TOTAL_ESPERADO} extra(s) más allá del Mundial 2026
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowNuevo(v => !v)}
            disabled={!editable}
            title={!editable ? 'Bloqueado por estado del torneo' : ''}
          >
            {showNuevo ? 'Cancelar' : '+ Agregar equipo'}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSeed}
            disabled={!editable || seeding}
            title={!editable
              ? 'Bloqueado por estado del torneo'
              : 'Idempotente: re-ejecutar no duplica ni pisa nombres editados'}
          >
            {seeding ? 'Cargando...' : '🌍 Cargar 48 equipos del Mundial 2026'}
          </button>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {info && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(22,163,74,0.10)',
          color: 'var(--color-success)',
          borderRadius: 6,
          marginBottom: 12,
          fontSize: 13,
        }}>
          {info}
        </div>
      )}

      {/* Form nuevo equipo (toggle) */}
      {showNuevo && editable && (
        <form onSubmit={handleCrear} className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">Nuevo equipo</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <div className="form-group">
              <label>Código *</label>
              <input
                value={nuevoForm.codigo}
                onChange={e => setNuevoForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))}
                placeholder="ARG"
                maxLength={10}
                required
              />
            </div>
            <div className="form-group">
              <label>Nombre *</label>
              <input
                value={nuevoForm.nombre}
                onChange={e => setNuevoForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Argentina"
                required
              />
            </div>
            <div className="form-group">
              <label>Bandera (emoji)</label>
              <input
                value={nuevoForm.emoji}
                onChange={e => setNuevoForm(f => ({ ...f, emoji: e.target.value }))}
                placeholder="🇦🇷"
              />
            </div>
            <div className="form-group">
              <label>Grupo</label>
              <select
                value={nuevoForm.grupo}
                onChange={e => setNuevoForm(f => ({ ...f, grupo: e.target.value }))}
              >
                <option value="">—</option>
                {GRUPOS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={creando}>
            {creando ? 'Creando...' : 'Crear equipo'}
          </button>
        </form>
      )}

      {/* Grilla */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Código</th>
              <th style={thStyle}>Bandera</th>
              <th style={thStyle}>Nombre</th>
              <th style={thStyle}>Grupo</th>
              <th style={thStyle}>Activo</th>
              <th style={thStyle}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {equipos.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>
                  No hay equipos cargados. Usá <strong>Cargar 48 equipos del Mundial 2026</strong> para arrancar.
                </td>
              </tr>
            )}
            {equipos.map(eq => (
              <EquipoRow
                key={eq.id}
                equipo={eq}
                editable={editable}
                onSave={(patch) => handleSave(eq.id, patch)}
                onDelete={() => handleDelete(eq)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EquipoRow({ equipo, editable, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState({
    nombre: equipo.nombre || '',
    emoji:  equipo.emoji  || '',
    grupo:  equipo.grupo  || '',
    activo: equipo.activo ?? 1,
  })

  const handleSaveClick = async () => {
    setSaving(true)
    const ok = await onSave({
      nombre: form.nombre,
      emoji:  form.emoji || null,
      grupo:  form.grupo || null,
      activo: form.activo,
    })
    setSaving(false)
    if (ok) setEditing(false) // si falla, mantenemos edit mode (error queda en el banner del parent)
  }

  const handleCancel = () => {
    setForm({
      nombre: equipo.nombre || '',
      emoji:  equipo.emoji  || '',
      grupo:  equipo.grupo  || '',
      activo: equipo.activo ?? 1,
    })
    setEditing(false)
  }

  return (
    <tr style={{ background: equipo.activo ? 'white' : 'rgba(0,0,0,0.02)' }}>
      <td style={{ ...cellStyle, fontWeight: 600, fontFamily: 'monospace' }}>{equipo.codigo}</td>

      {/* Bandera (emoji) */}
      <td style={cellStyle}>
        {editing
          ? <input
              style={{ ...inputStyle, maxWidth: 80 }}
              value={form.emoji}
              onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
              placeholder="🇦🇷"
            />
          : <span style={{ fontSize: 18 }}>{equipo.emoji || '—'}</span>}
      </td>

      {/* Nombre */}
      <td style={cellStyle}>
        {editing
          ? <input
              style={inputStyle}
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
            />
          : equipo.nombre}
      </td>

      {/* Grupo */}
      <td style={cellStyle}>
        {editing
          ? (
              <select
                style={{ ...inputStyle, maxWidth: 80 }}
                value={form.grupo}
                onChange={e => setForm(f => ({ ...f, grupo: e.target.value }))}
              >
                <option value="">—</option>
                {GRUPOS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            )
          : <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{equipo.grupo || '—'}</span>}
      </td>

      {/* Activo */}
      <td style={cellStyle}>
        {editing
          ? (
              <input
                type="checkbox"
                checked={!!form.activo}
                onChange={e => setForm(f => ({ ...f, activo: e.target.checked ? 1 : 0 }))}
              />
            )
          : (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                background: equipo.activo ? 'rgba(22,163,74,0.12)' : 'rgba(0,0,0,0.07)',
                color:      equipo.activo ? 'var(--color-success)'  : 'var(--color-muted)',
              }}>
                {equipo.activo ? 'Activo' : 'Inactivo'}
              </span>
            )}
      </td>

      {/* Acciones */}
      <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
        {editing ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSaveClick}
              disabled={saving}
              style={{ fontSize: 11 }}
            >
              {saving ? '...' : '✓ Guardar'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleCancel}
              style={{ fontSize: 11 }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setEditing(true)}
              disabled={!editable}
              title={!editable ? 'Bloqueado por estado del torneo' : ''}
              style={{ fontSize: 11 }}
            >
              ✏️ Editar
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={onDelete}
              disabled={!editable}
              title={!editable ? 'Bloqueado por estado del torneo' : ''}
              style={{ fontSize: 11, color: editable ? 'var(--color-danger)' : 'inherit' }}
            >
              🗑️
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}
