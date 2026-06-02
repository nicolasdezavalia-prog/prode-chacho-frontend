/**
 * MundialResponder — Fase 2.4
 *
 * Pantalla user para `/mundial/:torneoId`. Reemplaza el placeholder anterior
 * (MundialPlaceholder.jsx — queda como dead code, no se importa más).
 *
 * Comportamiento:
 *   - Si el torneo NO está en estado 'abierto' → muestra un banner contextual
 *     según el estado (mismo espíritu que MundialPlaceholder pero todo en uno).
 *   - Si está 'abierto' pero `deadline_carga` venció → banner de bloqueo.
 *   - Si está 'abierto' y deadline OK → muestra el formulario con las preguntas
 *     activas y permite editar/guardar.
 *
 * Carga en paralelo: torneo + config + preguntas activas + catálogo + mis-respuestas.
 *
 * Guardado: bulk save con botón "💾 Guardar mi planilla" (sin autosave).
 * Solo se mandan respuestas que tienen al menos un campo seteado.
 *
 * Si el user es admin/superadmin, además se muestra un atajo al panel admin Mundial.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/index.js'
import { useAuth } from '../App.jsx'
import MundialIcon from '../components/MundialIcon.jsx'
import MundialRespuestaInput from '../components/MundialRespuestaInput.jsx'

const ESTADO_LABEL = {
  configuracion:    'Configuración',
  abierto:          'Abierto',
  cerrado:          'Cerrado',
  grupos_jugados:   'Grupos jugados',
  cambios_abiertos: 'Cambios abiertos',
  cambios_cerrados: 'Cambios cerrados',
  resultados:       'Resultados',
  finalizado:       'Finalizado',
}

const ESTADO_MSG = {
  configuracion:    'El admin todavía está configurando el torneo. Pronto vas a poder cargar tus respuestas.',
  cerrado:          'La carga de respuestas está cerrada.',
  grupos_jugados:   'Fase de grupos jugada. Esperá la apertura de la ventana de cambios.',
  cambios_abiertos: 'Ventana de cambios abierta (solo para usuarios habilitados).',
  cambios_cerrados: 'Cambios cerrados. Esperá la publicación.',
  resultados:       'Cargando resultados reales. El ranking se publica al finalizar.',
  finalizado:       'Mundial finalizado. El ranking estará disponible pronto.',
}

export default function MundialResponder() {
  const { torneoId } = useParams()
  const { user }     = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'

  const [torneo, setTorneo]                 = useState(null)
  const [config, setConfig]                 = useState(null)
  const [preguntas, setPreguntas]           = useState([])
  const [equiposCatalogo, setEquiposCatalogo] = useState([])
  const [respuestasUsr, setRespuestasUsr]   = useState({}) // { pregunta_id: respuesta_obj }
  const [respuestasOriginal, setRespuestasOriginal] = useState({})
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState('')
  const [info, setInfo]                     = useState('')
  const [saving, setSaving]                 = useState(false)

  useEffect(() => { load() /* eslint-disable-next-line */ }, [torneoId])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [torneosAll, cfg, preg, equipos, misRes] = await Promise.all([
        api.getMundialTorneos(),
        api.getMundialConfig(torneoId),
        api.getMundialPreguntasActivas(torneoId),
        api.getMundialEquiposCatalogo(torneoId).catch(() => []),
        api.getMundialMisRespuestas(torneoId).catch(() => []),
      ])
      const t = (torneosAll || []).find(x => x.id === parseInt(torneoId, 10))
      if (!t) throw new Error('Torneo Mundial no encontrado')
      setTorneo(t)
      setConfig(cfg)
      setPreguntas(Array.isArray(preg) ? preg : [])
      setEquiposCatalogo(Array.isArray(equipos) ? equipos : [])

      // Parsear las respuestas guardadas a objetos
      const mapRes = {}
      for (const r of (misRes || [])) {
        try { mapRes[r.pregunta_id] = JSON.parse(r.respuesta_json) }
        catch { /* ignorar respuestas malformadas */ }
      }
      setRespuestasUsr(mapRes)
      setRespuestasOriginal(JSON.parse(JSON.stringify(mapRes)))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const estado    = config?.estado || 'configuracion'
  const deadline  = config?.deadline_carga ? new Date(config.deadline_carga) : null
  const deadlineVencido = deadline && !isNaN(deadline.getTime()) && new Date() > deadline
  const cargaAbierta    = estado === 'abierto' && !deadlineVencido

  const respondidas = useMemo(() => {
    return Object.values(respuestasUsr).filter(r => r && Object.keys(r).length > 0).length
  }, [respuestasUsr])
  const total = preguntas.length

  const isDirty = useMemo(() => {
    return JSON.stringify(respuestasUsr) !== JSON.stringify(respuestasOriginal)
  }, [respuestasUsr, respuestasOriginal])

  function handleChange(preguntaId, nuevaRespuesta) {
    setRespuestasUsr(prev => {
      const next = { ...prev }
      if (!nuevaRespuesta || Object.keys(nuevaRespuesta).length === 0) {
        delete next[preguntaId]
      } else {
        next[preguntaId] = nuevaRespuesta
      }
      return next
    })
  }

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setError('')
    setInfo('')
    try {
      // Solo mandar las respuestas con contenido
      const respuestas = Object.entries(respuestasUsr)
        .filter(([_, r]) => r && Object.keys(r).length > 0)
        .map(([pid, r]) => ({ pregunta_id: parseInt(pid, 10), respuesta_json: r }))
      if (respuestas.length === 0) {
        setError('No hay respuestas para guardar.')
        return
      }
      const result = await api.saveMundialMisRespuestas(torneoId, respuestas)
      setInfo(`Guardado · creadas: ${result.creadas} · actualizadas: ${result.actualizadas} · total: ${result.total}`)
      // Marcar la versión actual como "original" para resetear el dirty flag
      setRespuestasOriginal(JSON.parse(JSON.stringify(respuestasUsr)))
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading">Cargando Mundial...</div>
  if (error && !torneo) return <div className="error-msg" style={{ margin: 24 }}>{error}</div>

  return (
    <div style={{ maxWidth: 920, margin: '24px auto', padding: '0 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <MundialIcon width={70} height={50} />
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--color-text)' }}>
            {torneo.nombre}
          </h1>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
            {torneo.semestre}
            <span style={{ marginLeft: 10 }}>· Estado: <strong>{ESTADO_LABEL[estado] || estado}</strong></span>
            {deadline && !isNaN(deadline.getTime()) && (
              <span style={{ marginLeft: 10 }}>
                · Deadline: <strong>{deadline.toLocaleString()}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Banner según estado */}
      {!cargaAbierta && (
        <div style={{
          padding: '12px 16px',
          background: deadlineVencido ? 'rgba(220,38,38,0.08)' : 'rgba(234,179,8,0.12)',
          color: deadlineVencido ? 'var(--color-danger)' : '#a16207',
          borderRadius: 8, marginBottom: 16, fontSize: 14, lineHeight: 1.5,
        }}>
          {deadlineVencido
            ? <>⏰ <strong>Deadline vencido</strong> ({deadline.toLocaleString()}). Las respuestas ya no pueden modificarse.</>
            : <>ℹ️ {ESTADO_MSG[estado] || `Carga no disponible en estado '${estado}'.`}</>}
          {isAdmin && (
            <div style={{ marginTop: 10 }}>
              <Link to={`/admin/torneo/${torneoId}/mundial`} className="btn btn-secondary btn-sm">
                🛠️ Ir al panel de admin Mundial
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Mensajes */}
      {error && <div className="error-msg">{error}</div>}
      {info && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(22,163,74,0.10)',
          color: 'var(--color-success)',
          borderRadius: 6, marginBottom: 12, fontSize: 13,
        }}>
          {info}
        </div>
      )}

      {/* Contador + dirty flag */}
      {preguntas.length > 0 && (
        <div style={{
          fontSize: 13, color: 'var(--color-muted)', marginBottom: 12,
          display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <span><strong>{respondidas}</strong> de <strong>{total}</strong> preguntas respondidas</span>
          {isDirty && cargaAbierta && (
            <span style={{ color: '#a16207' }}>⚠ Tenés cambios sin guardar</span>
          )}
        </div>
      )}

      {/* Lista de preguntas */}
      {preguntas.length === 0 ? (
        <div style={{
          padding: '32px 16px', textAlign: 'center',
          color: 'var(--color-muted)', fontSize: 14,
        }}>
          Todavía no hay preguntas cargadas en este torneo.
        </div>
      ) : (
        preguntas.map(p => {
          let cfg = null
          try { cfg = JSON.parse(p.config_json) } catch { cfg = {} }
          return (
            <div key={p.id} className="card" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--color-muted)',
                  background: 'rgba(0,0,0,0.06)', borderRadius: 99, padding: '2px 8px',
                }}>
                  #{p.numero}
                </span>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, flex: 1 }}>
                  {p.enunciado}
                </h3>
              </div>
              {p.aclaracion && (
                <div style={{
                  fontSize: 12, color: 'var(--color-muted)',
                  marginBottom: 12, fontStyle: 'italic',
                }}>
                  {p.aclaracion}
                </div>
              )}
              <MundialRespuestaInput
                tipo={p.tipo_pregunta}
                configPregunta={cfg}
                equiposCatalogo={equiposCatalogo}
                valor={respuestasUsr[p.id]}
                onChange={nueva => handleChange(p.id, nueva)}
                disabled={!cargaAbierta}
              />
            </div>
          )
        })
      )}

      {/* Botón guardar (sticky al pie) */}
      {cargaAbierta && preguntas.length > 0 && (
        <div style={{
          position: 'sticky', bottom: 0,
          padding: '12px 0', marginTop: 16,
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-bg, white)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="btn btn-primary"
            style={{ minWidth: 200 }}
          >
            {saving ? 'Guardando...' : '💾 Guardar mi planilla'}
          </button>
        </div>
      )}
    </div>
  )
}
