import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/index.js'

export default function AdminComidasHub() {
  const [torneos, setTorneos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    api.getTorneos()
      .then(setTorneos)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Cargando...</div>

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="flex-between mb-16">
        <div className="page-title">🍕 Comidas</div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 24, marginTop: 0 }}>
        Seleccioná un torneo para configurar los ítems y pesos de votación de sus comidas.
      </p>

      {error && <div className="error-msg">{error}</div>}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Torneo</th>
              <th style={thStyle}>Semestre</th>
              <th style={thStyle}>Estado</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {torneos.map(t => (
              <tr key={t.id} style={{ background: t.activo ? 'white' : 'rgba(0,0,0,0.02)' }}>
                <td style={tdStyle}>
                  <span style={{ fontWeight: 600 }}>{t.nombre}</span>
                </td>
                <td style={tdStyle}>
                  {t.semestre}
                </td>
                <td style={tdStyle}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '3px 10px',
                    borderRadius: 99,
                    background: t.activo ? 'rgba(22,163,74,0.12)' : 'rgba(0,0,0,0.07)',
                    color: t.activo ? 'var(--color-success)' : 'var(--color-muted)',
                  }}>
                    {t.activo ? '🟢 Abierto' : '⚫ Cerrado'}
                  </span>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <Link
                      to={`/admin/torneo/${t.id}/comidas-historico`}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 12 }}
                    >
                      📋 Histórico
                    </Link>
                    <Link
                      to={`/admin/torneo/${t.id}/votacion`}
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: 12 }}
                    >
                      📊 Ver votación
                    </Link>
                    <Link
                      to={`/admin/torneo/${t.id}/comida-config`}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 12 }}
                    >
                      ⚙ Configurar
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {torneos.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>
                  No hay torneos creados aún.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

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
  padding: '10px 12px',
  borderBottom: '1px solid var(--color-border)',
  fontSize: 13,
  verticalAlign: 'middle',
}
