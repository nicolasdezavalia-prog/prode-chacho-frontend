import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/index.js'
import { useAuth } from '../App.jsx'
import MundialIcon from '../components/MundialIcon.jsx'

/**
 * Portal de selección de juego.
 * - "Prode Chacho" → `/` (Home actual, sin cambios).
 * - "Mundial"      → `/mundial` (lista; auto-redirect si hay solo uno).
 *                    Si no hay torneo Mundial, la tarjeta queda deshabilitada
 *                    con leyenda "Próximamente".
 *
 * En Fase 1 esta página es opt-in (accesible vía link "Juegos" del navbar).
 * No reemplaza `/`.
 */
export default function GameSelector() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'

  const [mundialTorneos, setMundialTorneos] = useState(null) // null = cargando
  const [errorMundial, setErrorMundial] = useState('')

  // Torneos tradicionales (no-Mundial) accesibles al user.
  // Backend ya filtra por torneo_jugadores (admin/superadmin ve todo).
  // null = cargando.
  const [tradicionales, setTradicionales] = useState(null)

  useEffect(() => {
    let cancel = false
    api.getMundialTorneos()
      .then(ts => { if (!cancel) setMundialTorneos(Array.isArray(ts) ? ts : []) })
      .catch(e => { if (!cancel) { setMundialTorneos([]); setErrorMundial(e.message) } })
    api.getTorneos()
      .then(ts => {
        if (cancel) return
        const tradi = (Array.isArray(ts) ? ts : []).filter(t => t.tipo !== 'mundial_preguntas')
        setTradicionales(tradi)
      })
      .catch(() => { if (!cancel) setTradicionales([]) })
    return () => { cancel = true }
  }, [])

  const cargandoMundial = mundialTorneos === null
  const hayMundial = Array.isArray(mundialTorneos) && mundialTorneos.length > 0

  let subtituloMundial
  if (cargandoMundial)        subtituloMundial = 'Cargando...'
  else if (errorMundial)      subtituloMundial = 'No se pudo cargar'
  else if (!hayMundial)       subtituloMundial = 'Próximamente'
  else if (mundialTorneos.length === 1)
                              subtituloMundial = `${mundialTorneos[0].nombre} — entrar`
  else                        subtituloMundial = `${mundialTorneos.length} torneos disponibles`

  // Card "Prode Chacho": activa si admin/superadmin (bypass) o si el user
  // tiene al menos un torneo tradicional accesible. Sino, deshabilitada con
  // mensaje "No estás participando".
  const cargandoTradi = tradicionales === null
  const hayTradicional = Array.isArray(tradicionales) && tradicionales.length > 0
  const verProde = isAdmin || hayTradicional

  let subtituloProde
  if (cargandoTradi)          subtituloProde = 'Cargando...'
  else if (verProde)          subtituloProde = 'Fechas, cruces, Gran DT, tablas y comidas'
  else                        subtituloProde = 'No estás participando'

  return (
    <div style={{ maxWidth: 760, margin: '48px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8, color: 'var(--color-text)' }}>
        ¿Qué querés jugar?
      </h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 36, fontSize: 14 }}>
        Elegí el juego al que querés entrar.
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16,
      }}>
        <GameCard
          icon="⚽"
          title="Prode Chacho"
          subtitle={subtituloProde}
          enabled={verProde}
          onClick={() => verProde && navigate('/')}
        />
        <GameCard
          icon={<MundialIcon width={90} height={60} />}
          title="Mundial"
          subtitle={subtituloMundial}
          enabled={hayMundial}
          onClick={() => hayMundial && navigate('/mundial')}
        />
      </div>
    </div>
  )
}

function GameCard({ icon, title, subtitle, enabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={!enabled}
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: '28px 24px',
        textAlign: 'left',
        cursor: enabled ? 'pointer' : 'default',
        opacity: enabled ? 1 : 0.55,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
      onMouseEnter={e => {
        if (enabled) {
          e.currentTarget.style.borderColor = 'var(--color-primary)'
          e.currentTarget.style.boxShadow = '0 0 0 1px var(--color-primary)'
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--color-border)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {typeof icon === 'string'
        ? <span style={{ fontSize: 40, lineHeight: 1 }}>{icon}</span>
        : icon}
      <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text)' }}>
        {title}
      </span>
      <span style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
        {subtitle}
      </span>
    </button>
  )
}
