import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/index.js'
import { useAuth } from '../App.jsx'
import ComidaMensualCard from '../components/ComidaMensualCard.jsx'

const MESES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export default function Comidas() {
  const { user } = useAuth()

  const [torneos,      setTorneos]      = useState([])
  const [torneoActivo, setTorneoActivo] = useState(null)
  const [comidas,      setComidas]      = useState([])
  const [loadingBase,  setLoadingBase]  = useState(true)
  const [loadingList,  setLoadingList]  = useState(false)
  const [error,        setError]        = useState('')

  // Cargar torneos al montar
  useEffect(() => {
    api.getTorneos()
      .then(ts => {
        setTorneos(ts)
        const activo = ts.find(t => t.activo) || ts[0] || null
        setTorneoActivo(activo)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoadingBase(false))
  }, [])

  // Cargar comidas cuando cambia el torneo seleccionado
  useEffect(() => {
    if (!torneoActivo) { setComidas([]); return }
    setLoadingList(true)
    setError('')
    api.getComidaLista(torneoActivo.id)
      .then(data => setComidas(Array.isArray(data) ? data : []))
      .catch(err => setError(err.message))
      .finally(() => setLoadingList(false))
  }, [torneoActivo?.id])

  if (loadingBase) {
    return <div className="loading">Cargando...</div>
  }

  const loading = loadingList

  return (
    <div style={{ maxWidth: 700 }}>

      {/* ——— Header ——— */}
      <div style={{ marginBottom: 24 }}>
        <div className="page-title" style={{ marginBottom: 6 }}>🍕 Comidas</div>

        {torneoActivo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>
              {torneoActivo.nombre} · {torneoActivo.semestre}
            </span>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 9px',
              borderRadius: 99,
              background: torneoActivo.activo
                ? 'rgba(22,163,74,0.12)'
                : 'rgba(0,0,0,0.07)',
              color: torneoActivo.activo
                ? 'var(--color-success)'
                : 'var(--color-muted)',
            }}>
              {torneoActivo.activo ? '🟢 En curso' : '⚫ Cerrado'}
            </span>
          </div>
        )}

        {/* Selector de torneo si hay más de uno */}
        {torneos.length > 1 && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600 }}>
              Torneo:
            </label>
            <select
              value={torneoActivo?.id ?? ''}
              onChange={e => {
                const t = torneos.find(t => t.id === parseInt(e.target.value))
                setTorneoActivo(t || null)
              }}
              style={{
                fontSize: 13,
                padding: '4px 10px',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
              }}
            >
              {torneos.map(t => (
                <option key={t.id} value={t.id}>
                  {t.nombre} {t.activo ? '(activo)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ——— Error ——— */}
      {error && (
        <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>
      )}

      {/* ——— Loading comidas ——— */}
      {loading && (
        <div style={{ fontSize: 13, color: 'var(--color-muted)', padding: '20px 0' }}>
          Cargando comidas...
        </div>
      )}

      {/* ——— Sin torneo ——— */}
      {!loading && !torneoActivo && (
        <div className="card">
          <p style={{ color: 'var(--color-muted)', fontSize: 13, margin: 0 }}>
            No hay torneos disponibles.
          </p>
        </div>
      )}

      {/* ——— Sin comidas ——— */}
      {!loading && torneoActivo && comidas.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🍽️</div>
          <p style={{ color: 'var(--color-muted)', fontSize: 14, margin: 0, fontWeight: 500 }}>
            No hay comidas registradas en este torneo todavía.
          </p>
        </div>
      )}

      {/* ——— Lista de cards ——— */}
      {!loading && torneoActivo && comidas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {comidas.map(c => (
            <div key={c.id}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                <Link
                  to={`/comidas/${c.id}`}
                  style={{ fontSize: 12, color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}
                >
                  Ver detalle →
                </Link>
              </div>
              <ComidaMensualCard
                torneoId={torneoActivo.id}
                mes={c.mes}
                anio={c.anio}
                jugadores={[]}
                puedeEditar={false}
                organizadorSugerido={null}
              />
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
