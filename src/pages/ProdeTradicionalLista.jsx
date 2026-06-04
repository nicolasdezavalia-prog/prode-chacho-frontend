/**
 * ProdeTradicionalLista — selector de torneos tradicionales accesibles
 * (análogo a MundialLista pero para tipo distinto de 'mundial_preguntas').
 *
 * Reglas:
 *   - 0 torneos: mensaje "No estás participando" + link a /juegos.
 *   - 1 torneo:  auto-redirect a `/` (Home toma el activo/primero).
 *                  Cuando Home soporte ?torneo=:id, podemos pasar el contexto.
 *   - N torneos: tarjetas seleccionables. Por ahora todas linkean a `/` también.
 *
 * Backend ya filtra `getTorneos()` por torneo_jugadores (Fase preprod acceso).
 * Acá filtramos también por `tipo !== 'mundial_preguntas'` para quedarnos
 * solo con tradicionales.
 */

import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api/index.js'

export default function ProdeTradicionalLista() {
  const navigate = useNavigate()
  const [torneos, setTorneos] = useState(null) // null = cargando
  const [error, setError]     = useState('')

  useEffect(() => {
    let cancel = false
    api.getTorneos()
      .then(ts => {
        if (cancel) return
        const tradicionales = (Array.isArray(ts) ? ts : []).filter(t => t.tipo !== 'mundial_preguntas')
        setTorneos(tradicionales)
        if (tradicionales.length === 1) {
          // Auto-redirect a Home; Home agarra el activo/primero — alineado.
          navigate('/', { replace: true })
        }
      })
      .catch(e => { if (!cancel) setError(e.message) })
    return () => { cancel = true }
  }, [navigate])

  if (error)   return <div className="error-msg" style={{ margin: 24 }}>{error}</div>
  if (torneos === null) return <div className="loading">Cargando...</div>

  if (torneos.length === 0) {
    return (
      <div style={{ maxWidth: 480, margin: '64px auto', textAlign: 'center', padding: '0 16px' }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>⚽</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
          No estás participando de ningún torneo
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

  // N (>= 2) torneos: lista de tarjetas. Click → '/' por ahora (Home agarra el
  // activo/primero). Si más adelante Home soporta ?torneo=:id, pasamos el id.
  return (
    <div style={{ maxWidth: 760, margin: '48px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: 'var(--color-text)' }}>
        Torneos Prode Chacho
      </h1>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 12,
      }}>
        {torneos.map(t => (
          <Link
            key={t.id}
            to={`/?torneo=${t.id}`}
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
