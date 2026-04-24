import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../../api/index.js'

const ESTADO_COLOR = {
  abierta:    { bg: 'rgba(22,163,74,0.12)',  color: '#16a34a', label: 'Abierta'    },
  cerrada:    { bg: 'rgba(234,179,8,0.15)', color: '#ca8a04', label: 'Cerrada'    },
  finalizada: { bg: 'rgba(59,130,246,0.12)', color: '#2563eb', label: 'Finalizada' },
}

export default function AdminTorneoResultados() {
  const { torneoId } = useParams()
  const navigate = useNavigate()
  const [torneo, setTorneo] = useState(null)
  const [fechas, setFechas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [torneoId])

  const load = async () => {
    try {
      const [t, fs] = await Promise.all([
        api.getTorneo(torneoId),
        api.getFechas(torneoId),
      ])
      setTorneo(t)
      // Solo fechas que no son borrador (se pueden cargar resultados)
      setFechas(fs.filter(f => f.estado !== 'borrador'))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

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
        <span style={{ color: 'var(--color-text)' }}>Cargar resultados</span>
      </div>

      <div className="flex-between mb-16">
        <div className="page-title">📋 Cargar resultados — {torneo?.nombre}</div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin/torneo')}>
          ← Volver
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Fecha</th>
              <th style={thStyle}>Mes / Año</th>
              <th style={thStyle}>Estado</th>
              <th style={thStyle}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {fechas.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>
                  No hay fechas disponibles para cargar resultados.
                  Las fechas deben estar abiertas, cerradas o finalizadas.
                </td>
              </tr>
            )}
            {fechas.map(f => {
              const estado = ESTADO_COLOR[f.estado]
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
                    {estado && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 10px',
                        borderRadius: 99, background: estado.bg, color: estado.color,
                      }}>
                        {estado.label}
                      </span>
                    )}
                  </td>
                  <td style={cellStyle}>
                    <Link
                      to={`/admin/fecha/${f.id}/resultados`}
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: 11 }}
                    >
                      Cargar resultados →
                    </Link>
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
