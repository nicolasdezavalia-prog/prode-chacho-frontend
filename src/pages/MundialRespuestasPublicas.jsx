/**
 * MundialRespuestasPublicas — Fase 3.3
 *
 * Vista social: una vez que ya no se puede modificar la planilla, los
 * usuarios pueden ver qué respondió cada participante en cada pregunta.
 *
 * Reglas (lado backend):
 *   - estado='abierto' con deadline NO vencido → visible:false (mensaje fijo).
 *   - estado != 'abierto' OR deadline vencido → visible:true con preguntas[].
 *
 * UI MVP: una sección por pregunta. Dentro de cada pregunta, lista plana
 * "Usuario: respuesta formateada". Para tipos con equipos, intentamos resolver
 * el código contra el catálogo y mostrar "CÓDIGO — Nombre".
 *
 * No expone overrides, ni puntos, ni resultados.
 */

import { useEffect, useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/index.js'
import MundialIcon from '../components/MundialIcon.jsx'

export default function MundialRespuestasPublicas() {
  const { torneoId } = useParams()

  const [torneo, setTorneo]   = useState(null)
  const [data, setData]       = useState(null)
  const [equipos, setEquipos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => { load() /* eslint-disable-next-line */ }, [torneoId])

  async function load() {
    setLoading(true); setError('')
    try {
      const [torneos, publ, cat] = await Promise.all([
        api.getMundialTorneos(),
        api.getMundialRespuestasPublicas(torneoId),
        api.getMundialEquiposCatalogo(torneoId).catch(() => []),
      ])
      const t = (torneos || []).find(x => x.id === parseInt(torneoId, 10))
      if (!t) throw new Error('Torneo Mundial no encontrado')
      setTorneo(t)
      setData(publ)
      setEquipos(Array.isArray(cat) ? cat : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Map { codigo: equipo } para resolver respuestas tipo equipo / multi_equipo.
  const equiposByCodigo = useMemo(() => {
    const m = new Map()
    for (const eq of equipos) m.set(eq.codigo, eq)
    return m
  }, [equipos])

  function fmtEquipo(codigo) {
    if (!codigo || typeof codigo !== 'string') return null
    const eq = equiposByCodigo.get(codigo)
    if (eq) return `${eq.codigo} — ${eq.nombre}`
    return `${codigo} (no en catálogo)`
  }

  // Formatea la respuesta de un user según el tipo. Devuelve string|JSX.
  function fmtRespuesta(tipo, respuestaJsonStr) {
    if (!respuestaJsonStr) return <em style={{ color: 'var(--color-muted)' }}>(sin respuesta)</em>
    let r
    try { r = JSON.parse(respuestaJsonStr) }
    catch { return <em style={{ color: 'var(--color-muted)' }}>(inválido)</em> }
    if (!r || typeof r !== 'object') return <em style={{ color: 'var(--color-muted)' }}>(vacío)</em>

    switch (tipo) {
      case 'opcion_unica':
        return typeof r.opcion === 'string' ? r.opcion : <em style={empty}>(vacío)</em>
      case 'equipo_categoria':
        return fmtEquipo(r.equipo) || <em style={empty}>(vacío)</em>
      case 'instancia_eliminacion':
        return typeof r.instancia === 'string' ? r.instancia : <em style={empty}>(vacío)</em>
      case 'numero_exacto':
      case 'numero_por_banda':
        return Number.isInteger(r.numero) ? String(r.numero) : <em style={empty}>(vacío)</em>
      case 'multi_equipo': {
        const arr = Array.isArray(r.equipos) ? r.equipos : []
        if (arr.length === 0) return <em style={empty}>(vacío)</em>
        return arr.map(fmtEquipo).filter(Boolean).join(', ')
      }
      case 'respuesta_manual':
      case 'regla_especial':
        return (typeof r.texto === 'string' && r.texto.trim() !== '')
          ? r.texto
          : <em style={empty}>(vacío)</em>
      default:
        return <em style={empty}>(tipo no soportado)</em>
    }
  }

  if (loading) return <div className="loading">Cargando respuestas...</div>
  if (error)   return <div className="error-msg" style={{ margin: 24 }}>{error}</div>

  const visible   = data?.visible === true
  const preguntas = Array.isArray(data?.preguntas) ? data.preguntas : []

  return (
    <div style={{ maxWidth: 760, margin: '24px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <MundialIcon width={60} height={42} />
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
            Respuestas de participantes — {torneo?.nombre}
          </h1>
          {visible && (
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
              <strong>{preguntas.length}</strong> pregunta{preguntas.length !== 1 ? 's' : ''} activa{preguntas.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        <Link to={`/mundial/${torneoId}`} className="btn btn-secondary btn-sm">
          ← Mis respuestas
        </Link>
      </div>

      {!visible && (
        <div style={{
          padding: '16px 18px', textAlign: 'center',
          background: 'rgba(234,179,8,0.12)', color: '#a16207',
          borderRadius: 8, fontSize: 14, lineHeight: 1.5,
          border: '1px solid rgba(234,179,8,0.30)',
        }}>
          ⏳ {data?.mensaje || 'Las respuestas de otros participantes estarán disponibles cuando cierre la carga.'}
        </div>
      )}

      {visible && preguntas.length === 0 && (
        <div style={{
          padding: '16px 18px', textAlign: 'center',
          background: 'rgba(0,0,0,0.04)', color: 'var(--color-muted)',
          borderRadius: 8, fontSize: 14,
        }}>
          No hay preguntas activas en este torneo.
        </div>
      )}

      {visible && preguntas.map(p => (
        <div key={p.id} className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, color: 'var(--color-muted)',
              background: 'rgba(0,0,0,0.06)', borderRadius: 99, padding: '2px 8px',
            }}>
              #{p.numero}
            </span>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, flex: 1 }}>
              {p.enunciado}
            </h3>
            <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
              {p.respuestas.length} respuesta{p.respuestas.length !== 1 ? 's' : ''}
            </span>
          </div>
          {p.respuestas.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--color-muted)', fontStyle: 'italic' }}>
              Nadie respondió esta pregunta.
            </div>
          ) : (
            <ul style={{
              margin: 0, padding: 0, listStyle: 'none',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              {p.respuestas.map(r => (
                <li key={r.user_id} style={{
                  fontSize: 13, lineHeight: 1.45,
                  display: 'flex', gap: 8, alignItems: 'baseline',
                  padding: '4px 0', borderBottom: '1px solid rgba(0,0,0,0.04)',
                }}>
                  <span style={{
                    fontWeight: 600, color: 'var(--color-text)',
                    minWidth: 120, flexShrink: 0,
                  }}>
                    {r.nombre || `Usuario ${r.user_id}`}
                  </span>
                  <span style={{ color: 'var(--color-text)' }}>
                    {fmtRespuesta(p.tipo_pregunta, r.respuesta_json)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

const empty = { color: 'var(--color-muted)' }
