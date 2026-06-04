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
  // Fase 5 — flujo de cambios post-grupos. Solo se llena cuando estado='cambios_abiertos'.
  //   misCambiosCtx: contexto de la ventana ({ ventana, habilitado, cambios_usados, cambios_restantes, costo_usd, preguntas_habilitables }).
  //   respuestasPreVentana: copia inmutable de mundial_respuestas_usuario al inicio
  //     de la ventana (para mostrar el diff "original → nueva" en cada card).
  const [misCambiosCtx, setMisCambiosCtx]   = useState({ visible: false })
  const [respuestasPreVentana, setRespuestasPreVentana] = useState({})
  // Fase Premios — calculados (lista de posiciones con monto USD + usuario del ranking).
  // Lo cargamos siempre — backend devuelve `configurado: false` si admin no cargó tabla.
  const [premiosCalc, setPremiosCalc]       = useState(null)
  const [premiosAbierto, setPremiosAbierto] = useState(false) // colapsable, cerrado por default
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
      const [torneosAll, cfg, preg, equipos, misRes, misPts, premios] = await Promise.all([
        api.getMundialTorneos(),
        api.getMundialConfig(torneoId),
        api.getMundialPreguntasActivas(torneoId),
        api.getMundialEquiposCatalogo(torneoId).catch(() => []),
        api.getMundialMisRespuestas(torneoId).catch(() => []),
        // Mis puntos: en estado < grupos_jugados el backend devuelve visible:false.
        // El .catch ofrece fallback amigable si el endpoint falla por cualquier motivo.
        api.getMundialMisPuntos(torneoId).catch(() => ({ visible: false, items: [], pts_totales: 0 })),
        // Fase Premios — premios calculados (cruce con ranking). null si falla.
        api.getMundialPremiosCalculados(torneoId).catch(() => null),
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
      setMisPuntos(misPts && typeof misPts === 'object'
        ? misPts
        : { visible: false, items: [], pts_totales: 0 })
      setPremiosCalc(premios && typeof premios === 'object' ? premios : null)

      // Fase 5 — si el torneo está en 'cambios_abiertos', cargamos el contexto
      // y los cambios ya cargados por este user. Estos endpoints son no-ops
      // (devuelven ctx vacío) si no aplica, así que llamarlos siempre tampoco
      // sería incorrecto; pero evitamos round-trips innecesarios.
      let mapMixed = mapRes
      let ctx = { visible: false }
      if (cfg.estado === 'cambios_abiertos') {
        const [ctxResp, misCambResp] = await Promise.all([
          api.getMundialMisCambiosDisponibles(torneoId).catch(() => null),
          api.getMundialMisCambios(torneoId).catch(() => null),
        ])
        if (ctxResp) ctx = { visible: true, ...ctxResp }
        // Overlay de cambios cargados sobre las respuestas pre-ventana.
        const cargados = (misCambResp && Array.isArray(misCambResp.cambios)) ? misCambResp.cambios : []
        if (cargados.length > 0) {
          mapMixed = { ...mapRes }
          for (const c of cargados) {
            try { mapMixed[c.pregunta_id] = JSON.parse(c.respuesta_nueva_json) } catch {}
          }
        }
      }
      setMisCambiosCtx(ctx)
      setRespuestasPreVentana(JSON.parse(JSON.stringify(mapRes)))
      setRespuestasUsr(mapMixed)
      setRespuestasOriginal(JSON.parse(JSON.stringify(mapMixed)))
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

  // Fase 5 — modo "cambios": el torneo está en 'cambios_abiertos' y el user
  // está habilitado en la ventana. Editar preguntas con cambio_habilitado=1.
  const modoCambios       = estado === 'cambios_abiertos'
  const puedeCargarCambios = modoCambios && !!misCambiosCtx?.habilitado && !!misCambiosCtx?.ventana

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
      if (modoCambios) {
        // Fase 5: en modo cambios, mandar solo preguntas dirty con cambio_habilitado=1.
        if (!puedeCargarCambios) {
          setError('No estás habilitado para esta ventana de cambios.')
          return
        }
        const cambios = []
        for (const p of preguntas) {
          if (p.cambio_habilitado !== 1) continue
          const actual  = respuestasUsr[p.id]
          const orig    = respuestasOriginal[p.id]
          if (JSON.stringify(actual) !== JSON.stringify(orig)) {
            if (!actual || Object.keys(actual).length === 0) {
              setError(`Pregunta #${p.numero}: respuesta vacía. No se puede borrar un cambio, solo modificar.`)
              return
            }
            cambios.push({ pregunta_id: p.id, respuesta_json: actual })
          }
        }
        if (cambios.length === 0) {
          setError('No hay cambios nuevos para guardar.')
          return
        }
        const result = await api.saveMundialMisCambios(torneoId, cambios)
        setInfo(`Cambios guardados — creados: ${result.creados} · actualizados: ${result.actualizados} · usados: ${result.cambios_usados}/${(misCambiosCtx?.ventana?.cambios_por_usuario ?? '?')}.`)
        setRespuestasOriginal(JSON.parse(JSON.stringify(respuestasUsr)))
        // Refrescar el contexto para que el contador se actualice.
        try {
          const ctxResp = await api.getMundialMisCambiosDisponibles(torneoId)
          setMisCambiosCtx({ visible: true, ...ctxResp })
        } catch (_) { /* ignorar */ }
        return
      }

      // Flujo normal (estado='abierto'): PUT /mis-respuestas.
      const respuestas = Object.entries(respuestasUsr)
        .filter(([_, r]) => r && Object.keys(r).length > 0)
        .map(([pid, r]) => ({ pregunta_id: parseInt(pid, 10), respuesta_json: r }))
      if (respuestas.length === 0) {
        setError('No hay respuestas para guardar.')
        return
      }
      const result = await api.saveMundialMisRespuestas(torneoId, respuestas)
      setInfo(`Guardado · creadas: ${result.creadas} · actualizadas: ${result.actualizadas} · total: ${result.total}`)
      setRespuestasOriginal(JSON.parse(JSON.stringify(respuestasUsr)))
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  /**
   * Determina si una pregunta es editable en el contexto actual.
   *   - Flujo normal (cargaAbierta): todas editables.
   *   - Modo cambios: solo si user habilitado Y pregunta.cambio_habilitado=1.
   *   - Resto: read-only.
   */
  function esEditable(pregunta) {
    if (cargaAbierta) return true
    if (modoCambios && puedeCargarCambios) return pregunta.cambio_habilitado === 1
    return false
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

      {/* Sticky mini-tablero (Fase 5 UX v2) — más jerárquico.
          Layout: dos zonas (izquierda info / derecha puntos + acciones).
          top: 48 ≈ navbar height. z-index: 50 (< navbar 100).
          Bleed lateral (-16) para tocar los bordes del container.
          En mobile, las zonas wrappean naturalmente. */}
      <div style={{
        position: 'sticky',
        top: 48,
        zIndex: 50,
        background: 'var(--color-surface, white)',
        borderBottom: '1px solid var(--color-border)',
        borderTop:    '1px solid var(--color-border)',
        padding: '10px 16px',
        margin: '0 -16px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      }}>
        {/* Zona izquierda: torneo + estado + cambios */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          minWidth: 0,
        }}>
          <span style={{
            fontWeight: 700, fontSize: 14,
            display: 'inline-flex', alignItems: 'center', gap: 4,
            color: 'var(--color-text)', whiteSpace: 'nowrap',
          }}>
            🌍 {torneo.nombre}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
            background: 'rgba(99,102,241,0.12)', color: '#6366f1',
            whiteSpace: 'nowrap', letterSpacing: '0.02em',
          }}>
            {ESTADO_LABEL[estado] || estado}
          </span>
          {modoCambios && (
            puedeCargarCambios ? (
              <span style={{
                fontSize: 12, padding: '3px 10px', borderRadius: 99,
                background: 'rgba(124,58,237,0.12)', color: '#7c3aed',
                whiteSpace: 'nowrap', fontWeight: 600,
              }}>
                🔄 {misCambiosCtx.cambios_usados}/{misCambiosCtx.ventana?.cambios_por_usuario} usados · USD {misCambiosCtx.costo_usd}
              </span>
            ) : (
              <span style={{
                fontSize: 12, padding: '3px 10px', borderRadius: 99,
                background: 'rgba(234,179,8,0.15)', color: '#a16207',
                whiteSpace: 'nowrap', fontWeight: 600,
              }}>
                🔒 No habilitado
              </span>
            )
          )}
        </div>

        {/* Zona derecha: puntos prominentes + botones */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          {misPuntos.visible && (
            <div style={{
              display: 'inline-flex', alignItems: 'baseline', gap: 6,
              padding: '4px 14px',
              background: 'linear-gradient(135deg, rgba(59,130,246,0.10), rgba(124,58,237,0.10))',
              border: '1px solid rgba(59,130,246,0.30)',
              borderRadius: 10,
              boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.04)',
            }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>🏆</span>
              <span style={{
                fontSize: 11, fontWeight: 700, color: 'var(--color-muted)',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                Tus puntos
              </span>
              <span style={{
                fontSize: 24, fontWeight: 800, lineHeight: 1,
                color: 'var(--color-text)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {misPuntos.pts_totales}
              </span>
            </div>
          )}
          <Link
            to={`/mundial/${torneoId}/ranking`}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 12, padding: '5px 12px' }}
          >
            Ranking
          </Link>
          <Link
            to={`/mundial/${torneoId}/respuestas`}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 12, padding: '5px 12px' }}
          >
            Respuestas
          </Link>
        </div>
      </div>

      {/* Banner según estado — Fase 5 sobreescribe el mensaje genérico cuando
          el torneo está en 'cambios_abiertos'. */}
      {!cargaAbierta && !modoCambios && (
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

      {/* Fase 5 — banner ventana de cambios */}
      {modoCambios && (
        puedeCargarCambios ? (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(124,58,237,0.08)',
            color: 'var(--color-text)',
            borderRadius: 8, marginBottom: 16, fontSize: 14, lineHeight: 1.5,
            border: '1px solid rgba(124,58,237,0.25)',
          }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              🔄 Ventana de cambios abierta — {misCambiosCtx.ventana?.nombre}
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
              Usaste <strong>{misCambiosCtx.cambios_usados}</strong> de{' '}
              <strong>{misCambiosCtx.ventana?.cambios_por_usuario}</strong> cambios.
              Costo: USD <strong>{misCambiosCtx.costo_usd}</strong> por cambio.
              Solo se pueden editar preguntas marcadas como cambiables.
            </div>
          </div>
        ) : (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(234,179,8,0.12)',
            color: '#a16207',
            borderRadius: 8, marginBottom: 16, fontSize: 14, lineHeight: 1.5,
            border: '1px solid rgba(234,179,8,0.25)',
          }}>
            🔒 <strong>No estás habilitado para esta ventana de cambios.</strong>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              {misCambiosCtx?.ventana
                ? 'Pedile al admin que te habilite si querés cargar cambios.'
                : 'No hay ventana de cambios abierta en este momento.'}
            </div>
          </div>
        )
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

      {/* Contador + dirty flag — solo en flujo normal (no en modoCambios) */}
      {preguntas.length > 0 && !modoCambios && (
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

      {/* En modoCambios, mostrar dirty flag específico */}
      {modoCambios && puedeCargarCambios && isDirty && (
        <div style={{
          fontSize: 13, color: '#a16207', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          ⚠ Tenés cambios sin guardar
        </div>
      )}

      {/* Banner amarillo: hay preguntas sin completar. NO bloquea el guardado.
          Solo en flujo normal — en modoCambios no aplica el concepto. */}
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

      {/* Fase Premios — bloque colapsable. Cerrado por default.
          Solo se muestra si el admin configuró al menos 1 premio. */}
      {premiosCalc && premiosCalc.configurado && (
        <BloquePremios
          calc={premiosCalc}
          userId={user?.id}
          abierto={premiosAbierto}
          onToggle={() => setPremiosAbierto(o => !o)}
        />
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
                {/* Fase 5 — badge cambiable/no en modo cambios. */}
                {modoCambios && (
                  p.cambio_habilitado === 1 ? (
                    <span title="Esta pregunta es cambiable" style={{
                      fontSize: 11, fontWeight: 600, color: 'var(--color-primary)',
                      background: 'rgba(59,130,246,0.10)', padding: '2px 8px', borderRadius: 99,
                      whiteSpace: 'nowrap',
                    }}>🔄 cambiable</span>
                  ) : (
                    <span title="Esta pregunta NO se puede cambiar" style={{
                      fontSize: 11, fontWeight: 600, color: 'var(--color-muted)',
                      background: 'rgba(0,0,0,0.04)', padding: '2px 8px', borderRadius: 99,
                      whiteSpace: 'nowrap',
                    }}>🔒 fija</span>
                  )
                )}
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
                disabled={!esEditable(p)}
              />
              {/* Fase 5 — diff "Original → Nueva" cuando hubo edición en
                  modo cambios. Solo se muestra si realmente difiere de la
                  respuesta pre-ventana. */}
              {modoCambios && p.cambio_habilitado === 1 && (() => {
                const pre  = respuestasPreVentana[p.id]
                const curr = respuestasUsr[p.id]
                if (JSON.stringify(pre || {}) === JSON.stringify(curr || {})) return null
                return (
                  <div style={{
                    marginTop: 8, padding: '6px 10px',
                    background: 'rgba(59,130,246,0.05)',
                    border: '1px dashed rgba(59,130,246,0.30)',
                    borderRadius: 6, fontSize: 12, color: 'var(--color-muted)',
                  }}>
                    <strong>Original:</strong> {compactJsonResp(pre)} →{' '}
                    <strong style={{ color: 'var(--color-primary)' }}>Nueva:</strong>{' '}
                    {compactJsonResp(curr)}
                  </div>
                )
              })()}
            </div>
          )
        })
      )}

      {/* Botón guardar (sticky al pie). En modo cambios: "Guardar cambios". */}
      {(cargaAbierta || (modoCambios && puedeCargarCambios)) && preguntas.length > 0 && (
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
            {saving
              ? 'Guardando...'
              : modoCambios ? '🔄 Guardar cambios' : '💾 Guardar mi planilla'}
          </button>
        </div>
      )}
    </div>
  )
}

// Helper local para mostrar el diff compacto sin colisionar con la página
// de respuestas-publicas (que tiene su propio compactJson).
function compactJsonResp(obj) {
  if (!obj || typeof obj !== 'object') return '∅'
  const entries = Object.entries(obj)
  if (entries.length === 0) return '∅'
  return entries.map(([k, v]) => `${k}=${Array.isArray(v) ? `[${v.join(',')}]` : v}`).join(' ')
}

// ── Fase Premios — bloque colapsable para el user ────────────────────────
// Muestra:
//   - su posición actual + premio/castigo estimado si esa posición tiene fila;
//   - tabla compacta de premios por posición con highlight de la del user;
//   - aclaración "Estimado hasta que el Mundial finalice" si aplica.
// SIN pozo (el modelo es fijo por posición, no aplica el concepto).
function BloquePremios({ calc, userId, abierto, onToggle }) {
  // Mi premio (si mi posición está en la tabla)
  const miFila   = (calc.premios || []).find(p => p.usuario?.user_id === userId)
  const miPos    = miFila?.posicion ?? null
  const miMonto  = miFila?.usd ?? null
  const miRol    = miFila?.comida_rol || null

  // Fase 6.1: solo mostrar la columna/aclaración de Comida si HAY al menos una
  // fila con comida_rol cargada por el admin. Si no usó la feature, desaparece.
  const hayComida = (calc.premios || []).some(p => !!p.comida_rol)

  function fmtUsd(usd) {
    if (!Number.isInteger(usd)) return '—'
    return `${usd >= 0 ? '+' : ''}${usd} USD`
  }
  function colorUsd(usd) {
    if (!Number.isInteger(usd)) return 'var(--color-muted)'
    return usd > 0 ? 'var(--color-success)' : usd < 0 ? 'var(--color-danger)' : 'var(--color-muted)'
  }
  // Badge traducido de comida_rol — mismo set de colores que MundialRanking.
  function comidaBadge(rol) {
    switch (rol) {
      case 'gratis':   return { label: 'Come gratis', fg: 'var(--color-success)', bg: 'rgba(22,163,74,0.10)' }
      case 'paga':     return { label: 'Paga',        fg: '#a16207',              bg: 'rgba(234,179,8,0.12)' }
      case 'organiza': return { label: 'Organiza',    fg: '#7c3aed',              bg: 'rgba(124,58,237,0.10)' }
      default:         return null
    }
  }

  return (
    <div style={{
      marginBottom: 16,
      border: '1px solid var(--color-border)',
      borderRadius: 8,
      background: 'var(--color-surface, white)',
      overflow: 'hidden',
    }}>
      {/* Header clickeable */}
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%', background: 'none', border: 'none',
          padding: '10px 14px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10,
          textAlign: 'left',
          color: 'var(--color-text)', fontSize: 14,
        }}
      >
        <span style={{ fontSize: 16 }}>🏆</span>
        <span style={{ fontWeight: 600 }}>Premios</span>
        {miFila ? (
          <>
            <span style={{
              fontSize: 12, padding: '2px 8px', borderRadius: 99,
              background: miMonto > 0 ? 'rgba(22,163,74,0.10)'
                         : miMonto < 0 ? 'rgba(220,38,38,0.10)'
                         : 'rgba(0,0,0,0.05)',
              color: colorUsd(miMonto), fontWeight: 600,
            }}>
              Tu posición {miPos}° · {fmtUsd(miMonto)}
            </span>
            {/* Fase 6.1: chip de comida si existe rol configurado para mi posición */}
            {(() => {
              const b = comidaBadge(miRol)
              if (!b) return null
              return (
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 99,
                  background: b.bg, color: b.fg, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.03em',
                }}>
                  🍝 {b.label}
                </span>
              )
            })()}
          </>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            Tu posición no tiene premio configurado
          </span>
        )}
        <span style={{ flex: 1 }} />
        {calc.estimado && (
          <span style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 4,
            background: 'rgba(234,179,8,0.15)', color: '#a16207',
            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            Estimado
          </span>
        )}
        <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
          {abierto ? '▲' : '▼'}
        </span>
      </button>

      {/* Detalle desplegable */}
      {abierto && (
        <div style={{
          borderTop: '1px solid var(--color-border)',
          padding: '10px 14px',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--color-surface2)' }}>
                <th style={{ ...bpTh, width: 60 }}>Pos.</th>
                <th style={bpTh}>Usuario</th>
                <th style={{ ...bpTh, textAlign: 'right', width: 90 }}>USD</th>
                {hayComida && <th style={{ ...bpTh, textAlign: 'center', width: 110 }}>Comida</th>}
              </tr>
            </thead>
            <tbody>
              {(calc.premios || []).map(p => {
                const esYo = p.usuario?.user_id === userId
                const b    = comidaBadge(p.comida_rol)
                return (
                  <tr key={p.posicion} style={{
                    borderTop: '1px solid rgba(0,0,0,0.04)',
                    background: esYo ? 'rgba(59,130,246,0.06)' : 'transparent',
                    fontWeight: esYo ? 600 : 400,
                  }}>
                    <td style={{ ...bpTd, fontWeight: 700, textAlign: 'center' }}>{p.posicion}°</td>
                    <td style={bpTd}>
                      {p.usuario
                        ? <>
                            {p.usuario.nombre}
                            {esYo && <span style={{ fontSize: 11, color: 'var(--color-primary)', marginLeft: 6 }}>(vos)</span>}
                          </>
                        : <span style={{ color: 'var(--color-muted)', fontStyle: 'italic' }}>(libre)</span>}
                    </td>
                    <td style={{
                      ...bpTd, textAlign: 'right', fontWeight: 700,
                      color: colorUsd(p.usd),
                    }}>
                      {fmtUsd(p.usd)}
                    </td>
                    {hayComida && (
                      <td style={{ ...bpTd, textAlign: 'center' }}>
                        {b ? (
                          <span style={{
                            fontSize: 10, fontWeight: 700,
                            padding: '2px 6px', borderRadius: 99,
                            color: b.fg, background: b.bg,
                            textTransform: 'uppercase', letterSpacing: '0.03em',
                            whiteSpace: 'nowrap',
                          }}>
                            {b.label}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-muted)' }}>—</span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {calc.estimado && (
            <div style={{
              marginTop: 8, fontSize: 11, color: 'var(--color-muted)',
              fontStyle: 'italic', lineHeight: 1.4,
            }}>
              ℹ Estimado hasta que el Mundial finalice. Las posiciones se actualizan según el ranking actual.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const bpTh = {
  padding: '6px 10px', textAlign: 'left',
  fontSize: 11, fontWeight: 700, color: 'var(--color-muted)',
  textTransform: 'uppercase', letterSpacing: '0.04em',
}
const bpTd = { padding: '6px 10px' }
