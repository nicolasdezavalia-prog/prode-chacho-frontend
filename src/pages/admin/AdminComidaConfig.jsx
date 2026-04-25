import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../../api/index.js'

const DEFAULT_ITEMS = [
  { nombre: 'Comida', peso: 40 },
  { nombre: 'Precio/Calidad', peso: 30 },
  { nombre: 'Servicio', peso: 20 },
  { nombre: 'Ambiente', peso: 10 },
]

export default function AdminComidaConfig() {
  const { torneoId } = useParams()

  const [torneo, setTorneo]   = useState(null)
  const [items, setItems]     = useState(DEFAULT_ITEMS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [ok, setOk]           = useState('')
  const [isDefault, setIsDefault] = useState(false)

  useEffect(() => {
    load()
  }, [torneoId])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [t, cfg] = await Promise.all([
        api.getTorneo(parseInt(torneoId)),
        api.getComidaVotacionConfig(parseInt(torneoId)),
      ])
      setTorneo(t)
      setItems(cfg.items.map(i => ({ nombre: i.nombre, peso: Number(i.peso) })))
      setIsDefault(cfg.is_default || false)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const total = items.reduce((sum, i) => sum + (Number(i.peso) || 0), 0)
  const totalOk = Math.round(total) === 100

  const handleNombre = (idx, val) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, nombre: val } : it))
    setOk('')
  }

  const handlePeso = (idx, val) => {
    const n = val === '' ? '' : Number(val)
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, peso: n } : it))
    setOk('')
  }

  const handleAgregar = () => {
    setItems(prev => [...prev, { nombre: '', peso: 0 }])
    setOk('')
  }

  const handleEliminar = (idx) => {
    if (items.length <= 1) return
    setItems(prev => prev.filter((_, i) => i !== idx))
    setOk('')
  }

  const handleGuardar = async () => {
    setError('')
    setOk('')

    // Validar nombres
    for (const it of items) {
      if (!it.nombre.trim()) {
        setError('Todos los ítems deben tener nombre.')
        return
      }
      if (typeof it.peso !== 'number' || it.peso <= 0) {
        setError('Todos los pesos deben ser mayores a 0.')
        return
      }
    }
    if (!totalOk) {
      setError(`Los pesos deben sumar exactamente 100 (suma actual: ${total}).`)
      return
    }

    setSaving(true)
    try {
      await api.saveComidaVotacionConfig(parseInt(torneoId), items.map(i => ({ nombre: i.nombre.trim(), peso: Number(i.peso) })))
      setOk('Configuración guardada.')
      setIsDefault(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleRestaurarDefault = () => {
    if (!confirm('¿Restaurar la configuración por defecto?')) return
    setItems(DEFAULT_ITEMS.map(i => ({ ...i })))
    setOk('')
    setError('')
  }

  if (loading) return <div className="loading">Cargando...</div>

  const thStyle = {
    padding: '8px 12px',
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

  const tdStyle = {
    padding: '8px 12px',
    borderBottom: '1px solid var(--color-border)',
    verticalAlign: 'middle',
    fontSize: 14,
  }

  const inputStyle = {
    border: '1px solid var(--color-border)',
    borderRadius: 4,
    padding: '5px 8px',
    fontSize: 13,
    outline: 'none',
    background: 'white',
    width: '100%',
  }

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 16, display: 'flex', gap: 6, alignItems: 'center' }}>
        <Link to="/admin/torneos" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>Torneos</Link>
        <span>›</span>
        <span>{torneo?.nombre || `Torneo ${torneoId}`}</span>
        <span>›</span>
        <span>Config. Comidas</span>
      </div>

      <div className="flex-between mb-16">
        <div className="page-title">🍽️ Config. Votación de Comidas</div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleRestaurarDefault}
          style={{ fontSize: 11 }}
        >
          ↺ Restaurar default
        </button>
      </div>

      {torneo && (
        <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 20 }}>
          Torneo: <strong>{torneo.nombre}</strong> · Semestre: {torneo.semestre}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Ítems de votación</span>
          {isDefault && (
            <span style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 400 }}>
              (usando configuración por defecto)
            </span>
          )}
        </div>

        <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 16, marginTop: 0 }}>
          Definí qué aspectos se votan en las comidas del torneo y qué peso tiene cada uno.
          Los pesos deben sumar exactamente 100.
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
          <thead>
            <tr>
              <th style={thStyle}>Ítem</th>
              <th style={{ ...thStyle, width: 110 }}>Peso (%)</th>
              <th style={{ ...thStyle, width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx}>
                <td style={tdStyle}>
                  <input
                    style={inputStyle}
                    value={item.nombre}
                    onChange={e => handleNombre(idx, e.target.value)}
                    placeholder="Nombre del ítem"
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    style={{ ...inputStyle, textAlign: 'right' }}
                    type="number"
                    min={1}
                    max={100}
                    value={item.peso}
                    onChange={e => handlePeso(idx, e.target.value)}
                  />
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <button
                    onClick={() => handleEliminar(idx)}
                    disabled={items.length <= 1}
                    title="Eliminar ítem"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: items.length <= 1 ? 'not-allowed' : 'pointer',
                      color: items.length <= 1 ? 'var(--color-muted)' : 'var(--color-danger)',
                      fontSize: 16,
                      lineHeight: 1,
                      padding: '2px 4px',
                    }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ ...tdStyle, fontWeight: 700, fontSize: 13 }}>Total</td>
              <td style={{
                ...tdStyle,
                fontWeight: 700,
                textAlign: 'right',
                color: totalOk ? 'var(--color-success)' : 'var(--color-danger)',
              }}>
                {total}%
              </td>
              <td style={tdStyle}></td>
            </tr>
          </tfoot>
        </table>

        <button
          className="btn btn-secondary btn-sm"
          onClick={handleAgregar}
          style={{ fontSize: 12, marginBottom: 4 }}
        >
          + Agregar ítem
        </button>
      </div>

      {error && (
        <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>
      )}
      {ok && (
        <div style={{
          marginBottom: 12,
          padding: '8px 14px',
          background: 'rgba(22,163,74,0.1)',
          color: 'var(--color-success)',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
        }}>
          ✓ {ok}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          className="btn btn-primary"
          onClick={handleGuardar}
          disabled={saving || !totalOk}
          style={{ opacity: (!totalOk) ? 0.6 : 1 }}
        >
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
        <Link to="/admin/torneos" className="btn btn-secondary" style={{ fontSize: 13 }}>
          Volver
        </Link>
        {!totalOk && (
          <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>
            Los pesos deben sumar 100 (falta {100 - total})
          </span>
        )}
      </div>
    </div>
  )
}
