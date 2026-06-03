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

/**
 * Formatea un `deadline_carga` ISO con offset -03:00 al formato canónico
 * que ve el usuario: `DD/MM/YYYY HH:MM hs`. Parsea por regex para evitar el
 * `toLocaleString()` del browser, que renderiza distinto según la locale del
 * SO (ej: '6/11/2026, 7:00:00 PM' en inglés → ambiguo entre junio/noviembre).
 * Si el ISO no matchea el formato canónico, devuelve '' para que el caller
 * decida si oculta el bloque o muestra un fallback.
 */
function formatDeadlineDisplay(isoStr) {
  if (!isoStr || typeof isoStr !== 'string') return ''
  const m = isoStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})(?::\d{2})?(?:\.\d+)?-03:00$/)
  if (!m) return ''
  const [, y, mes, d, hhmm] = m
  return `${d}/${mes}/${y} ${hhmm} hs`
}

/**
 * Clasifica una respuesta como 'completa' | 'parcial' | 'vacia' según el tipo
 * de pregunta y su config. Reglas (Fase 2.5):
 *   - opcion_unica:          completa si `opcion` no vacía
 *   - equipo_categoria:      completa si `equipo` no vacío
 *   - instancia_eliminacion: completa si `instancia` no vacía
 *   - numero_exacto / numero_por_banda: completa si `numero` es entero >= 0
 *   - multi_equipo: completa si `equipos.length === cfg.n_equipos`; parcial si
 *                   tiene algunos pero menos que n; vacía si vacío.
 *   - respuesta_manual / regla_especial: completa si `texto.trim() !== ''`
 * Nota: solo `multi_equipo` puede ser 'parcial'. El resto es binario.
 */
function evaluarRespuesta(tipo, cfg, respuesta) {
  const r = respuesta || {}
  if (Object.keys(r).length === 0) return 'vacia'
  switch (tipo) {
    case 'opcion_unica':
      return (typeof r.opcion === 'string' && r.opcion !== '') ? 'completa' : 'vacia'
    case 'equipo_categoria':
      return (typeof r.equipo === 'string' && r.equipo !== '') ? 'completa' : 'vacia'
    case 'instancia_eliminacion':
      return (typeof r.instancia === 'string' && r.instancia !== '') ? 'completa' : 'vacia'
    case 'numero_exacto':
    case 'numero_por_banda':
      return (Number.isInteger(r.numero) && r.numero >= 0) ? 'completa' : 'vacia'
    case 'multi_equipo': {
      const arr = Array.isArray(r.equipos) ? r.equipos : []
      const n   = (cfg && Number.isInteger(cfg.n_equipos)) ? cfg.n_equipos : 0
      if (arr.length === 0) return 'vacia'
      if (n > 0 && arr.length < n) return 'parcial'
      return 'completa'
    }
    case 'respuesta_manual':
    case 'regla_especial':
      return (typeof r.texto === 'string' && r.texto.trim() !== '') ? 'completa' : 'vacia'
    default:
      return 'vacia'
  }
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
  // Fase 3 — mis puntos por pregunta. misPuntos.visible indica si el backend
  // está exponiendo el detalle (estado >= grupos_jugados). ptsPorPregunta es
  // un map { pregunta_id: pts_obtenidos|null } para badge en cada card.
  const [misPuntos, setMisPuntos]           = useState({ visible: false, items: [], pts_totales: 0 })
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState('')
  // Fase preprod — distinguir errores de acceso (403) del resto para mostrar
  // un layout amigable en lugar del bloque rojo de error genérico.
  const [accesoDenegado, setAccesoDenegado] = useState(false)
  const [info, setInfo]                     = useState('')
  const [saving, setSaving]                 = useState(false)

  useEffect(() => { load() /* eslint-disable-next-line */ }, [torneoId])

  async function load() {
    setLoading(true)
    setError('')
    setAccesoDenegado(false)
    try {
      const [torneosAll, cfg, preg, equipos, misRes, misPts] = await Promise.all([
        api.getMundialTorneos(),
        api.getMundialConfig(torneoId),
        api.getMundialPreguntasActivas(torneoId),
        api.getMundialEquiposCatalogo(torneoId).catch(() => []),
        api.getMundialMisRespuestas(torneoId).catch(() => []),
        // Mis puntos: en estado < grupos_jugados el backend devuelve visible:false.
        // El .catch ofrece fallback amigable si el endpoint falla por cualquier motivo.
        api.getMundialMisPuntos(torneoId).catch(() => ({ visible: false, items: [], pts_totales: 0 })),
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
      setMisPuntos(misPts && typeof misPts === 'object'
        ? misPts
        : { visible: false, items: [], pts_totales: 0 })
    } catch (e) {
      // Distinguimos el 403 de acceso por mensaje del backend (que es estable).
      // No tenemos status code en el error de fetch wrapper, pero el message
      // viene del JSON `error` del backend: "No tenés acceso a este torneo Mundial".
      if (e?.message && /no tenés acceso/i.test(e.message)) {
        setAccesoDenegado(true)
      } else {
        setError(e.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const estado    = config?.estado || 'configuracion'
  const deadline  = config?.deadline_carga ? new Date(config.deadline_carga) : null
  const deadlineVencido = deadline && !isNaN(deadline.getTime()) && new Date() > deadline
  const cargaAbierta    = estado === 'abierto' && !deadlineVencido

  // Mapa { pregunta_id: 'completa' | 'parcial' | 'vacia' } + parseo de cfg una sola vez.
  const evaluacion = useMemo(() => {
    const estados = {}
    const cfgs    = {}
    for (const p of preguntas) {
      let cfg = {}
      try { cfg = JSON.parse(p.config_json) || {} } catch { cfg = {} }
      cfgs[p.id]    = cfg
      estados[p.id] = evaluarRespuesta(p.tipo_pregunta, cfg, respuestasUsr[p.id])
    }
    return { estados, cfgs }
  }, [preguntas, respuestasUsr])

  const completas   = useMemo(() => Object.values(evaluacion.estados).filter(s => s === 'completa').length, [evaluacion])
  const parciales   = useMemo(() => Object.values(evaluacion.estados).filter(s => s === 'parcial').length, [evaluacion])
  const total       = preguntas.length
  const incompletas = total - completas

  // Fase 3 — map { pregunta_id: pts_obtenidos|null } para mostrar badge por card.
  // pts_obtenidos === null → pregunta sin resultado cargado todavía → no se muestra badge.
  const ptsPorPregunta = useMemo(() => {
    const m = {}
    for (const it of (misPuntos.items || [])) m[it.pregunta_id] = it.pts_obtenidos
    return m
  }, [misPuntos])

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
  // Acceso denegado: usuario común no asignado a este torneo. Layout amigable
  // (no bloque rojo de error) con link de vuelta al selector.
  if (accesoDenegado) {
    return (
      <div style={{ maxWidth: 480, margin: '64px auto', textAlign: 'center', padding: '0 16px' }}>
        <div style={{ marginBottom: 12 }}>
          <MundialIcon size={56} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
          No tenés acceso a este torneo
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
          Pedile al admin que te agregue como participante del Mundial.
        </p>
        <Link to="/juegos" className="btn btn-secondary btn-sm">
          ← Volver al selector
        </Link>
      </div>
    )
  }
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
            {(() => {
              const fmt = formatDeadlineDisplay(config.deadline_carga)
              if (!fmt) return null
              return (
                <span style={{ marginLeft: 10 }}>
                  · Cierre de carga: <strong>{fmt}</strong>
                </span>
              )
            })()}
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
            ? (() => {
                const fmt = formatDeadlineDisplay(config.deadline_carga)
                return <>⏰ <strong>Deadline vencido</strong>{fmt ? ` (${fmt})` : ''}. Las respuestas ya no pueden modificarse.</>
              })()
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
          <span><strong>{completas}</strong> de <strong>{total}</strong> preguntas completas</span>
          {parciales > 0 && (
            <span style={{ color: '#a16207' }}>
              · {parciales} parcial{parciales > 1 ? 'es' : ''}
            </span>
          )}
          {isDirty && cargaAbierta && (
            <span style={{ color: '#a16207' }}>⚠ Tenés cambios sin guardar</span>
          )}
        </div>
      )}

      {/* Banner amarillo: hay preguntas sin completar. NO bloquea el guardado. */}
      {cargaAbierta && preguntas.length > 0 && incompletas > 0 && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(234,179,8,0.12)',
          color: '#a16207',
          borderRadius: 8, marginBottom: 12, fontSize: 13, lineHeight: 1.45,
          border: '1px solid rgba(234,179,8,0.30)',
        }}>
          ⚠ Quedan <strong>{incompletas}</strong> pregunta{incompletas > 1 ? 's' : ''} sin completar
          {parciales > 0 && <> (incluye {parciales} parcial{parciales > 1 ? 'es' : ''})</>}.
          Podés guardar parcial y completar el resto antes del deadline.
        </div>
      )}

      {/* Fase 3.3 — link permanente a respuestas de participantes.
          El usuario puede entrar siempre; el backend decide si mostrar el
          mensaje de bloqueo o las respuestas según estado + deadline. */}
      {preguntas.length > 0 && (
        <div style={{
          marginBottom: 12, fontSize: 13,
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <Link to={`/mundial/${torneoId}/respuestas`} className="btn btn-secondary btn-sm">
            👥 Ver respuestas de participantes
          </Link>
        </div>
      )}

      {/* Fase 3 — banner azul: mis puntos totales + link al ranking.
          Solo cuando el backend marca visible:true (estado >= grupos_jugados). */}
      {misPuntos.visible && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(59,130,246,0.08)',
          color: 'var(--color-text)',
          borderRadius: 8, marginBottom: 16, fontSize: 14, lineHeight: 1.45,
          border: '1px solid rgba(59,130,246,0.25)',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <span>
            🏆 Tus puntos: <strong style={{ fontSize: 16 }}>{misPuntos.pts_totales}</strong>
          </span>
          <span style={{ flex: 1 }} />
          <Link to={`/mundial/${torneoId}/ranking`} className="btn btn-secondary btn-sm">
            Ver ranking →
          </Link>
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
          const cfg    = evaluacion.cfgs[p.id] || {}
          const estado = evaluacion.estados[p.id] || 'vacia'
          return (
            <div key={p.id} className="card" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--color-muted)',
                  background: 'rgba(0,0,0,0.06)', borderRadius: 99, padding: '2px 8px',
                }}>
                  #{p.numero}
                </span>
                {estado === 'completa' && (
                  <span
                    title="Respuesta completa"
                    style={{ color: 'var(--color-success)', fontSize: 16, fontWeight: 700, lineHeight: 1 }}
                  >
                    ✓
                  </span>
                )}
                {estado === 'parcial' && (
                  <span
                    title="Respuesta incompleta — faltan equipos"
                    style={{ color: '#a16207', fontSize: 14, fontWeight: 700, lineHeight: 1 }}
                  >
                    ⚠
                  </span>
                )}
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, flex: 1 }}>
                  {p.enunciado}
                </h3>
                {/* Fase 3 — badge de pts si misPuntos.visible. null = pendiente. */}
                {misPuntos.visible && (() => {
                  const pts = ptsPorPregunta[p.id]
                  if (pts === undefined || pts === null) {
                    return (
                      <span style={{
                        fontSize: 11, color: 'var(--color-muted)',
                        background: 'rgba(0,0,0,0.04)', padding: '2px 8px', borderRadius: 99,
                        whiteSpace: 'nowrap',
                      }} title="Resultado aún no cargado">
                        pendiente
                      </span>
                    )
                  }
                  const acerto = pts > 0
                  return (
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      color: acerto ? 'var(--color-success)' : 'var(--color-muted)',
                      background: acerto ? 'rgba(22,163,74,0.10)' : 'rgba(0,0,0,0.04)',
                      padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap',
                    }}>
                      {acerto ? `+${pts} pts` : `${pts} pts`}
                    </span>
                  )
                })()}
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
