import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../../api/index.js'

const FORMATO_BADGE = {
  F5:   { bg: 'rgba(139,92,246,0.15)', color: '#7c3aed' },
  F7:   { bg: 'rgba(59,130,246,0.15)', color: '#2563eb' },
  F9:   { bg: 'rgba(34,197,94,0.15)',  color: '#16a34a' },
  F11:  { bg: 'rgba(234,179,8,0.15)',  color: '#ca8a04' },
  otro: { bg: 'var(--color-surface2)', color: 'var(--color-muted)' },
}

function LigaBadge({ liga }) {
  if (!liga) {
    return (
      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
        background: 'var(--color-surface2)', color: 'var(--color-muted)' }}>
        Default
      </span>
    )
  }
  const c = FORMATO_BADGE[liga.formato] || FORMATO_BADGE.otro
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
      background: c.bg, color: c.color, whiteSpace: 'nowrap' }}
      title={liga.formato ? `Formato ${liga.formato}` : ''}
    >
      {liga.nombre}{liga.es_default ? ' ★' : ''}
    </span>
  )
}

const ESTADO_COLOR = {
  borrador:   { bg: 'rgba(0,0,0,0.06)',          color: '#6b7280', label: 'Borrador'   },
  abierta:    { bg: 'rgba(22,163,74,0.12)',       color: '#16a34a', label: 'Abierta'    },
  cerrada:    { bg: 'rgba(234,179,8,0.15)',       color: '#ca8a04', label: 'Cerrada'    },
  finalizada: { bg: 'rgba(59,130,246,0.12)',      color: '#2563eb', label: 'Finalizada' },
}

export default function AdminTorneoFechas() {
  const { torneoId } = useParams()
  const navigate = useNavigate()
  const [torneo, setTorneo] = useState(null)
  const [fechas, setFechas] = useState([])
  const [ligas,  setLigas]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [torneoId])

  const load = async () => {
    try {
      const [t, fs, ls] = await Promise.all([
        api.getTorneo(torneoId),
        api.getFechas(torneoId),
        api.gdtGetLigas(),
      ])
      setTorneo(t)
      setFechas(fs)
      setLigas(Array.isArray(ls) ? ls : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Mapa id → liga para lookup O(1) en el render
  const ligaMap = Object.fromEntries(ligas.map(l => [l.id, l]))

  if (loading) return <div className="loading">Cargando...</div>
  if (error) return <div className="error-msg">{error}</div>

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
    padding: '10px 10px',
    borderBottom: '1px solid var(--color-border)',
    fontSize: 13,
    verticalAlign: 'middle',
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
        <Link to="/admin" style={{ color: 'var(--color-muted)', textDecoration: 'none' }}>Admin</Link>
        <span>›</span>
        <Link to="/admin/torneo" style={{ color: 'var(--color-muted)', textDecoration: 'none' }}>Torneos</Link>
        <span>›</span>
        <span style={{ color: 'var(--color-text)' }}>{torneo?.nombre}</span>
        <span>›</span>
        <span style={{ color: 'var(--color-text)' }}>Fechas</span>
      </div>

      <div className="flex-between mb-16">
        <div className="page-title">📅 Fechas — {torneo?.nombre}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin/torneo')}>
            ← Volver
          </button>
          <Link to="/admin/fecha/nueva" className="btn btn-primary btn-sm">
            + Nueva Fecha
          </Link>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Fecha</th>
              <th style={thStyle}>Mes / Año</th>
              <th style={thStyle}>Estado</th>
              <th style={thStyle}>Liga GDT</th>
              <th style={thStyle}>Tipo</th>
              <th style={thStyle}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {fechas.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>
                  No hay fechas en este torneo todavía.{' '}
                  <Link to="/admin/fecha/nueva" style={{ color: 'var(--color-primary)' }}>Crear la primera</Link>
                </td>
              </tr>
            )}
            {fechas.map(f => {
              const estado = ESTADO_COLOR[f.estado] || ESTADO_COLOR.borrador
              return (
                <tr key={f.id} style={{ background: 'white' }}>
                  <td style={cellStyle}>
                    <span style={{ fontWeight: 600 }}>
                      {f.nombre || `Fecha ${f.numero}`}
                    </span>
                  </td>
                  <td style={{ ...cellStyle, color: 'var(--color-muted)' }}>
                    {f.mes && f.anio ? `${f.mes}/${f.anio}` : '—'}
                  </td>
                  <td style={cellStyle}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px',
                          borderRadius: 99,
                      background: estado.bg,
                      color: estado.color,
                    }}>
                      {estado.label}
                    </span>
                  </td>
                  <td style={cellStyle}>
                    <LigaBadge liga={f.gdt_liga_id ? ligaMap[f.gdt_liga_id] : null} />
                  </td>
                  <td style={{ ...cellStyle, color: 'var(--color-muted)', fontSize: 12 }}>
                    {f.es_resumida ? '📋 Resumida' : '📝 Normal'}
                  </td>
                  <td style={cellStyle}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Link to={`/admin/fecha/${f.id}`} className="btn btn-secondary btn-sm">Editar</Link>
                      {!f.es_resumida && <Link to={`/admin/fecha/${f.id}/eventos`} className="btn btn-secondary btn-sm">Eventos</Link>}
                      {!f.es_resumida && <Link to={`/admin/fecha/${f.id}/resultados`} className="btn btn-secondary btn-sm">Resultados</Link>}
                      {f.es_resumida && <Link to={`/admin/fecha/${f.id}/resumido`} className="btn btn-secondary btn-sm">Resultados</Link>}
                      <Link to={`/admin/fecha/${f.id}/fixture`} className="btn btn-secondary btn-sm">Fixture</Link>
                      <Link to={`/admin/fecha/${f.id}/gdt`} className="btn btn-secondary btn-sm">GDT</Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
