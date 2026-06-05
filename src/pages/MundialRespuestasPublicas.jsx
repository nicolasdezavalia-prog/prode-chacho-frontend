/**
 * MundialRespuestasPublicas — Fase 3.4 + Mini-fase "respuestas corregidas"
 *
 * Vista social tipo matriz comparativa: una fila por pregunta, una columna
 * por participante, celda con la respuesta + estado de corrección.
 *
 * UX:
 *   - Card con scroll interno (horizontal + vertical) para no romper en mobile.
 *   - Header de participantes sticky top — ahora con 2 líneas (nombre + pts).
 *   - Columna de preguntas sticky left, esquina sticky a ambos.
 *   - Columna del usuario actual resaltada (fondo azul suave + badge "vos").
 *   - Equipos: 🇦🇷 Argentina (emoji + nombre). Si no hay emoji → solo nombre.
 *     Si no se encuentra en catálogo → código como fallback.
 *   - Multi-equipo con resultado cargado: chips por equipo verde/rojo.
 *   - Multi-equipo pendiente: lista coma-separada (fallback).
 *   - Sin respuesta: "—" gris.
 *
 * Datos del backend (mini-fase respuestas corregidas):
 *   - participantes[]: nombre + puntos_totales (cruzado con ranking real).
 *   - tiene_resultado por pregunta.
 *   - por celda: puntos_obtenidos, estado, detalle_items (solo multi_equipo).
 *
 * Reglas de scoring NO se calculan en el frontend — vienen del backend para
 * evitar duplicación con `mundial-scoring.js`.
 */

import { useEffect, useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/index.js'
import { useAuth } from '../App.jsx'
import MundialIcon from '../components/MundialIcon.jsx'

/**
 * Versiones cortas para preguntas largas (Fase 3.4c). Display-only; el
 * enunciado real en el backend no se toca. Si una pregunta no está acá,
 * se muestra el enunciado completo.
 */
const ENUNCIADOS_CORTOS = {
  32: 'Eliminados en 16°',
  33: 'Eliminados en 8°',
  34: 'Eliminados en 4°',
}
function enunciadoDisplay(numero, enunciadoOriginal) {
  return ENUNCIADOS_CORTOS[numero] || enunciadoOriginal
}

const RESPUESTAS_PUBLICAS_CSS = `
.rp-scroll {
  overflow: auto;
  max-height: 78vh;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: white;
}
.rp-matrix {
  border-collapse: separate;
  border-spacing: 0;
  width: max-content;
  min-width: 100%;
  font-size: 13px;
  line-height: 1.35;
}
.rp-matrix th,
.rp-matrix td {
  padding: 8px 12px;
  border-bottom: 1px solid rgba(0,0,0,0.05);
  background: white;
  vertical-align: top;
  font-weight: normal;
  color: var(--color-text);
}
.rp-matrix thead th {
  position: sticky;
  top: 0;
  /* z-index alto para garantizar que el header sticky quede por ENCIMA de
     cualquier celda del cuerpo al scrollear verticalmente. Combinado con
     box-shadow inset para que el borde inferior siga nítido aunque el
     contenido pase por debajo. */
  z-index: 5;
  background: var(--color-surface2, #f1f3f5);
  font-weight: 600;
  font-size: 12px;
  white-space: nowrap;
  border-bottom: 2px solid var(--color-border);
  box-shadow: inset 0 -2px 0 var(--color-border);
  color: var(--color-text);
  text-align: center;
  /* Altura mínima fija para que el header de 2 líneas (nombre + pts) no
     dependa del contenido y nunca "salte" al scrollear. */
  min-height: 44px;
  padding: 6px 12px;
}
/* Header con 2 líneas: nombre arriba, pts abajo. */
.rp-head-name {
  display: block;
  font-weight: 600;
  font-size: 12px;
  line-height: 1.25;
}
.rp-head-pts {
  display: block;
  font-size: 10px;
  font-weight: 600;
  color: var(--color-muted);
  letter-spacing: 0.02em;
  margin-top: 2px;
}
/* Columna "Pregunta" (sticky left) — ancho controlado y left-align. */
.rp-matrix tbody th {
  position: sticky;
  left: 0;
  z-index: 1;
  background: white;
  border-right: 1px solid var(--color-border);
  font-weight: 500;
  text-align: left;
  min-width: 200px;
  max-width: 240px;
}
.rp-corner {
  position: sticky !important;
  top: 0;
  left: 0;
  /* La esquina debe quedar por encima del thead (z-index 5) y de la
     primera columna sticky (z-index 1). */
  z-index: 6 !important;
  background: var(--color-surface2, #f1f3f5) !important;
  border-right: 1px solid var(--color-border);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-muted);
  text-align: left !important;
}
.rp-q-num {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-muted);
  background: rgba(0,0,0,0.06);
  border-radius: 99px;
  padding: 2px 8px;
  margin-right: 6px;
  vertical-align: middle;
}
.rp-q-text {
  vertical-align: middle;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
/* Celdas de respuestas (no la columna Pregunta): centradas + max-width. */
.rp-matrix tbody td {
  text-align: center;
}
.rp-cell-content {
  display: inline-block;
  max-width: 200px;
  word-break: normal;
  overflow-wrap: break-word;
  text-align: center;
}
/* Fila inferior de cada celda: badge estado + pts. */
.rp-cell-status {
  display: flex;
  gap: 4px;
  justify-content: center;
  align-items: center;
  margin-top: 6px;
  flex-wrap: wrap;
}
.rp-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.rp-badge--correcto   { background: rgba(22,163,74,0.12);  color: var(--color-success); }
.rp-badge--incorrecto { background: rgba(220,38,38,0.10);  color: var(--color-danger); }
.rp-badge--parcial    { background: rgba(59,130,246,0.12); color: var(--color-primary); }
.rp-badge--pendiente  { background: rgba(234,179,8,0.15);  color: #a16207; }
.rp-pts {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0;
}
.rp-pts--pos { color: var(--color-success); }
.rp-pts--neg { color: var(--color-danger); }
.rp-pts--muted { color: var(--color-muted); font-weight: 400; }
/* Multi-equipo: chips por equipo. */
.rp-multi {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
  max-width: 200px;
}
.rp-chip {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 99px;
  white-space: nowrap;
  font-weight: 500;
  border: 1px solid transparent;
}
.rp-chip--ok  { background: rgba(22,163,74,0.10);  color: var(--color-success); border-color: rgba(22,163,74,0.25); }
.rp-chip--bad { background: rgba(220,38,38,0.08);  color: var(--color-danger);  border-color: rgba(220,38,38,0.22); }
/* IMPORTANTE: estos backgrounds deben ser OPACOS. Si se usa rgba con alpha
   bajo, el header sticky deja pasar las celdas que scrollean por debajo y
   el texto del nombre se mezcla. Mantener colores planos azulados. */
.rp-head--self {
  background: #dbe7ff !important;
  color: var(--color-text);
}
.rp-cell--self {
  background: #f3f7ff !important;
}
.rp-vos {
  display: inline-block;
  font-size: 10px;
  font-weight: 500;
  color: var(--color-primary);
  background: rgba(59,130,246,0.18);
  padding: 1px 6px;
  border-radius: 99px;
  margin-left: 4px;
  text-transform: lowercase;
  letter-spacing: 0;
  vertical-align: middle;
}
.rp-missing { color: var(--color-muted); }

@media (max-width: 560px) {
  .rp-scroll { max-height: 70vh; }
  .rp-matrix th, .rp-matrix td { padding: 6px 8px; font-size: 12px; }
  .rp-matrix thead th { min-height: 40px; padding: 5px 8px; }
  .rp-matrix tbody th { min-width: 160px; max-width: 200px; }
  .rp-cell-content { max-width: 140px; }
  .rp-multi { max-width: 140px; }
  .rp-q-num { padding: 1px 6px; margin-right: 4px; }
}
`

// Labels para cada estado del backend.
const ESTADO_LABELS = {
  correcto:   'Correcto',
  incorrecto: 'Incorrecto',
  parcial:    'Parcial',
  pendiente:  'Pendiente',
}

export default function MundialRespuestasPublicas() {
  const { torneoId } = useParams()
  const { user }     = useAuth()

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

  const equiposByCodigo = useMemo(() => {
    const m = new Map()
    for (const eq of equipos) m.set(eq.codigo, eq)
    return m
  }, [equipos])

  /**
   * Equipo formateado: emoji + nombre, o nombre, o código crudo (fallback).
   * Solo devuelve string — usado tanto para fmtRespuesta como para los chips.
   */
  function fmtEquipo(codigo) {
    if (!codigo || typeof codigo !== 'string') return null
    const eq = equiposByCodigo.get(codigo)
    if (!eq) return codigo
    if (eq.emoji && eq.nombre) return `${eq.emoji} ${eq.nombre}`
    if (eq.nombre) return eq.nombre
    return codigo
  }

  // "—" gris para "sin respuesta" / "(vacío)" / inválido.
  const missingNode = (text = '—') => <span className="rp-missing">{text}</span>

  function fmtRespuesta(tipo, respuestaJsonStr) {
    if (!respuestaJsonStr) return missingNode()
    let r
    try { r = JSON.parse(respuestaJsonStr) }
    catch { return missingNode('(inválido)') }
    if (!r || typeof r !== 'object') return missingNode()

    switch (tipo) {
      case 'opcion_unica':
        return typeof r.opcion === 'string' ? r.opcion : missingNode()
      case 'equipo_categoria':
        return fmtEquipo(r.equipo) || missingNode()
      case 'instancia_eliminacion':
        return typeof r.instancia === 'string' ? r.instancia : missingNode()
      case 'numero_exacto':
      case 'numero_por_banda':
        return Number.isInteger(r.numero) ? String(r.numero) : missingNode()
      case 'multi_equipo': {
        // Fallback (sin detalle_items): lista coma-separada. Solo se ve cuando
        // el resultado aún no está cargado (estado = pendiente).
        const arr = Array.isArray(r.equipos) ? r.equipos : []
        if (arr.length === 0) return missingNode()
        return arr.map(fmtEquipo).filter(Boolean).join(', ')
      }
      case 'respuesta_manual':
      case 'regla_especial':
        return (typeof r.texto === 'string' && r.texto.trim() !== '')
          ? r.texto
          : missingNode()
      default:
        return missingNode('(tipo no soportado)')
    }
  }

  /**
   * Renderiza chips por equipo cuando el backend mandó detalle_items para una
   * celda multi_equipo. Cada item: { codigo, correcto }.
   */
  function renderChipsMulti(detalleItems) {
    if (!Array.isArray(detalleItems) || detalleItems.length === 0) return missingNode()
    return (
      <span className="rp-multi">
        {detalleItems.map((it, i) => (
          <span
            key={`${it.codigo}-${i}`}
            className={`rp-chip ${it.correcto ? 'rp-chip--ok' : 'rp-chip--bad'}`}
          >
            {fmtEquipo(it.codigo) || it.codigo}
          </span>
        ))}
      </span>
    )
  }

  /**
   * Badge + pts debajo de cada celda. Cero lógica de scoring local — todo
   * viene del backend (estado + puntos_obtenidos).
   */
  function renderEstado(cell) {
    if (!cell || !cell.estado) return null
    const estado = cell.estado
    const pts    = cell.puntos_obtenidos
    let ptsLabel, ptsClass
    if (estado === 'pendiente' || pts === null) {
      ptsLabel = 'pendiente'
      ptsClass = 'rp-pts--muted'
    } else if (pts > 0) {
      ptsLabel = `+${pts} pts`
      ptsClass = 'rp-pts--pos'
    } else if (pts < 0) {
      ptsLabel = `${pts} pts`
      ptsClass = 'rp-pts--neg'
    } else {
      ptsLabel = '0 pts'
      ptsClass = 'rp-pts--muted'
    }
    return (
      <span className="rp-cell-status">
        <span className={`rp-badge rp-badge--${estado}`}>
          {ESTADO_LABELS[estado] || estado}
        </span>
        <span className={`rp-pts ${ptsClass}`}>{ptsLabel}</span>
      </span>
    )
  }

  /**
   * IMPORTANTE: todos los hooks deben ir antes de cualquier early return.
   */

  const preguntas = Array.isArray(data?.preguntas) ? data.preguntas : []

  /**
   * Participantes: viene del backend con puntos_totales (cruzado con ranking).
   * Promover al user actual a la primera posición para comparar fácil.
   * Fallback (compat): si el backend no manda `participantes`, derivar de las
   * respuestas como antes — sin pts.
   */
  const participantes = useMemo(() => {
    let base = Array.isArray(data?.participantes) ? data.participantes : null
    if (!base) {
      // Fallback compat con shape anterior — no debería pasar en backend nuevo.
      const map = new Map()
      for (const p of preguntas) {
        for (const r of (p.respuestas || [])) {
          if (!map.has(r.user_id)) {
            map.set(r.user_id, { user_id: r.user_id, nombre: r.nombre || `Usuario ${r.user_id}`, puntos_totales: null })
          }
        }
      }
      base = [...map.values()]
    }
    const arr = base.slice().sort((a, b) =>
      (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' })
    )
    // Promover al user actual a la primera posición si está en la lista.
    if (user && arr.some(p => p.user_id === user.id)) {
      const yo = arr.find(p => p.user_id === user.id)
      const resto = arr.filter(p => p.user_id !== user.id)
      return [yo, ...resto]
    }
    return arr
  }, [data, preguntas, user])

  /**
   * Index { pregunta_id → { user_id → cellObj } } para lookup O(1) por celda.
   * Cada cellObj incluye respuesta_json + estado + puntos_obtenidos + detalle_items.
   */
  const celdaIndex = useMemo(() => {
    const m = new Map()
    for (const p of preguntas) {
      const inner = new Map()
      for (const r of (p.respuestas || [])) inner.set(r.user_id, r)
      m.set(p.id, inner)
    }
    return m
  }, [preguntas])

  // Early returns van DESPUÉS de todos los hooks.
  if (loading) return <div className="loading">Cargando respuestas...</div>
  if (error)   return <div className="error-msg" style={{ margin: 24 }}>{error}</div>

  const visible = data?.visible === true

  return (
    <div style={{ maxWidth: 1100, margin: '24px auto', padding: '0 16px' }}>
      <style>{RESPUESTAS_PUBLICAS_CSS}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
        <MundialIcon width={60} height={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
            Respuestas de participantes — {torneo?.nombre}
          </h1>
          {visible && (
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
              <strong>{preguntas.length}</strong> pregunta{preguntas.length !== 1 ? 's' : ''} activa{preguntas.length !== 1 ? 's' : ''}
              {' · '}
              <strong>{participantes.length}</strong> participante{participantes.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        <Link to={`/mundial/${torneoId}`} className="btn btn-secondary btn-sm">
          ← Mis respuestas
        </Link>
      </div>

      {/* Bloqueo + (si admin) tabla de seguimiento operativo.
          La presencia de `data.seguimiento` es la señal canónica: si el
          backend lo manda, es porque el requester es admin/superadmin
          (lookup en DB, no JWT). No reimplementamos la decisión acá. */}
      {!visible && Array.isArray(data?.seguimiento) && (
        <SeguimientoAdminTable
          seguimiento={data.seguimiento}
          total={data.total_preguntas || 0}
          mensaje={data.mensaje}
        />
      )}
      {!visible && !Array.isArray(data?.seguimiento) && (
        <div style={{
          padding: '16px 18px', textAlign: 'center',
          background: 'rgba(234,179,8,0.12)', color: '#a16207',
          borderRadius: 8, fontSize: 14, lineHeight: 1.5,
          border: '1px solid rgba(234,179,8,0.30)',
        }}>
          ⏳ {data?.mensaje || 'Las respuestas de otros participantes estarán disponibles cuando cierre la carga.'}
        </div>
      )}

      {/* Empty: visible pero sin preguntas activas */}
      {visible && preguntas.length === 0 && (
        <div style={{
          padding: '16px 18px', textAlign: 'center',
          background: 'rgba(0,0,0,0.04)', color: 'var(--color-muted)',
          borderRadius: 8, fontSize: 14,
        }}>
          No hay preguntas activas en este torneo.
        </div>
      )}

      {/* Empty: visible, hay preguntas, pero nadie respondió todavía */}
      {visible && preguntas.length > 0 && participantes.length === 0 && (
        <div style={{
          padding: '16px 18px', textAlign: 'center',
          background: 'rgba(0,0,0,0.04)', color: 'var(--color-muted)',
          borderRadius: 8, fontSize: 14,
        }}>
          Sin respuestas cargadas todavía.
        </div>
      )}

      {/* Matriz comparativa */}
      {visible && preguntas.length > 0 && participantes.length > 0 && (
        <div className="rp-scroll">
          <table className="rp-matrix">
            <thead>
              <tr>
                <th className="rp-corner">Pregunta</th>
                {participantes.map(part => {
                  const esYo = user && part.user_id === user.id
                  const pts  = Number.isInteger(part.puntos_totales) ? part.puntos_totales : null
                  return (
                    <th
                      key={part.user_id}
                      className={esYo ? 'rp-head--self' : undefined}
                    >
                      <span className="rp-head-name">
                        {part.nombre}
                        {esYo && <span className="rp-vos">vos</span>}
                      </span>
                      <span className="rp-head-pts">
                        {pts !== null ? `${pts} pts` : '—'}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {preguntas.map(p => {
                const displayText = enunciadoDisplay(p.numero, p.enunciado)
                const truncado    = displayText !== p.enunciado
                return (
                <tr key={p.id}>
                  <th
                    scope="row"
                    title={truncado ? p.enunciado : undefined}
                  >
                    <span className="rp-q-num">#{p.numero}</span>
                    <span className="rp-q-text" title={truncado ? undefined : p.enunciado}>
                      {displayText}
                    </span>
                  </th>
                  {participantes.map(part => {
                    const esYo = user && part.user_id === user.id
                    const cell = celdaIndex.get(p.id)?.get(part.user_id)
                    // Usuario sin respuesta para esta pregunta → "—" muted.
                    if (!cell) {
                      return (
                        <td
                          key={part.user_id}
                          className={esYo ? 'rp-cell--self' : undefined}
                        >
                          <div className="rp-cell-content">{missingNode()}</div>
                        </td>
                      )
                    }
                    // Decisión de render del cuerpo de la celda:
                    // - multi_equipo con detalle_items → chips por equipo (color del backend).
                    // - resto → fmtRespuesta texto plano.
                    const usarChips = p.tipo_pregunta === 'multi_equipo'
                      && Array.isArray(cell.detalle_items)
                      && cell.detalle_items.length > 0
                    return (
                      <td
                        key={part.user_id}
                        className={esYo ? 'rp-cell--self' : undefined}
                      >
                        <div className="rp-cell-content">
                          {usarChips
                            ? renderChipsMulti(cell.detalle_items)
                            : fmtRespuesta(p.tipo_pregunta, cell.respuesta_json)}
                        </div>
                        {renderEstado(cell)}
                      </td>
                    )
                  })}
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// SeguimientoAdminTable — Mini-fase "seguimiento admin carga abierta"
//
// Tabla operativa para admin/superadmin mientras la carga sigue abierta.
// NO muestra respuestas — solo conteo + estado + última actualización por
// participante. Backend valida el rol y filtra `respuesta_json` antes de
// llegar acá: el frontend solo decide cómo mostrar el payload.
// ─────────────────────────────────────────────────────────────────────────
function SeguimientoAdminTable({ seguimiento, total, mensaje }) {
  return (
    <div>
      {/* Banner contextual: deja claro por qué estoy viendo esto. */}
      <div style={{
        padding: '10px 14px', marginBottom: 12,
        background: 'rgba(99,102,241,0.08)', color: '#4338ca',
        borderRadius: 8, fontSize: 13, lineHeight: 1.5,
        border: '1px solid rgba(99,102,241,0.25)',
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>🛠️</span>
        <div style={{ flex: 1 }}>
          <strong>Vista admin · carga en curso.</strong>{' '}
          Seguimiento por participante. Las respuestas se mantienen ocultas
          hasta que cierre la carga.
          {mensaje && (
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
              {mensaje}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--color-surface2, #f1f3f5)' }}>
              <th style={segTh}>Participante</th>
              <th style={{ ...segTh, textAlign: 'right' }}>Respondidas</th>
              <th style={{ ...segTh, textAlign: 'right' }}>Faltan</th>
              <th style={segTh}>% completado</th>
              <th style={{ ...segTh, textAlign: 'center' }}>Estado</th>
              <th style={{ ...segTh, textAlign: 'right' }}>Última actualización</th>
            </tr>
          </thead>
          <tbody>
            {seguimiento.length === 0 && (
              <tr>
                <td colSpan={6} style={{
                  padding: '20px', textAlign: 'center',
                  color: 'var(--color-muted)', fontSize: 13,
                }}>
                  Sin participantes asignados al torneo todavía.
                </td>
              </tr>
            )}
            {seguimiento.map(s => (
              <tr key={s.user_id} style={{ borderTop: '1px solid var(--color-border)' }}>
                <td style={segTd}>
                  {s.nombre || `Usuario ${s.user_id}`}
                </td>
                <td style={{ ...segTd, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  <strong>{s.respondidas}</strong>
                  <span style={{ color: 'var(--color-muted)' }}>/{total}</span>
                </td>
                <td style={{ ...segTd, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: s.faltan === 0 ? 'var(--color-success)' : 'var(--color-text)' }}>
                  {s.faltan}
                </td>
                <td style={segTd}>
                  <ProgresoBarra pct={s.porcentaje} estado={s.estado} />
                </td>
                <td style={{ ...segTd, textAlign: 'center' }}>
                  <BadgeEstadoSeg estado={s.estado} />
                </td>
                <td style={{ ...segTd, textAlign: 'right', color: 'var(--color-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {fmtUltimaAct(s.ultima_actualizacion)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Barra de progreso simple: ancho proporcional al %.
// Color del relleno: completo verde, sin_empezar gris, resto azul.
function ProgresoBarra({ pct, estado }) {
  const clamped = Math.max(0, Math.min(100, Number.isInteger(pct) ? pct : 0))
  const color = estado === 'completo'    ? 'var(--color-success)'
              : estado === 'sin_empezar' ? '#9ca3af'
              : 'var(--color-primary)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        flex: 1, minWidth: 60, maxWidth: 160, height: 6,
        background: 'rgba(0,0,0,0.06)',
        borderRadius: 99, overflow: 'hidden',
      }}>
        <div style={{
          width: `${clamped}%`, height: '100%',
          background: color,
          transition: 'width 0.2s ease',
        }} />
      </div>
      <span style={{
        fontSize: 12, color: 'var(--color-muted)',
        fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'right',
      }}>
        {clamped}%
      </span>
    </div>
  )
}

// Badge por estado. Mismo set de colores que la matriz corregida.
function BadgeEstadoSeg({ estado }) {
  const cfg = (
    estado === 'completo'    ? { label: 'Completo',    fg: 'var(--color-success)', bg: 'rgba(22,163,74,0.12)' } :
    estado === 'incompleto'  ? { label: 'Incompleto',  fg: 'var(--color-primary)', bg: 'rgba(59,130,246,0.12)' } :
    estado === 'sin_empezar' ? { label: 'Sin empezar', fg: '#b91c1c',              bg: 'rgba(220,38,38,0.08)' } :
                               { label: estado || '?', fg: 'var(--color-muted)',   bg: 'rgba(0,0,0,0.04)' }
  )
  return (
    <span style={{
      fontSize: 10, fontWeight: 700,
      padding: '3px 8px', borderRadius: 4,
      color: cfg.fg, background: cfg.bg,
      textTransform: 'uppercase', letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

// Formato legible para datetime SQLite ('YYYY-MM-DD HH:MM:SS' en UTC).
// Devuelve 'DD/MM HH:mm' en horario local, o '—' si null/inválido.
function fmtUltimaAct(s) {
  if (!s) return '—'
  // SQLite datetime('now') retorna UTC. Forzamos la 'Z' para que el motor
  // de fechas del browser convierta correctamente a horario local del user.
  const iso = s.includes('T') ? s : s.replace(' ', 'T') + 'Z'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return s
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm} ${hh}:${mi}`
}

const segTh = {
  padding: '10px 12px', textAlign: 'left',
  fontSize: 11, fontWeight: 700, color: 'var(--color-muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '2px solid var(--color-border)',
  whiteSpace: 'nowrap',
}
const segTd = {
  padding: '10px 12px',
  fontSize: 13,
  verticalAlign: 'middle',
}
