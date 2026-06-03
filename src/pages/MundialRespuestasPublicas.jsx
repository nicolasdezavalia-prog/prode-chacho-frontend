/**
 * MundialRespuestasPublicas — Fase 3.4
 *
 * Vista social tipo matriz comparativa: una fila por pregunta, una columna
 * por participante, celda con la respuesta. Pensada para comparar de un
 * vistazo qué eligió cada uno.
 *
 * UX:
 *   - Card con scroll interno (horizontal + vertical) para no romper en mobile.
 *   - Header de participantes sticky top, columna de preguntas sticky left,
 *     celda esquina sticky a ambos. Funciona dentro del scroll de la card.
 *   - Columna del usuario actual resaltada (fondo azul suave + badge "vos").
 *   - Equipos: 🇦🇷 Argentina (emoji + nombre). Si no hay emoji → solo nombre.
 *     Si no se encuentra en catálogo → código como fallback.
 *   - Multi-equipo: lista coma-separada.
 *   - Sin respuesta: "—" gris.
 *
 * Solo lee endpoints existentes — sin cambios en backend, scoring, ranking,
 * carga, ni resultados.
 */

import { useEffect, useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/index.js'
import { useAuth } from '../App.jsx'
import MundialIcon from '../components/MundialIcon.jsx'

/**
 * CSS scoped a esta página. Prefijo `rp-` para evitar colisiones.
 *
 * Sticky:
 *   - Para que `position: sticky` funcione en thead Y en la primera columna
 *     simultáneamente, el contenedor scrollable debe tener overflow en ambos
 *     ejes. Por eso la card tiene `max-height: 80vh` + `overflow: auto`.
 *   - thead th: sticky top.
 *   - tbody tr > :first-child: sticky left.
 *   - thead th:first-child (corner): sticky top+left con z-index mayor.
 *   - z-index: corner(3) > thead(2) > primera col(1) > celdas regulares.
 */
/**
 * Versiones cortas para preguntas largas (Fase 3.4c). Display-only; el
 * enunciado real en el backend no se toca. Si una pregunta no está acá,
 * se muestra el enunciado completo. Generic fallback: line-clamp 2 líneas
 * con title attribute como tooltip de respaldo.
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
  z-index: 2;
  background: var(--color-surface2, #f8f9fa);
  font-weight: 600;
  font-size: 12px;
  white-space: nowrap;
  border-bottom: 2px solid var(--color-border);
  color: var(--color-text);
  text-align: center;
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
  z-index: 3 !important;
  background: var(--color-surface2, #f8f9fa) !important;
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
  /* Line-clamp 2 líneas como fallback genérico para preguntas largas
     que no tienen versión corta hardcoded. El title attribute provee el
     enunciado completo en hover. */
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
  max-width: 180px;
  word-break: normal;
  overflow-wrap: break-word;
  text-align: center;
}
.rp-head--self {
  background: rgba(59,130,246,0.14) !important;
  color: var(--color-text);
}
.rp-cell--self {
  background: rgba(59,130,246,0.05) !important;
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
  .rp-matrix tbody th { min-width: 160px; max-width: 200px; }
  .rp-cell-content { max-width: 140px; }
  .rp-q-num { padding: 1px 6px; margin-right: 4px; }
}
`

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
   * Formato pedido (Fase 3.4):
   *   - emoji + nombre  → '🇦🇷 Argentina'
   *   - sin emoji       → 'Argentina'
   *   - no en catálogo  → código crudo (fallback)
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
   * IMPORTANTE: todos los hooks deben ir antes de cualquier early return
   * (loading/error). React falla con "Rendered more hooks than during the
   * previous render" si el orden de hooks varía entre renders.
   * Por eso `preguntas`, `participantes` y `respuestasIndex` se calculan
   * acá con defaults seguros (data puede ser null mientras loading=true).
   */

  const preguntas = Array.isArray(data?.preguntas) ? data.preguntas : []

  /**
   * Unión de participantes a través de todas las preguntas. Algunos pueden
   * haber respondido solo algunas, así que tomamos la unión y los ordenamos
   * alfabéticamente. La columna del user actual se promueve a la primera
   * posición (después de "Pregunta") para que sea más fácil de comparar.
   */
  const participantes = useMemo(() => {
    const map = new Map() // user_id → nombre
    for (const p of preguntas) {
      for (const r of (p.respuestas || [])) {
        if (!map.has(r.user_id)) {
          map.set(r.user_id, r.nombre || `Usuario ${r.user_id}`)
        }
      }
    }
    const arr = [...map.entries()].map(([user_id, nombre]) => ({ user_id, nombre }))
    arr.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }))
    // Promover al user actual a la primera posición si está en la lista.
    if (user && arr.some(p => p.user_id === user.id)) {
      const yo = arr.find(p => p.user_id === user.id)
      const resto = arr.filter(p => p.user_id !== user.id)
      return [yo, ...resto]
    }
    return arr
  }, [preguntas, user])

  // Index { pregunta_id → { user_id → respuesta_json } } para lookup O(1) por celda.
  const respuestasIndex = useMemo(() => {
    const m = new Map()
    for (const p of preguntas) {
      const inner = new Map()
      for (const r of (p.respuestas || [])) inner.set(r.user_id, r.respuesta_json)
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

      {/* Bloqueo (estado abierto + deadline ok) */}
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
                  return (
                    <th
                      key={part.user_id}
                      className={esYo ? 'rp-head--self' : undefined}
                    >
                      {part.nombre}
                      {esYo && <span className="rp-vos">vos</span>}
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
                    const respJson = respuestasIndex.get(p.id)?.get(part.user_id)
                    return (
                      <td
                        key={part.user_id}
                        className={esYo ? 'rp-cell--self' : undefined}
                      >
                        <div className="rp-cell-content">
                          {fmtRespuesta(p.tipo_pregunta, respJson)}
                        </div>
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
