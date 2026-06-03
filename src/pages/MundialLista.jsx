import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api/index.js'
import MundialIcon from '../components/MundialIcon.jsx'

/**
 * Lista de torneos Mundial.
 * - 0 torneos: mensaje "No hay Mundial activo aún" + link al selector.
 * - 1 torneo:  auto-redirect a `/mundial/:id`.
 * - N torneos: tarjetas seleccionables.
 *
 * En Fase 1 esta página existe como puente al placeholder.
 */
export default function MundialLista() {
  const navigate = useNavigate()
  const [torneos, setTorneos] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancel = false
    api.getMundialTorneos()
      .then(ts => {
        if (cancel) return
        const arr = Array.isArray(ts) ? ts : []
        setTorneos(arr)
        if (arr.length === 1) {
          navigate(`/mundial/${arr[0].id}`, { replace: true })
        }
      })
      .catch(e => { if (!cancel) setError(e.message) })
    return () => { cancel = true }
  }, [navigate])

  if (error) return <div className="error-msg" style={{ margin: 24 }}>{error}</div>
  if (torneos === null) return <div className="loading">Cargando...</div>

  if (torneos.length === 0) {
    // Lista vacía puede significar:
    //   (a) no hay Mundial creado todavía, o
    //   (b) sí hay Mundial pero el usuario no está asignado como participante.
    // El backend filtra por torneo_jugadores, así que no podemos distinguir
    // (a) de (b) sin endpoint extra. Mensaje genérico que cubre ambos casos.
    return (
      <div style={{ maxWidth: 480, margin: '64px auto', textAlign: 'center', padding: '0 16px' }}>
        <div style={{ marginBottom: 12 }}>
          <MundialIcon size={56} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
          No estás participando de ningún Mundial
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
          Si pensás que esto es un error, pedile al admin que te agregue como
          participante del torneo correspondiente.
        </p>
        <Link to="/juegos" className="btn btn-secondary btn-sm">
          ← Volver al selector
        </Link>
      </div>
    )
  }

  // 2 o más torneos: lista de tarjetas
  return (
    <div style={{ maxWidth: 760, margin: '48px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: 'var(--color-text)' }}>
        Torneos Mundial
      </h1>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 12,
      }}>
        {torneos.map(t => (
          <Link
            key={t.id}
            to={`/mundial/${t.id}`}
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              padding: '20px',
              textDecoration: 'none',
              color: 'var(--color-text)',
              display: 'block',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--color-primary)'
              e.currentTarget.style.boxShadow = '0 0 0 1px var(--color-primary)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--color-border)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{t.nombre}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {t.semestre}{t.activo === 0 ? ' • cerrado' : ''}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
