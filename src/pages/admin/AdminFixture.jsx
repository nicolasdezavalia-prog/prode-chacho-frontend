import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../../api/index.js'

export default function AdminFixture() {
  const { fechaId } = useParams()
  const [fecha, setFecha] = useState(null)
  const [jugadores, setJugadores] = useState([])
  const [cruces, setCruces] = useState([])
  const [disponibles, setDisponibles] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadData()
  }, [fechaId])

  const loadData = async () => {
    try {
      const f = await api.getFecha(fechaId)
      setFecha(f)

      // Jugadores del torneo
      const torneo = await api.getTorneo(f.torneo_id)
      setJugadores(torneo.jugadores || [])

      // Cruces existentes
      try {
        const cs = await api.getCruces(fechaId)
        setCruces(cs.map(c => ({ user1_id: c.user1_id, user2_id: c.user2_id, u1: c.user1_nombre, u2: c.user2_nombre })))
        const usadosIds = cs.flatMap(c => [c.user1_id, c.user2_id])
        setDisponibles((torneo.jugadores || []).filter(j => !usadosIds.includes(j.id)))
      } catch (_) {
        setDisponibles(torneo.jugadores || [])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const agregarCruce = () => {
    setCruces(prev => [...prev, { user1_id: '', user2_id: '', u1: '', u2: '' }])
  }

  const updateCruce = (idx, campo, valor) => {
    setCruces(prev => {
      const next = [...prev]
      const jugador = jugadores.find(j => j.id === parseInt(valor))
      next[idx] = {
        ...next[idx],
        [campo]: parseInt(valor),
        [campo === 'user1_id' ? 'u1' : 'u2']: jugador?.nombre || ''
      }
      return next
    })
  }

  const eliminarCruce = (idx) => {
    setCruces(prev => prev.filter((_, i) => i !== idx))
  }

  const handleGuardar = async () => {
    // Validar
    const validos = cruces.filter(c => c.user1_id && c.user2_id && c.user1_id !== c.user2_id)
    const todosIds = validos.flatMap(c => [c.user1_id, c.user2_id])
    const uniqueIds = new Set(todosIds)
    if (uniqueIds.size !== todosIds.length) {
      setError('Un jugador no puede aparecer en más de un cruce')
      return
    }

    setSaving(true)
    setError('')
    try {
      await api.setFixture(fechaId, validos.map(c => ({ user1_id: c.user1_id, user2_id: c.user2_id })))
      setSuccess('Fixture guardado correctamente')
      loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Jugadores ya usados en cruces actuales
  const usadosIds = new Set(cruces.flatMap(c => [c.user1_id, c.user2_id].filter(Boolean)))

  if (loading) return <div className="loading">Cargando...</div>

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <Link to={`/admin/fecha/${fechaId}`} className="text-muted" style={{fontSize: 13, textDecoration: 'none'}}>
            ← Volver a la fecha
          </Link>
          <div className="page-title" style={{marginTop: 4}}>
            Fixture de Cruces: {fecha?.nombre}
          </div>
          <p className="text-muted" style={{fontSize: 12}}>
            Definí quién enfrenta a quién en esta fecha
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleGuardar} disabled={saving}>
          {saving ? 'Guardando...' : '💾 Guardar fixture'}
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {success && <div className="success-msg">{success}</div>}

      <div className="card">
        <div className="card-header">
          Cruces ({cruces.length} definidos)
          <button className="btn btn-secondary btn-sm" onClick={agregarCruce}>
            + Agregar cruce
          </button>
        </div>

        {cruces.length === 0 ? (
          <div style={{textAlign: 'center', padding: '24px 0'}}>
            <p className="text-muted" style={{marginBottom: 12}}>No hay cruces definidos</p>
            <button className="btn btn-primary" onClick={agregarCruce}>
              + Agregar primer cruce
            </button>
          </div>
        ) : (
          <div>
            {cruces.map((cruce, idx) => (
              <div key={idx} style={{
                display: 'grid',
                gridTemplateColumns: '1fr 40px 1fr 40px',
                gap: 12,
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: '1px solid var(--color-border)'
              }}>
                <select
                  value={cruce.user1_id || ''}
                  onChange={e => updateCruce(idx, 'user1_id', e.target.value)}
                  style={{padding: '7px 10px'}}
                >
                  <option value="">Jugador 1...</option>
                  {jugadores
                    .filter(j => !usadosIds.has(j.id) || j.id === cruce.user1_id)
                    .map(j => (
                      <option key={j.id} value={j.id}>{j.nombre}</option>
                    ))
                  }
                </select>

                <div style={{textAlign: 'center', fontWeight: 700, color: 'var(--color-muted)'}}>
                  vs
                </div>

                <select
                  value={cruce.user2_id || ''}
                  onChange={e => updateCruce(idx, 'user2_id', e.target.value)}
                  style={{padding: '7px 10px'}}
                >
                  <option value="">Jugador 2...</option>
                  {jugadores
                    .filter(j => (!usadosIds.has(j.id) || j.id === cruce.user2_id) && j.id !== cruce.user1_id)
                    .map(j => (
                      <option key={j.id} value={j.id}>{j.nombre}</option>
                    ))
                  }
                </select>

                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => eliminarCruce(idx)}
                  style={{padding: '6px 10px'}}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Jugadores sin cruce */}
        {jugadores.length > 0 && (
          <div style={{marginTop: 16, padding: '12px', background: 'var(--color-surface2)', borderRadius: 'var(--radius)'}}>
            <div style={{fontSize: 12, color: 'var(--color-muted)', marginBottom: 6}}>
              Jugadores sin cruce asignado:
            </div>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 6}}>
              {jugadores
                .filter(j => !usadosIds.has(j.id))
                .map(j => (
                  <span key={j.id} className="badge badge-borrador">{j.nombre}</span>
                ))
              }
              {jugadores.filter(j => !usadosIds.has(j.id)).length === 0 && (
                <span className="text-success" style={{fontSize: 12}}>✅ Todos los jugadores tienen cruce asignado</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
