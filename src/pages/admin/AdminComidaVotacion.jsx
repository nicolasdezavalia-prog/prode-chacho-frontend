import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../../api/index.js'

const MESES_NOMBRES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export default function AdminComidaVotacion() {
  const { torneoId } = useParams()
  const hoy = new Date()

  const [torneo,   setTorneo]   = useState(null)
  const [mes,      setMes]      = useState(hoy.getMonth() + 1)
  const [anio,     setAnio]     = useState(hoy.getFullYear())
  const [comida,   setComida]   = useState(undefined)   // undefined=cargando, null=no existe
  const [status,   setStatus]   = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [cerrando, setCerrando] = useState(false)

  // Cargar nombre del torneo
  useEffect(() => {
    api.getTorneo(parseInt(torneoId))
      .then(setTorneo)
      .catch(() => {})
  }, [torneoId])

  // Cargar comida y status cuando cambia mes/año
  useEffect(() => {
    load()
  }, [torneoId, mes, anio])

  const load = async () => {
    setLoading(true)
    setError('')
    setComida(undefined)
    setStatus(null)
    try {
      const c = await api.getComida(parseInt(torneoId), mes, anio)
      setComida(c || null)
      if (c?.id) {
        const s = await api.getVotacionStatus(c.id)
        setStatus(s)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCerrar = async () => {
    if (!comida?.id) return
    if (!confirm('¿Cerrar la votación? Los participantes no podrán modificar su voto.')) return
    setCerrando(true)
    try {
      await api.cerrarVotacion(comida.id)
      // Refrescar status
      const s = await api.getVotacionStatus(comida.id)
      setStatus(s)
    } catch (err) {
      setError(err.message)
    } finally {
      setCerrando(false)
    }
  }

  const organizador = status?.detalle?.filter(d => d.es_organizador) || []
  const jugadores   = status?.detalle?.filter(d => d.tipo === 'jugador' && !d.es_organizador) || []
  const invitados   = status?.detalle?.filter(d => d.tipo === 'invitado' && !d.es_organizador) || []

  return (
    <div style={{ maxWidth: 600 }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 16, display: 'flex', gap: 6, alignItems: 'center' }}>
        <Link to="/admin/comidas" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>Comidas</Link>
        <span>›</span>
        <span>{torneo?.nombre || `Torneo ${torneoId}`}</span>
        <span>›</span>
        <span>Estado votación</span>
      </div>

      <div className="flex-between mb-16">
        <div className="page-title">🗳️ Estado de votación</div>
      </div>

      {torneo && (
        <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 20 }}>
          Torneo: <strong>{torneo.nombre}</strong> · {torneo.semestre}
        </div>
      )}

      {/* Selector de mes/año */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600 }}>Mes</label>
            <select
              value={mes}
              onChange={e => setMes(Number(e.target.value))}
              style={{ fontSize: 13, padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 4 }}
            >
              {MESES_NOMBRES.slice(1).map((nombre, i) => (
                <option key={i + 1} value={i + 1}>{nombre}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600 }}>Año</label>
            <input
              type="number"
              value={anio}
              onChange={e => setAnio(Number(e.target.value))}
              style={{ width: 80, fontSize: 13, padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 4 }}
            />
          </div>
        </div>
      </div>

      {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}

      {loading && <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>Cargando...</div>}

      {!loading && comida === null && (
        <div className="card">
          <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: 0 }}>
            No hay comida registrada para {MESES_NOMBRES[mes]} {anio}.
          </p>
        </div>
      )}

      {!loading && comida && status && (
        <>
          {/* Resumen */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              Resumen
              {status.estado_votacion === 'cerrada' && (
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 99,
                  background: 'rgba(239,68,68,0.12)', color: 'var(--color-danger)',
                }}>
                  🔒 Votación cerrada
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-success)' }}>
                  {status.votaron}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>Votaron</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-danger)' }}>
                  {status.pendientes}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>Pendientes</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text)' }}>
                  {status.total}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>Total</div>
              </div>
            </div>
          </div>

          {/* Detalle */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">Detalle</div>

            {organizador.length > 0 && (
              <div style={{ marginBottom: (jugadores.length > 0 || invitados.length > 0) ? 16 : 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted)', letterSpacing: 0.5, marginBottom: 8 }}>
                  👑 Organizador
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {organizador.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                      <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>—</span>
                      <span style={{ color: 'var(--color-muted)' }}>{d.nombre}</span>
                      <span style={{ fontSize: 11, color: 'var(--color-muted)', marginLeft: 'auto' }}>no vota (organizador)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {jugadores.length > 0 && (
              <div style={{ marginBottom: invitados.length > 0 ? 16 : 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted)', letterSpacing: 0.5, marginBottom: 8 }}>
                  🎮 Jugadores
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {jugadores.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                      <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>
                        {d.voto_completo ? '✔' : '❌'}
                      </span>
                      <span style={{ color: d.voto_completo ? 'var(--color-text)' : 'var(--color-muted)' }}>
                        {d.nombre}
                      </span>
                      {!d.voto_completo && (
                        <span style={{ fontSize: 11, color: 'var(--color-muted)', marginLeft: 'auto' }}>pendiente</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {invitados.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted)', letterSpacing: 0.5, marginBottom: 8 }}>
                  👤 Invitados
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {invitados.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                      <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>—</span>
                      <span style={{ color: 'var(--color-muted)' }}>{d.nombre}</span>
                      <span style={{ fontSize: 11, color: 'var(--color-muted)', marginLeft: 'auto' }}>no vota online</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {status.total === 0 && (
              <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: 0 }}>
                No hay participantes con derecho a voto.
              </p>
            )}
          </div>

          {/* Acciones */}
          <div style={{ display: 'flex', gap: 10 }}>
            {status.estado_votacion !== 'cerrada' && (
              <button
                className="btn btn-danger btn-sm"
                onClick={handleCerrar}
                disabled={cerrando}
                style={{ fontSize: 13 }}
              >
                {cerrando ? 'Cerrando...' : '🔒 Cerrar votación'}
              </button>
            )}
            <Link to="/admin/comidas" className="btn btn-secondary" style={{ fontSize: 13 }}>
              Volver
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
