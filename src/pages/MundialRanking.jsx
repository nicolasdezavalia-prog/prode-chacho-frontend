/**
 * MundialRanking — Fase 3
 *
 * Página pública /mundial/:torneoId/ranking. Tabla con posición / usuario /
 * puntos / aciertos. Si el backend devuelve `visible: false`, mostramos un
 * mensaje contextual (no la tabla) según el `motivo`.
 *
 * Sin filtros, sin paginación, sin detalle por usuario — MVP.
 */

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/index.js'
import { useAuth } from '../App.jsx'
import MundialIcon from '../components/MundialIcon.jsx'

const MOTIVO_MSG = {
  estado_no_apto: 'El ranking se publica a partir del estado "Grupos jugados".',
  sin_resultados: 'Todavía no hay resultados cargados. El ranking aparece cuando el admin carga el primer resultado.',
}

export default function MundialRanking() {
  const { torneoId } = useParams()
  const { user }     = useAuth()
  const [torneo, setTorneo]   = useState(null)
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => { load() /* eslint-disable-next-line */ }, [torneoId])

  async function load() {
    setLoading(true); setError('')
    try {
      const [torneos, rk] = await Promise.all([
        api.getMundialTorneos(),
        api.getMundialRanking(torneoId),
      ])
      const t = (torneos || []).find(x => x.id === parseInt(torneoId, 10))
      if (!t) throw new Error('Torneo Mundial no encontrado')
      setTorneo(t)
      setData(rk)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading">Cargando ranking...</div>
  if (error)   return <div className="error-msg" style={{ margin: 24 }}>{error}</div>

  const visible = data?.visible === true
  const ranking = Array.isArray(data?.ranking) ? data.ranking : []

  return (
    <div style={{ maxWidth: 760, margin: '24px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <MundialIcon width={60} height={42} />
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
            Ranking — {torneo?.nombre}
          </h1>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
            {visible && (
              <>
                <strong>{data.preguntas_con_resultado}</strong> de{' '}
                <strong>{data.total_preguntas}</strong> preguntas con resultado cargado
              </>
            )}
          </div>
        </div>
        <Link to={`/mundial/${torneoId}`} className="btn btn-secondary btn-sm">
          ← Mis respuestas
        </Link>
      </div>

      {!visible && (
        <div style={{
          padding: '16px 18px', textAlign: 'center',
          background: 'rgba(0,0,0,0.04)', color: 'var(--color-muted)',
          borderRadius: 8, fontSize: 14, lineHeight: 1.5,
        }}>
          ⏳ {MOTIVO_MSG[data?.motivo] || `Ranking no disponible (motivo: ${data?.motivo || 'desconocido'}).`}
        </div>
      )}

      {visible && ranking.length === 0 && (
        <div style={{
          padding: '16px 18px', textAlign: 'center',
          background: 'rgba(0,0,0,0.04)', color: 'var(--color-muted)',
          borderRadius: 8, fontSize: 14,
        }}>
          Hay resultados cargados pero todavía nadie respondió en este torneo.
        </div>
      )}

      {visible && ranking.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'var(--color-surface2)' }}>
                <th style={th}>#</th>
                <th style={th}>Usuario</th>
                <th style={{ ...th, textAlign: 'right' }}>Puntos</th>
                <th style={{ ...th, textAlign: 'right' }}>Aciertos</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map(r => {
                const esYo = user && r.user_id === user.id
                return (
                  <tr
                    key={r.user_id}
                    style={{
                      background: esYo ? 'rgba(59,130,246,0.07)' : 'transparent',
                      fontWeight: esYo ? 600 : 400,
                    }}
                  >
                    <td style={{ ...td, fontWeight: 700, color: r.posicion === 1 ? 'var(--color-primary)' : 'var(--color-text)' }}>
                      {r.posicion}
                    </td>
                    <td style={td}>
                      {r.nombre || `Usuario ${r.user_id}`}
                      {esYo && <span style={{ fontSize: 11, color: 'var(--color-muted)', marginLeft: 6 }}>(vos)</span>}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <strong>{r.puntos_totales}</strong>
                    </td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--color-muted)' }}>
                      {r.aciertos}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const th = {
  padding: '10px 12px', textAlign: 'left',
  fontSize: 11, fontWeight: 700, color: 'var(--color-muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '1px solid var(--color-border)',
}
const td = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--color-border)',
}
