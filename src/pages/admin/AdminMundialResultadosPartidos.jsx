/**
 * AdminMundialResultadosPartidos — acceso "Cargar resultados" para el Mundial.
 *
 * Página /admin/mundial/:torneoId/resultados-partidos, linkeada desde el hub
 * 📋 Cargar resultados. Reutiliza la grilla del Fixture en modo 'resultados':
 * muestra SOLO los partidos ya cargados en la solapa Fixture, para completar
 * goles, tarjetas y estado. Sin alta, sin seed, sin borrado (eso vive en
 * Admin → Mundial → 📅 Fixture). Mismo guardado bulk de siempre.
 *
 * Esto NO toca scoring/ranking: cargar partidos solo alimenta Datos útiles y
 * sugerencias; los puntos se mueven únicamente en Resultados con preview.
 */

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/index.js'
import AdminMundialFixture from './AdminMundialFixture.jsx'
import MundialIcon from '../../components/MundialIcon.jsx'

export default function AdminMundialResultadosPartidos() {
  const { torneoId } = useParams()
  const [torneo, setTorneo] = useState(null)
  const [error, setError]   = useState('')

  useEffect(() => {
    api.getMundialTorneos()
      .then(ts => {
        const t = (ts || []).find(x => x.id === parseInt(torneoId, 10))
        if (!t) setError('Torneo Mundial no encontrado')
        else setTorneo(t)
      })
      .catch(e => setError(e.message))
  }, [torneoId])

  if (error) return <div className="error-msg" style={{ margin: 24 }}>{error}</div>

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
        <Link to="/admin" style={{ color: 'var(--color-muted)', textDecoration: 'none' }}>Admin</Link>
        <span>›</span>
        <Link to="/admin/resultados" style={{ color: 'var(--color-muted)', textDecoration: 'none' }}>Cargar resultados</Link>
        <span>›</span>
        <span style={{ color: 'var(--color-text)' }}>{torneo?.nombre || 'Mundial'}</span>
      </div>

      <div className="flex-between mb-16">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <MundialIcon width={48} height={34} />
          <div>
            <div className="page-title">⚽ Resultados de partidos — {torneo?.nombre || 'Mundial'}</div>
            <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 4 }}>
              Solo los partidos ya cargados en el Fixture. Completá goles, tarjetas y estado.
              Para agregar o borrar partidos: Admin Mundial → 📅 Fixture.
            </div>
          </div>
        </div>
        <Link
          to={`/admin/torneo/${torneoId}/mundial`}
          className="btn btn-secondary btn-sm"
          style={{ fontSize: 12 }}
        >
          🏆 Admin Mundial
        </Link>
      </div>

      <AdminMundialFixture torneoId={torneoId} modo="resultados" />
    </div>
  )
}
