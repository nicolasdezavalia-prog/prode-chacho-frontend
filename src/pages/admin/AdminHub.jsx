import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../App.jsx'
import { api } from '../../api/index.js'
import MundialIcon from '../../components/MundialIcon.jsx'

const BASE_CARDS = [
  {
    icon: '🏆',
    title: 'Torneos',
    description: 'Gestionar torneos y, dentro de cada torneo, sus fechas, resultados y Gran DT.',
    to: '/admin/torneo',
    enabled: true,
    superadminOnly: false,
  },
  {
    icon: '📋',
    title: 'Cargar resultados',
    description: 'Cargar resultados de bloques y puntajes GDT de fechas en disputa.',
    to: '/admin/resultados',
    enabled: true,
    superadminOnly: false,
  },
  {
    icon: '🍕',
    title: 'Comidas',
    description: 'Gestionar configuración de comidas y votaciones por torneo.',
    to: '/admin/comidas',
    enabled: true,
    superadminOnly: false,
  },
  {
    icon: '💰',
    title: 'Economía',
    description: 'Ver deudas, pagos y estado del pozo.',
    to: '/admin/deudores',
    enabled: true,
    superadminOnly: false,
  },
  {
    icon: '🔑',
    title: 'Permisos',
    description: 'Administrar roles y permisos de los jugadores.',
    to: '/admin/permisos',
    enabled: true,
    superadminOnly: true,
  },
]

// Pre-producción: la tarjeta Mundial está oculta en el panel principal para
// evitar duplicidad — la gestión del Mundial vive en Admin → Torneos →
// "Configurar Mundial". Para reactivar la tarjeta, poner este flag en `true`.
// Cuando esté en true, el useEffect de abajo fetchea los torneos Mundial y
// la tarjeta se inserta dinámicamente después de "Torneos".
const SHOW_MUNDIAL_CARD = false

export default function AdminHub() {
  const navigate = useNavigate()
  const { user } = useAuth()
  // Tarjeta Mundial: aparece solo si SHOW_MUNDIAL_CARD=true Y hay >=1 torneo Mundial.
  const [mundialTorneos, setMundialTorneos] = useState([])

  useEffect(() => {
    if (!SHOW_MUNDIAL_CARD) return  // ahorrar el fetch si la tarjeta está oculta
    let cancel = false
    api.getMundialTorneos()
      .then(ts => { if (!cancel) setMundialTorneos(Array.isArray(ts) ? ts : []) })
      .catch(() => { /* sin Mundial → no agregamos la tarjeta */ })
    return () => { cancel = true }
  }, [])

  const cards = [...BASE_CARDS]
  if (SHOW_MUNDIAL_CARD && mundialTorneos.length > 0) {
    // Si hay 1 solo torneo Mundial, link directo a su hub; si hay varios, al listado de torneos.
    const to = mundialTorneos.length === 1
      ? `/admin/torneo/${mundialTorneos[0].id}/mundial`
      : '/admin/torneo'
    // Insertar después de "Torneos" para mantener cercanía visual.
    cards.splice(1, 0, {
      icon: <MundialIcon size={48} />,
      title: 'Mundial',
      description: mundialTorneos.length === 1
        ? `Configurar el torneo Mundial "${mundialTorneos[0].nombre}".`
        : `Gestionar ${mundialTorneos.length} torneos Mundial activos.`,
      to,
      enabled: true,
      superadminOnly: false,
    })
  }
  const visibles = cards.filter(c => !c.superadminOnly || user?.role === 'superadmin')

  return (
    <div style={{ maxWidth: 720, margin: '48px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: 'var(--color-text)' }}>
        Panel de Administración
      </h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 36, fontSize: 14 }}>
        Seleccioná una sección para gestionar.
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
      }}>
        {visibles.map((card) => (
          <button
            key={card.title}
            onClick={() => card.enabled && navigate(card.to)}
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
            {typeof card.icon === 'string'
              ? <span style={{ fontSize: 32 }}>{card.icon}</span>
              : card.icon}
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
