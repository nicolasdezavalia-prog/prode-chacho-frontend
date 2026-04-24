import { useNavigate } from 'react-router-dom'

const cards = [
  {
    icon: '🏆',
    title: 'Torneos',
    description: 'Gestionar torneos y, dentro de cada torneo, sus fechas, resultados y Gran DT.',
    to: '/admin/torneo',
    enabled: true,
  },
  {
    icon: '📋',
    title: 'Cargar resultados',
    description: 'Cargar resultados de bloques y puntajes GDT de fechas en disputa.',
    to: '/admin/resultados',
    enabled: true,
  },
  {
    icon: '🔑',
    title: 'Permisos',
    description: 'Administrar roles y permisos de los jugadores.',
    to: '/admin/permisos',
    enabled: true,
  },
  {
    icon: '💰',
    title: 'Economía',
    description: 'Ver deudas, pagos y estado del pozo.',
    to: '/admin/deudores',
    enabled: true,
  },
  {
    icon: '🍕',
    title: 'Comidas',
    description: 'Gestión de pedidos y comidas grupales. (Próximamente)',
    to: null,
    enabled: false,
  },
]

export default function AdminHub() {
  const navigate = useNavigate()

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
        {cards.map((card) => (
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
