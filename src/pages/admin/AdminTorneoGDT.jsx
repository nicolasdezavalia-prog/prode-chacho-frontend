import { useParams, useNavigate, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { api } from '../../api/index.js'

// `requiereLiga: true` indica que la card opera sobre UNA liga GDT — se navega con ?liga_id=X.
// `requiereLiga: false` (ej. Ligas) navega sin liga_id porque gestiona TODAS las ligas del torneo.
const CARDS = [
  {
    icon: '🏟️',
    title: 'Ligas',
    description: 'Crear y gestionar las ligas GDT de este torneo (Argentina, Brasileirão, etc.).',
    to: null, // construido al vuelo con el torneoId
    enabled: true,
    requiereLiga: false,
    esLigas: true,
  },
  {
    icon: '🏆',
    title: 'Equipos',
    description: 'Ver y gestionar los equipos participantes del Gran DT.',
    to: '/admin/gdt/equipos',
    enabled: true,
    requiereLiga: true,
  },
  {
    icon: '⚽',
    title: 'Jugadores',
    description: 'Administrar el plantel de jugadores disponibles.',
    to: '/admin/gdt/jugadores',
    enabled: true,
    requiereLiga: true,
  },
  {
    icon: '⏳',
    title: 'Pendientes',
    description: 'Revisar transferencias y movimientos pendientes de aprobación.',
    to: '/admin/gdt/pendientes',
    enabled: true,
    requiereLiga: true,
  },
  {
    icon: '🔄',
    title: 'Ventana',
    description: 'Controlar la ventana de transferencias: apertura y cierre.',
    to: '/admin/gdt/ventana',
    enabled: true,
    requiereLiga: true,
  },
  {
    icon: '⚙️',
    title: 'Catálogo',
    description: 'Gestionar el catálogo de jugadores disponibles para el mercado.',
    to: '/admin/gdt/catalogo',
    enabled: true,
    requiereLiga: true,
  },
]

export default function AdminTorneoGDT() {
  const { torneoId } = useParams()
  const navigate = useNavigate()
  const [torneo, setTorneo] = useState(null)
  const [gdtLigas, setGdtLigas] = useState([])
  const [gdtLigaId, setGdtLigaId] = useState('')

  useEffect(() => {
    api.getTorneo(torneoId).then(setTorneo).catch(() => {})
    // Fase 5: ligas filtradas por torneo. El endpoint retorna un array, no { ligas }.
    api.gdtGetLigas(torneoId).then(data => {
      const ligas = Array.isArray(data) ? data : (data?.ligas || [])
      setGdtLigas(ligas)
      // Pre-seleccionar la liga default (o la primera activa)
      const def = ligas.find(l => l.es_default) || ligas[0]
      if (def) setGdtLigaId(String(def.id))
    }).catch(() => {})
  }, [torneoId])

  function navegarCon(card) {
    // Card de "Ligas": va a la gestión per-torneo, sin liga_id.
    if (card.esLigas) {
      navigate(`/admin/torneo/${torneoId}/gdt/ligas`)
      return
    }
    const qs = gdtLigaId ? `?liga_id=${gdtLigaId}` : ''
    navigate(card.to + qs)
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
        <Link to="/admin" style={{ color: 'var(--color-muted)', textDecoration: 'none' }}>Admin</Link>
        <span>›</span>
        <Link to="/admin/torneo" style={{ color: 'var(--color-muted)', textDecoration: 'none' }}>Torneos</Link>
        <span>›</span>
        <span style={{ color: 'var(--color-text)' }}>{torneo?.nombre ?? '...'}</span>
        <span>›</span>
        <span style={{ color: 'var(--color-text)' }}>Gran DT</span>
      </div>

      <div className="flex-between mb-16">
        <div className="page-title">⚽ Gran DT — {torneo?.nombre ?? ''}</div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin/torneo')}>
          ← Volver
        </button>
      </div>

      {/* Selector de liga */}
      {gdtLigas.length > 1 && (
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 13, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
            GDT Liga:
          </label>
          <select
            value={gdtLigaId}
            onChange={e => setGdtLigaId(e.target.value)}
            className="input"
            style={{ width: 'auto', minWidth: 200 }}
          >
            {gdtLigas.map(l => (
              <option key={l.id} value={l.id}>
                {l.es_default ? `★ ${l.nombre}` : l.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 16,
      }}>
        {CARDS.map((card) => (
          <button
            key={card.title}
            onClick={() => card.enabled && navegarCon(card)}
            disabled={!card.enabled}
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              padding: '24px 20px',
              textAlign: 'left',
              cursor: card.enabled ? 'pointer' : 'default',
              opacity: card.enabled ? 1 : 0.5,
              transition: 'border-color 0.15s, box-shadow 0.15s',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
            onMouseEnter={e => {
              if (card.enabled) {
                e.currentTarget.style.borderColor = 'var(--color-primary)'
                e.currentTarget.style.boxShadow = '0 0 0 1px var(--color-primary)'
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--color-border)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <span style={{ fontSize: 32 }}>{card.icon}</span>
            <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-text)' }}>
              {card.title}
            </span>
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
              {card.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
