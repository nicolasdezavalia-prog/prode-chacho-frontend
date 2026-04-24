import { useState, useEffect } from 'react'
import { api } from '../api/index.js'

const ESTADOS = [
  { value: 'pendiente',   label: '⏳ Pendiente',   color: 'var(--color-muted)' },
  { value: 'confirmada',  label: '✅ Confirmada',  color: 'var(--color-success)' },
  { value: 'realizada',   label: '🍗 Realizada',   color: 'var(--color-primary)' },
]

function estadoConfig(estado) {
  return ESTADOS.find(e => e.value === estado) || ESTADOS[0]
}

/**
 * ComidaMensualCard
 *
 * Props:
 *  - torneoId: number
 *  - mes: number
 *  - anio: number
 *  - jugadores: Array<{ id, nombre }> (lista de jugadores del torneo)
 *  - puedeEditar: boolean (tiene permiso editar_tabla_mensual o es superadmin)
 *  - organizadorSugerido: { id, nombre } | null (tomado del cierre mensual si existe)
 */
export default function ComidaMensualCard({ torneoId, mes, anio, jugadores = [], puedeEditar, organizadorSugerido }) {
  const [comida, setComida] = useState(undefined)   // undefined = cargando, null = no existe
  const [editando, setEditando] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    organizador_user_id: '',
    lugar: '',
    fecha_comida: '',
    google_maps_url: '',
    nota: '',
    estado: 'pendiente',
  })

  useEffect(() => {
    if (!torneoId || !mes || !anio) return
    setComida(undefined)
    setEditando(false)
    api.getComida(torneoId, mes, anio)
      .then(data => setComida(data))
      .catch(() => setComida(null))
  }, [torneoId, mes, anio])

  const abrirEdicion = () => {
    setForm({
      organizador_user_id: comida?.organizador_user_id?.toString()
        || organizadorSugerido?.id?.toString()
        || '',
      lugar:           comida?.lugar           || '',
      fecha_comida:    comida?.fecha_comida     || '',
      google_maps_url: comida?.google_maps_url  || '',
      nota:            comida?.nota             || '',
      estado:          comida?.estado           || 'pendiente',
    })
    setEditando(true)
  }

  const cancelar = () => setEditando(false)

  const guardar = async () => {
    setSaving(true)
    try {
      const saved = await api.saveComida({
        torneo_id:          torneoId,
        mes,
        anio,
        organizador_user_id: form.organizador_user_id ? parseInt(form.organizador_user_id) : null,
        lugar:               form.lugar.trim()           || null,
        fecha_comida:        form.fecha_comida.trim()    || null,
        google_maps_url:     form.google_maps_url.trim() || null,
        nota:                form.nota.trim()            || null,
        estado:              form.estado,
      })
      setComida(saved)
      setEditando(false)
    } catch (err) {
      alert('Error al guardar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  // ——— RENDER ———

  if (comida === undefined) {
    return null // cargando silenciosamente
  }

  const cfg = estadoConfig(comida?.estado)

  const cardStyle = {
    flex: '1 1 260px',
    minWidth: 240,
  }

  const labelStyle = {
    fontSize: 11,
    color: 'var(--color-muted)',
    display: 'block',
    marginBottom: 3,
  }

  const inputStyle = {
    width: '100%',
    fontSize: 13,
    boxSizing: 'border-box',
  }

  return (
    <div className="card" style={cardStyle}>
      <div className="card-header" style={{ paddingBottom: 8 }}>
        🍽️ Comida del mes
        {comida && (
          <span style={{ fontSize: 11, color: cfg.color, marginLeft: 8, fontWeight: 500 }}>
            {cfg.label}
          </span>
        )}
      </div>

      {!editando ? (
        /* ——— MODO VISTA ——— */
        <div style={{ padding: '4px 0' }}>
          {!comida ? (
            <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '4px 0 8px' }}>
              Sin información cargada aún.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Organizador */}
              {comida.organizador_nombre && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>💸</span>
                  <span style={{ fontSize: 13 }}>
                    <span style={{ color: 'var(--color-muted)', marginRight: 4 }}>Organizador:</span>
                    <strong>{comida.organizador_nombre}</strong>
                  </span>
                </div>
              )}

              {/* Lugar */}
              {comida.lugar && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>📍</span>
                  <span style={{ fontSize: 13 }}>
                    <span style={{ color: 'var(--color-muted)', marginRight: 4 }}>Lugar:</span>
                    {comida.google_maps_url ? (
                      <a
                        href={comida.google_maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--color-primary)', fontWeight: 600 }}
                      >
                        {comida.lugar}
                      </a>
                    ) : (
                      <strong>{comida.lugar}</strong>
                    )}
                  </span>
                </div>
              )}

              {/* Fecha */}
              {comida.fecha_comida && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>📅</span>
                  <span style={{ fontSize: 13 }}>
                    <span style={{ color: 'var(--color-muted)', marginRight: 4 }}>Fecha:</span>
                    <strong>{comida.fecha_comida}</strong>
                  </span>
                </div>
              )}

              {/* Link maps si hay lugar + url */}
              {comida.google_maps_url && !comida.lugar && (
                <div>
                  <a
                    href={comida.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 13, color: 'var(--color-primary)' }}
                  >
                    📍 Ver ubicación
                  </a>
                </div>
              )}

              {/* Nota */}
              {comida.nota && (
                <div style={{
                  marginTop: 4,
                  padding: '6px 10px',
                  background: 'var(--color-surface2)',
                  borderRadius: 6,
                  fontSize: 12,
                  color: 'var(--color-muted)',
                  borderLeft: '3px solid var(--color-primary)',
                }}>
                  {comida.nota}
                </div>
              )}
            </div>
          )}

          {puedeEditar && (
            <div style={{ marginTop: 10 }}>
              <button
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 12 }}
                onClick={abrirEdicion}
              >
                ✏️ {comida ? 'Editar' : 'Cargar comida'}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ——— MODO EDICIÓN ——— */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
          {/* Organizador */}
          <div>
            <label style={labelStyle}>Organizador</label>
            <select
              value={form.organizador_user_id}
              onChange={e => set('organizador_user_id', e.target.value)}
              style={inputStyle}
            >
              <option value="">— sin seleccionar —</option>
              {jugadores.map(j => (
                <option key={j.id} value={j.id}>{j.nombre}</option>
              ))}
            </select>
          </div>

          {/* Lugar */}
          <div>
            <label style={labelStyle}>Lugar</label>
            <input
              type="text"
              value={form.lugar}
              onChange={e => set('lugar', e.target.value)}
              placeholder="Ej: Lo de Chacho, Palermo"
              style={inputStyle}
            />
          </div>

          {/* Fecha comida */}
          <div>
            <label style={labelStyle}>Fecha de la comida</label>
            <input
              type="text"
              value={form.fecha_comida}
              onChange={e => set('fecha_comida', e.target.value)}
              placeholder="Ej: Sábado 15 de marzo"
              style={inputStyle}
            />
          </div>

          {/* Google Maps URL */}
          <div>
            <label style={labelStyle}>Link Google Maps (opcional)</label>
            <input
              type="url"
              value={form.google_maps_url}
              onChange={e => set('google_maps_url', e.target.value)}
              placeholder="https://maps.google.com/..."
              style={inputStyle}
            />
          </div>

          {/* Estado */}
          <div>
            <label style={labelStyle}>Estado</label>
            <select
              value={form.estado}
              onChange={e => set('estado', e.target.value)}
              style={inputStyle}
            >
              {ESTADOS.map(e => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>

          {/* Nota */}
          <div>
            <label style={labelStyle}>Nota (opcional)</label>
            <textarea
              value={form.nota}
              onChange={e => set('nota', e.target.value)}
              rows={2}
              placeholder="Ej: Reserva a nombre de Juan..."
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
            <button
              className="btn btn-primary btn-sm"
              style={{ fontSize: 12 }}
              onClick={guardar}
              disabled={saving}
            >
              {saving ? 'Guardando...' : '💾 Guardar'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 12 }}
              onClick={cancelar}
              disabled={saving}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
