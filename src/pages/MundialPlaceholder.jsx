import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/index.js'
import { useAuth } from '../App.jsx'
import MundialIcon from '../components/MundialIcon.jsx'

/**
 * Placeholder usuario para `/mundial/:torneoId` durante Fase 1.
 * Muestra:
 *   - "Mundial en configuración" (o mensaje específico según estado)
 *   - "Pronto vas a poder cargar tus respuestas"
 *   - Si el usuario es admin/superadmin: botón "Ir al panel de admin Mundial"
 *
 * NO muestra preguntas ni premios cargados (decisión Fase 1).
 * NO permite interacción más allá de la navegación.
 */
const ESTADO_MSG = {
  configuracion:    'Mundial en configuración. Pronto vas a poder cargar tus respuestas.',
  abierto:          'La vista para cargar respuestas todavía no está disponible. Próximamente.',
  cerrado:          'La carga de respuestas está cerrada. Esperá los resultados.',
  grupos_jugados:   'Fase de grupos jugada. Esperá la apertura de ventana de cambios.',
  cambios_abiertos: 'Ventana de cambios abierta para los habilitados.',
  cambios_cerrados: 'Cambios cerrados. Esperá la publicación.',
  resultados:       'Cargando resultados reales. El ranking se publica al finalizar.',
  finalizado:       'Mundial finalizado. El ranking estará disponible próximamente.',
}

const ESTADO_LABEL = {
  configuracion: 'Configuración',
  abierto: 'Abierto',
  cerrado: 'Cerrado',
  grupos_jugados: 'Grupos jugados',
  cambios_abiertos: 'Cambios abiertos',
  cambios_cerrados: 'Cambios cerrados',
  resultados: 'Resultados',
  finalizado: 'Finalizado',
}

export default function MundialPlaceholder() {
  const { torneoId } = useParams()
  const { user } = useAuth()
  const [torneo, setTorneo] = useState(null)
  const [config, setConfig] = useState(null)
  const [error, setError] = useState('')

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'

  useEffect(() => {
    let cancel = false
    async function load() {
      try {
        const [ts, cfg] = await Promise.all([
          api.getMundialTorneos(),
          api.getMundialConfig(torneoId),
        ])
        if (cancel) return
        const t = (ts || []).find(x => x.id === parseInt(torneoId))
        if (!t) throw new Error('Torneo Mundial no encontrado')
        setTorneo(t)
        setConfig(cfg)
      } catch (e) {
        if (!cancel) setError(e.message)
      }
    }
    load()
    return () => { cancel = true }
  }, [torneoId])

  if (error) return <div className="error-msg" style={{ margin: 24 }}>{error}</div>
  if (!torneo || !config) return <div className="loading">Cargando...</div>

  const msg = ESTADO_MSG[config.estado] || 'Mundial en configuración.'

  return (
    <div style={{ maxWidth: 560, margin: '64px auto', textAlign: 'center', padding: '0 16px' }}>
      <div style={{ marginBottom: 16 }}>
        <MundialIcon width={110} height={80} />
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4, color: 'var(--color-text)' }}>
        {torneo.nombre}
      </h1>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
        {torneo.semestre}
      </div>
      <div style={{
        display: 'inline-block',
        fontSize: 12,
        fontWeight: 600,
        padding: '4px 12px',
        background: 'rgba(59,130,246,0.12)',
        color: 'var(--color-primary)',
        borderRadius: 99,
        marginBottom: 20,
      }}>
        Estado: {ESTADO_LABEL[config.estado] || config.estado}
      </div>

      <p style={{
        color: 'var(--color-text-muted)',
        fontSize: 15,
        marginBottom: 28,
        lineHeight: 1.5,
      }}>
        {msg}
      </p>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        {isAdmin && (
          <Link
            to={`/admin/torneo/${torneoId}/mundial`}
            className="btn btn-primary"
          >
            🛠️ Ir al panel de admin Mundial
          </Link>
        )}
        <Link to="/juegos" className="btn btn-secondary">
          ← Volver al selector
        </Link>
      </div>
    </div>
  )
}
