import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api/index.js'
import { useAuth } from '../App.jsx'
import MundialIcon from '../components/MundialIcon.jsx'

/**
 * Portal de selección de juego.
 * - "Prode Chacho" → `/prode` (selector tradicional; auto-redirect a `/` si 1).
 * - "Mundial"      → `/mundial` (auto-redirect si hay 1).
 *
 * Regla UX por usuario (Fase UX juegos):
 *   - Usuario común: solo se muestran las cards a las que tiene acceso.
 *     Si no tiene acceso a ninguna, mensaje claro de "no estás participando".
 *   - Admin/superadmin: siempre ve las dos cards (modo "ver todo"). Si no hay
 *     torneo creado del tipo correspondiente, la card queda con leyenda
 *     "Próximamente" o "Sin torneos creados" pero sigue clickeable hacia el
 *     selector vacío (que muestra el mensaje correspondiente).
 */
export default function GameSelector() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'

  const [mundialTorneos, setMundialTorneos] = useState(null) // null = cargando
  const [errorMundial, setErrorMundial] = useState('')
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
  const cargandoTradi   = tradicionales === null
  const cargando        = cargandoMundial || cargandoTradi

  const hayMundial     = Array.isArray(mundialTorneos) && mundialTorneos.length > 0
  const hayTradicional = Array.isArray(tradicionales)  && tradicionales.length > 0

  // Visibilidad de cards:
  //   - Usuario común: solo si tiene acceso (>= 1 torneo accesible).
  //   - Admin/superadmin: siempre.
  const mostrarMundial = isAdmin || hayMundial
  const mostrarProde   = isAdmin || hayTradicional

  // Mensajes de subtítulo
  let subtituloMundial
  if (cargandoMundial)          subtituloMundial = 'Cargando...'
  else if (errorMundial && !hayMundial) subtituloMundial = 'No se pudo cargar'
  else if (!hayMundial)         subtituloMundial = isAdmin ? 'Sin torneos Mundial creados' : 'Próximamente'
  else if (mundialTorneos.length === 1)
                                subtituloMundial = `${mundialTorneos[0].nombre} — entrar`
  else                          subtituloMundial = `${mundialTorneos.length} torneos disponibles`

  let subtituloProde
  if (cargandoTradi)            subtituloProde = 'Cargando...'
  else if (hayTradicional)      subtituloProde = 'Fechas, cruces, Gran DT, tablas y comidas'
  else                          subtituloProde = isAdmin ? 'Sin torneos tradicionales creados' : 'No estás participando'

  // Si no hay nada que mostrar para un user común → mensaje de "sin juegos".
  if (!cargando && !mostrarMundial && !mostrarProde) {
    return (
      <div style={{ maxWidth: 480, margin: '64px auto', textAlign: 'center', padding: '0 16px' }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>🎮</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
          No estás participando de ningún juego todavía
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
          Pedile al admin que te agregue como participante del torneo correspondiente
          (Prode Chacho o Mundial).
        </p>
        <Link to="/login" className="btn btn-secondary btn-sm">
          ← Volver a login
        </Link>
      </div>
    )
  }

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
        {mostrarProde && (
          <GameCard
            icon="⚽"
            title="Prode Chacho"
            subtitle={subtituloProde}
            enabled={hayTradicional || isAdmin}
            onClick={() => navigate('/prode')}
          />
        )}
        {mostrarMundial && (
          <GameCard
            icon={<MundialIcon width={90} height={60} />}
            title="Mundial"
            subtitle={subtituloMundial}
            enabled={hayMundial || isAdmin}
            onClick={() => navigate('/mundial')}
          />
        )}
      </div>
    </div>
  )
}

function GameCard({ icon, title, subtitle, enabled, onClick }) {
  return (
    <button
      onClick={enabled ? onClick : undefined}
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
