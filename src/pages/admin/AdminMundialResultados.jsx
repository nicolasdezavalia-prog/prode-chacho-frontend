/**
 * AdminMundialResultados — Fase 3
 *
 * Tab Resultados del AdminMundialHub.
 *
 * Props:
 *   torneoId  — id del torneo Mundial.
 *   estado    — estado actual del torneo (de mundial_config).
 *   onChanged — callback opcional (no usado por ahora, reservado).
 *
 * UX MVP:
 *   - Una card por pregunta con su MundialResultadoInput.
 *   - "Guardar" por card (POST individual). Sin bulk para MVP.
 *   - "Borrar" si ya hay resultado cargado.
 *   - Contador "X de Y cargados" arriba.
 *   - Política backend: solo se puede cargar/borrar si estado >= 'grupos_jugados'.
 *     El componente muestra un banner si el estado no lo permite y deshabilita
 *     todos los inputs.
 *
 * Sin scoring preview, sin "ver pts esperados" — el ranking se ve en su
 * propia página y mis-puntos del user en /mundial/:id.
 */

import { useEffect, useState, useMemo } from 'react'
import { api } from '../../api/index.js'
import MundialResultadoInput, { normalizarTextoUX } from '../../components/MundialResultadoInput.jsx'

const ESTADOS_EDITABLES = new Set([
  'grupos_jugados', 'cambios_abiertos', 'cambios_cerrados', 'resultados', 'finalizado',
])

// Tipos que necesitan fetch de respuestas-por-pregunta para mostrar la tabla
// de overrides en el editor admin (Fase 3.1 + 3.2).
// Incluye equipo_categoria SOLO si el config tiene scoring_manual:true.
function preguntaNecesitaRespuestas(p) {
  if (!p) return false
  if (p.tipo_pregunta === 'respuesta_manual') return true
  if (p.tipo_pregunta === 'regla_especial')   return true
  if (p.tipo_pregunta === 'equipo_categoria') {
    let cfg = {}
    try { cfg = JSON.parse(p.config_json) || {} } catch { /* deja {} */ }
    return cfg.scoring_manual === true
  }
  return false
}

const TIPO_LABEL = {
  opcion_unica:          'Opción única',
  equipo_categoria:      'Equipo (categorías)',
  instancia_eliminacion: 'Instancia de eliminación',
  numero_exacto:         'Número exacto',
  numero_por_banda:      'Número por banda',
  multi_equipo:          'Multi-equipo',
  respuesta_manual:      'Respuesta manual',
  regla_especial:        'Regla especial',
}

export default function AdminMundialResultados({ torneoId, estado }) {
  const editable = ESTADOS_EDITABLES.has(estado)

  const [preguntas, setPreguntas]           = useState([])
  const [resultados, setResultados]         = useState({})    // { pregunta_id: resultado_json (parseado) }
  const [equiposCatalogo, setEquiposCatalogo] = useState([])
  const [edicion, setEdicion]               = useState({})    // { pregunta_id: resultado_json en edición }
  // Fase 3.1 — respuestas de TODOS los users por pregunta texto. Lo carga
  // el admin para asignar overrides_pts a mano cuando el matching automático
  // no alcanza (ej: 'MESSI' vs 'L. MESSI' vs 'Lionel Messi').
  // Shape: { pregunta_id: [{ user_id, nombre, respuesta_json, updated_at }] }
  const [respuestasPorPregunta, setRespuestasPorPregunta] = useState({})
  const [savingId, setSavingId]             = useState(null)
  const [deletingId, setDeletingId]         = useState(null)
  const [error, setError]                   = useState('')
  const [info, setInfo]                     = useState('')
  const [loading, setLoading]               = useState(true)
  // Fase B — preview de impacto (dry-run backend, no guarda nada):
  // { preguntaId, data, confirmable } — confirmable=true cuando el preview es
  // el paso previo obligatorio a guardar (tipos texto).
  const [preview, setPreview]               = useState(null)
  const [previewingId, setPreviewingId]     = useState(null)
  // Sprint Final C7 — sugerencias calculadas (read-only). Map pregunta_id → sug.
  // Solo PRECARGAN el editor vía "Usar como resultado": nada se guarda hasta
  // pasar por Guardar → Preview → Confirmar (flujo existente, sin cambios).
  const [sugerencias, setSugerencias]       = useState(new Map())

  useEffect(() => { load() /* eslint-disable-next-line */ }, [torneoId, estado])

  async function load() {
    setLoading(true)
    setError(''); setInfo('')
    try {
      // Preguntas + equipos siempre se pueden leer (con sus permisos habituales).
      const [preg, equipos] = await Promise.all([
        api.getMundialPreguntasActivas(torneoId).catch(() => []),
        api.getMundialEquiposCatalogo(torneoId).catch(() => []),
      ])
      setPreguntas(Array.isArray(preg) ? preg : [])
      setEquiposCatalogo(Array.isArray(equipos) ? equipos : [])

      // Resultados: el backend devuelve 403 si estado < grupos_jugados.
      // Si pasa, los cargamos; sino, dejamos {} y el banner explica el porqué.
      if (editable) {
        const res = await api.getMundialResultados(torneoId).catch(() => [])
        const map = {}
        const edit = {}
        for (const r of (res || [])) {
          try {
            const parsed = JSON.parse(r.resultado_json)
            map[r.pregunta_id]  = parsed
            edit[r.pregunta_id] = parsed
          } catch { /* ignorar resultado malformado */ }
        }
        setResultados(map)
        setEdicion(edit)

        // Fetch en paralelo las respuestas para los tipos que usan tabla de overrides:
        //   - respuesta_manual / regla_especial (Fase 3.1)
        //   - equipo_categoria con scoring_manual: true (Fase 3.2)
        const preguntasConOverrides = (preg || []).filter(preguntaNecesitaRespuestas)
        const respMap = {}
        await Promise.all(preguntasConOverrides.map(async p => {
          const respList = await api.getMundialRespuestasPregunta(torneoId, p.id).catch(() => [])
          respMap[p.id] = Array.isArray(respList) ? respList : []
        }))
        setRespuestasPorPregunta(respMap)

        // C7: sugerencias calculadas (si falla, la pantalla sigue igual que antes).
        const sugs = await api.getMundialResultadosSugerencias(torneoId).catch(() => null)
        setSugerencias(new Map((sugs?.sugerencias || []).map(s => [s.pregunta_id, s])))
      } else {
        setResultados({})
        setEdicion({})
        setRespuestasPorPregunta({})
        setSugerencias(new Map())
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const cargados = useMemo(() => Object.keys(resultados).length, [resultados])
  const total    = preguntas.length

  function handleChange(preguntaId, nuevoResultado) {
    setEdicion(prev => ({ ...prev, [preguntaId]: nuevoResultado }))
  }

  // Fase B: tipos donde el preview es paso obligatorio antes de guardar
  // (texto libre — el guardado impacta el ranking al instante porque el
  // scoring es on-the-fly, así que el admin confirma viendo los deltas).
  function esTipoTexto(p) {
    return p?.tipo_pregunta === 'respuesta_manual' || p?.tipo_pregunta === 'regla_especial'
  }

  async function handlePreview(preguntaId, confirmable = false) {
    if (!editable || previewingId) return
    const resultado = edicion[preguntaId] || {}
    if (!resultado || Object.keys(resultado).length === 0) {
      setError('Cargá el resultado antes de pedir el preview.')
      return
    }
    setPreviewingId(preguntaId)
    setError(''); setInfo('')
    try {
      const data = await api.previewMundialResultado(torneoId, preguntaId, resultado)
      setPreview({ preguntaId, data, confirmable })
    } catch (e) {
      setError(e.message)
    } finally {
      setPreviewingId(null)
    }
  }

  async function guardarReal(preguntaId) {
    setSavingId(preguntaId)
    setError(''); setInfo('')
    try {
      const resultado = edicion[preguntaId] || {}
      await api.saveMundialResultado(torneoId, preguntaId, resultado)
      setInfo(`Resultado #${preguntas.find(p => p.id === preguntaId)?.numero} guardado.`)
      setPreview(null)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSavingId(null)
    }
  }

  async function handleSave(preguntaId) {
    if (!editable || savingId) return
    const resultado = edicion[preguntaId] || {}
    if (!resultado || Object.keys(resultado).length === 0) {
      setError('Cargá el resultado antes de guardar.')
      return
    }
    const p = preguntas.find(x => x.id === preguntaId)
    // Tipos texto: preview obligatorio → el guardado real sale del panel de preview.
    if (esTipoTexto(p)) {
      await handlePreview(preguntaId, true)
      return
    }
    await guardarReal(preguntaId)
  }

  async function handleDelete(preguntaId) {
    if (!editable || deletingId) return
    const p = preguntas.find(p => p.id === preguntaId)
    if (!confirm(`¿Borrar resultado de la pregunta #${p?.numero}?`)) return
    setDeletingId(preguntaId)
    setError(''); setInfo('')
    try {
      await api.deleteMundialResultado(torneoId, preguntaId)
      setInfo(`Resultado #${p?.numero} borrado.`)
      // Limpiar edición local también
      setEdicion(prev => {
        const next = { ...prev }
        delete next[preguntaId]
        return next
      })
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <div className="loading">Cargando...</div>

  return (
    <div>
      {!editable && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(234,179,8,0.12)',
          color: '#a16207',
          borderRadius: 8, marginBottom: 16, fontSize: 13, lineHeight: 1.45,
          border: '1px solid rgba(234,179,8,0.30)',
        }}>
          ⏳ La carga de resultados se habilita a partir del estado <strong>Grupos jugados</strong>.
          Estado actual: <strong>{estado}</strong>.
        </div>
      )}

      {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}
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

      <div style={{
        fontSize: 13, color: 'var(--color-muted)', marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <span><strong>{cargados}</strong> de <strong>{total}</strong> resultados cargados</span>
      </div>

      {preguntas.length === 0 ? (
        <div style={{
          padding: '32px 16px', textAlign: 'center',
          color: 'var(--color-muted)', fontSize: 14,
        }}>
          No hay preguntas activas en este torneo.
        </div>
      ) : (
        preguntas.map(p => {
          let cfg = null
          try { cfg = JSON.parse(p.config_json) } catch { cfg = {} }
          const tieneCargado = !!resultados[p.id]
          return (
            <div key={p.id} className="card" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--color-muted)',
                  background: 'rgba(0,0,0,0.06)', borderRadius: 99, padding: '2px 8px',
                }}>
                  #{p.numero}
                </span>
                {tieneCargado && (
                  <span title="Resultado cargado" style={{
                    color: 'var(--color-success)', fontSize: 14, fontWeight: 700, lineHeight: 1,
                  }}>✓</span>
                )}
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, flex: 1 }}>
                  {p.enunciado}
                </h3>
                <span style={{
                  fontSize: 11, color: 'var(--color-muted)',
                  background: 'rgba(0,0,0,0.04)', padding: '2px 8px', borderRadius: 4,
                  whiteSpace: 'nowrap',
                }}>
                  {TIPO_LABEL[p.tipo_pregunta] || p.tipo_pregunta}
                </span>
              </div>
              {p.aclaracion && (
                <div style={{
                  fontSize: 12, color: 'var(--color-muted)',
                  marginBottom: 12, fontStyle: 'italic',
                }}>
                  {p.aclaracion}
                </div>
              )}
              {sugerencias.has(p.id) && (
                <BloqueSugerencia
                  sug={sugerencias.get(p.id)}
                  editable={editable}
                  onUsar={(valor) => {
                    // COPIA al editor (merge: preserva overrides_pts u otras
                    // claves ya editadas). NO guarda: el admin después pasa
                    // por Guardar → Preview → Confirmar.
                    handleChange(p.id, { ...(edicion[p.id] || {}), ...valor })
                    setInfo(`Sugerencia copiada al editor de #${p.numero}. Revisá y guardá (pasa por preview).`)
                  }}
                />
              )}
              <MundialResultadoInput
                tipo={p.tipo_pregunta}
                configPregunta={cfg}
                equiposCatalogo={equiposCatalogo}
                valor={edicion[p.id]}
                onChange={nueva => handleChange(p.id, nueva)}
                disabled={!editable}
                respuestasUsuarios={respuestasPorPregunta[p.id]}
              />
              {esTipoTexto(p) && (
                <BloqueCanonizacion
                  torneoId={torneoId}
                  pregunta={p}
                  editable={editable}
                  onUsarComoResultado={(canonico, variantesNorm) => {
                    // Copia EXPLÍCITA al resultado en edición (capa B). No guarda:
                    // el admin después pasa por Guardar → preview obligatorio.
                    const actual = edicion[p.id] || {}
                    handleChange(p.id, {
                      ...actual,
                      texto: canonico,
                      texto_display: canonico,
                      alias: variantesNorm,
                    })
                    setInfo(`Canónica "${canonico}" copiada al resultado de #${p.numero}. Revisá y guardá (pasa por preview).`)
                  }}
                />
              )}
              {preview && preview.preguntaId === p.id && (
                <PreviewImpacto
                  data={preview.data}
                  confirmable={preview.confirmable && editable}
                  saving={savingId === p.id}
                  onConfirmar={() => guardarReal(p.id)}
                  onCerrar={() => setPreview(null)}
                />
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handlePreview(p.id, false)}
                  disabled={!editable || previewingId === p.id || savingId !== null || deletingId !== null}
                  title="Dry-run: muestra cómo quedaría la corrección sin guardar nada"
                >
                  {previewingId === p.id ? 'Calculando...' : '👁 Preview impacto'}
                </button>
                {tieneCargado && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleDelete(p.id)}
                    disabled={!editable || deletingId === p.id || savingId !== null}
                  >
                    {deletingId === p.id ? 'Borrando...' : 'Borrar'}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleSave(p.id)}
                  disabled={!editable || savingId === p.id || deletingId !== null || previewingId !== null}
                  title={esTipoTexto(p) ? 'Abre el preview de impacto; el guardado se confirma desde ahí' : undefined}
                >
                  {savingId === p.id ? 'Guardando...' : (tieneCargado ? 'Actualizar' : 'Guardar')}
                </button>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ── Sprint Final C7: bloque de sugerencia calculada ─────────────────────────
// Solo PRESENTA el valor derivado y lo copia al editor con "Usar como
// resultado". Nunca guarda: el ranking no se mueve hasta que el admin pasa
// por Guardar → Preview impacto → Confirmar (flujo existente).
const FUENTE_LABEL = {
  fixture:              'Fixture / Stats',
  goleadores:           'Goleadores',
  premios_individuales: 'Premios individuales',
}

function BloqueSugerencia({ sug, editable, onUsar }) {
  const fuenteLabel = FUENTE_LABEL[sug.fuente] || sug.fuente
  return (
    <div style={{
      marginBottom: 10, padding: '8px 12px', borderRadius: 8, fontSize: 13,
      background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.25)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span>🧮 Valor calculado actual:{' '}
          <strong>{sug.requiere_decision ? '—' : sug.valor_display}</strong>
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
          Fuente: {fuenteLabel}
        </span>
        {!sug.completo && (
          <span style={{
            fontSize: 11, fontWeight: 600, color: '#a16207',
            background: 'rgba(234,179,8,0.15)', padding: '2px 8px', borderRadius: 99,
          }}>
            ⚠ dato incompleto / provisorio
          </span>
        )}
        <span style={{ flex: 1 }} />
        {!sug.requiere_decision && sug.valor && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 11 }}
            disabled={!editable}
            title="Copia el valor al editor de resultado. NO guarda: después pasás por Guardar → Preview."
            onClick={() => onUsar(sug.valor)}
          >
            Usar como resultado
          </button>
        )}
      </div>
      {sug.detalle && (
        <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>
          {sug.detalle}
        </div>
      )}
      {sug.requiere_decision && Array.isArray(sug.candidatos) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          {sug.candidatos.map((c, i) => (
            <button
              key={i}
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 11 }}
              disabled={!editable}
              title="Empate en el cálculo: elegí cuál usar (no guarda; pasa por preview)"
              onClick={() => onUsar(c.valor)}
            >
              Usar “{c.valor_display}”
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Fase B: panel de preview de impacto ─────────────────────────────────────
// Muestra el dry-run del backend: por usuario, respuesta original, canónica,
// tipo de match, pts actuales/nuevos y delta. La respuesta original SIEMPRE
// se muestra; la canonización aparece como "(tomado como X)".
const MATCH_STYLE = {
  exacto:      { label: 'exacto',      color: '#15803d', bg: 'rgba(22,163,74,0.10)' },
  normalizado: { label: 'normalizado', color: '#15803d', bg: 'rgba(22,163,74,0.10)' },
  alias:       { label: 'alias',       color: '#1d4ed8', bg: 'rgba(59,130,246,0.10)' },
  override:    { label: 'override',    color: '#7c3aed', bg: 'rgba(124,58,237,0.10)' },
  correcto:    { label: 'correcto',    color: '#15803d', bg: 'rgba(22,163,74,0.10)' },
  sin_match:   { label: 'sin match',   color: '#a16207', bg: 'rgba(234,179,8,0.12)' },
}

function formatRespuestaOriginal(respObj) {
  if (!respObj || Object.keys(respObj).length === 0) return '(vacío)'
  if (typeof respObj.texto === 'string') return respObj.texto || '(vacío)'
  if (typeof respObj.equipo === 'string') return respObj.equipo
  if (Array.isArray(respObj.equipos)) return respObj.equipos.join(', ')
  if (respObj.numero !== undefined) return String(respObj.numero)
  if (respObj.opcion !== undefined) return String(respObj.opcion)
  if (respObj.instancia !== undefined) return String(respObj.instancia)
  return JSON.stringify(respObj)
}

function PreviewImpacto({ data, confirmable, saving, onConfirmar, onCerrar }) {
  if (!data) return null
  const items = Array.isArray(data.items) ? data.items : []
  const resumen = data.resumen || {}
  const thp = { padding: '6px 8px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }
  const tdp = { padding: '6px 8px', verticalAlign: 'middle' }
  return (
    <div style={{
      marginTop: 12, border: '1px solid var(--color-border)', borderRadius: 8,
      background: 'rgba(0,0,0,0.02)', padding: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 13 }}>👁 Preview de impacto</strong>
        <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
          {resumen.total_respuestas ?? items.length} respuestas ·{' '}
          {resumen.usuarios_con_delta ?? 0} con cambio de puntos ·{' '}
          {data.hay_resultado_guardado ? 'comparado contra el resultado guardado' : 'sin resultado previo (pts actuales = —)'}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--color-muted)', fontStyle: 'italic' }}>
          Dry-run: nada guardado todavía
        </span>
      </div>
      <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 6, background: 'white' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.03)' }}>
              <th style={thp}>Usuario</th>
              <th style={thp}>Respuesta</th>
              <th style={thp}>Match</th>
              <th style={{ ...thp, textAlign: 'right' }}>Pts actuales</th>
              <th style={{ ...thp, textAlign: 'right' }}>Pts nuevos</th>
              <th style={{ ...thp, textAlign: 'right' }}>Δ</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => {
              const ms = MATCH_STYLE[it.match] || MATCH_STYLE.sin_match
              const original = formatRespuestaOriginal(it.respuesta_original)
              const tomadoComo = (it.match === 'alias' || it.match === 'normalizado') && it.respuesta_canonica
                ? it.respuesta_canonica : null
              const delta = it.delta || 0
              return (
                <tr key={it.user_id} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td style={tdp}>{it.nombre || `Usuario ${it.user_id}`}</td>
                  <td style={{ ...tdp, fontFamily: 'monospace', fontSize: 12 }}>
                    {original}
                    {tomadoComo && (
                      <span style={{ color: 'var(--color-muted)', fontFamily: 'inherit' }}>
                        {' '}(tomado como <strong>{tomadoComo}</strong>)
                      </span>
                    )}
                  </td>
                  <td style={tdp}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: ms.color, background: ms.bg,
                      padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap',
                    }}>
                      {ms.label}
                    </span>
                  </td>
                  <td style={{ ...tdp, textAlign: 'right', color: 'var(--color-muted)' }}>
                    {it.pts_actuales === null || it.pts_actuales === undefined ? '—' : it.pts_actuales}
                  </td>
                  <td style={{ ...tdp, textAlign: 'right', fontWeight: 600 }}>{it.pts_nuevos}</td>
                  <td style={{
                    ...tdp, textAlign: 'right', fontWeight: 700,
                    color: delta > 0 ? '#15803d' : delta < 0 ? '#b91c1c' : 'var(--color-muted)',
                  }}>
                    {delta > 0 ? `+${delta}` : delta}
                  </td>
                </tr>
              )
            })}
            {items.length === 0 && (
              <tr><td colSpan={6} style={{ ...tdp, color: 'var(--color-muted)', fontStyle: 'italic' }}>
                Sin respuestas cargadas en esta pregunta.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCerrar} disabled={saving}>
          {confirmable ? 'Cancelar' : 'Cerrar'}
        </button>
        {confirmable && (
          <button type="button" className="btn btn-primary btn-sm" onClick={onConfirmar} disabled={saving}>
            {saving ? 'Guardando...' : '✓ Confirmar y guardar'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Fase B2: Canonización de respuestas (capa A — visual/preparatoria) ──────
// Agrupa variantes equivalentes ANTES de que exista resultado. NO puntúa, NO
// define ganador, NO toca respuestas ni ranking. Disponible desde el cierre de
// carga (el backend gatea); independiente del gate de carga de resultados.
// "→ Usar como resultado" solo COPIA canonico+variantes al editor del
// resultado (capa B): el guardado sigue pasando por el preview obligatorio.
function BloqueCanonizacion({ torneoId, pregunta, editable, onUsarComoResultado }) {
  const [data, setData]       = useState(null)
  const [noDisp, setNoDisp]   = useState('')   // motivo si el backend devuelve 403 (carga abierta)
  const [asig, setAsig]       = useState({})   // { variante_norm: canonico }
  const [dirty, setDirty]     = useState(false)
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState('')
  const [ok, setOk]           = useState('')
  const [abierto, setAbierto] = useState(false)

  useEffect(() => { cargar() /* eslint-disable-next-line */ }, [torneoId, pregunta.id])

  async function cargar() {
    setErr(''); setOk(''); setNoDisp('')
    try {
      const d = await api.getMundialCanonizacion(torneoId, pregunta.id)
      setData(d)
      const a = {}
      for (const v of (d.variantes || [])) a[v.variante_norm] = v.canonico || ''
      // Variantes del mapeo guardado que ya no aparecen en respuestas: no se pierden.
      for (const g of (d.grupos || [])) {
        for (const vn of (g.variantes_norm || [])) {
          if (!(vn in a)) a[vn] = g.canonico
        }
      }
      setAsig(a)
      setDirty(false)
    } catch (e) {
      setData(null)
      setNoDisp(e.message || 'Canonización no disponible todavía.')
    }
  }

  function setCanonico(norm, valor) {
    setAsig(prev => ({ ...prev, [norm]: valor }))
    setDirty(true)
    setOk('')
  }

  async function guardar() {
    setSaving(true); setErr(''); setOk('')
    try {
      // Armar grupos: canonico → [variantes]. Vacío = sin grupo (no se manda).
      const porCanonico = new Map()
      for (const [norm, canonico] of Object.entries(asig)) {
        const c = (canonico || '').trim()
        if (!c) continue
        if (!porCanonico.has(c)) porCanonico.set(c, [])
        porCanonico.get(c).push(norm)
      }
      const grupos = [...porCanonico.entries()].map(([canonico, variantes]) => ({ canonico, variantes }))
      await api.saveMundialCanonizacion(torneoId, pregunta.id, grupos)
      setOk('Canonización guardada. No afecta puntos ni resultado.')
      await cargar()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  // Resumen para el header colapsado
  const variantes = data?.variantes || []
  const nAgrupadas = variantes.filter(v => (asig[v.variante_norm] || '').trim()).length
  const canonicasUnicas = [...new Set(Object.values(asig).map(c => (c || '').trim()).filter(Boolean))]

  return (
    <div style={{
      marginTop: 10, marginBottom: 10, border: '1px dashed var(--color-border)',
      borderRadius: 8, background: 'rgba(99,102,241,0.03)',
    }}>
      <button
        type="button"
        onClick={() => setAbierto(a => !a)}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none',
          cursor: 'pointer', padding: '8px 12px', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        <span>{abierto ? '▾' : '▸'}</span>
        <strong>Canonización de respuestas</strong>
        <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>
          {noDisp
            ? 'no disponible todavía'
            : `${variantes.length} variantes · ${nAgrupadas} agrupadas · ${canonicasUnicas.length} canónicas`}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--color-muted)', fontStyle: 'italic' }}>
          no puntúa · no define resultado
        </span>
      </button>

      {abierto && (
        <div style={{ padding: '0 12px 12px' }}>
          {noDisp && (
            <div style={{ fontSize: 12, color: 'var(--color-muted)', padding: '4px 0 8px' }}>
              {noDisp}
            </div>
          )}
          {err && <div className="error-msg" style={{ marginBottom: 8 }}>{err}</div>}
          {ok && (
            <div style={{
              padding: '6px 10px', background: 'rgba(22,163,74,0.10)',
              color: 'var(--color-success)', borderRadius: 6, marginBottom: 8, fontSize: 12,
            }}>{ok}</div>
          )}

          {data && variantes.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--color-muted)', fontStyle: 'italic' }}>
              Sin respuestas de texto cargadas todavía.
            </div>
          )}

          {data && variantes.length > 0 && (
            <>
              <datalist id={`canonicas-${pregunta.id}`}>
                {canonicasUnicas.map(c => <option key={c} value={c} />)}
              </datalist>
              <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 6, background: 'white' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.03)' }}>
                      <th style={canonTh}>Respuesta (original)</th>
                      <th style={canonTh}>Cant.</th>
                      <th style={canonTh}>Usuarios</th>
                      <th style={canonTh}>Agrupar como (canónica)</th>
                      <th style={canonTh}>Vista</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variantes.map(v => {
                      const canonico = asig[v.variante_norm] || ''
                      const esLaCanonica = canonico &&
                        normalizarTextoUX(canonico) === v.variante_norm
                      return (
                        <tr key={v.variante_norm} style={{ borderTop: '1px solid var(--color-border)' }}>
                          <td style={{ ...canonTd, fontFamily: 'monospace', fontSize: 12 }}>
                            {(v.ejemplos || []).join(' | ')}
                          </td>
                          <td style={canonTd}>{v.cantidad}</td>
                          <td style={{ ...canonTd, fontSize: 12, color: 'var(--color-muted)' }}>
                            {(v.usuarios || []).join(', ')}
                          </td>
                          <td style={canonTd}>
                            <input
                              type="text"
                              list={`canonicas-${pregunta.id}`}
                              value={canonico}
                              onChange={e => setCanonico(v.variante_norm, e.target.value)}
                              placeholder="— sin agrupar —"
                              style={{
                                width: '100%', minWidth: 140, padding: '4px 8px',
                                border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 12,
                              }}
                            />
                          </td>
                          <td style={{ ...canonTd, fontSize: 12, color: 'var(--color-muted)' }}>
                            {canonico.trim() && !esLaCanonica
                              ? <>{(v.ejemplos || [])[0]} <em>(agrupado como <strong>{canonico.trim()}</strong>)</em></>
                              : (v.ejemplos || [])[0]}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {canonicasUnicas.map(c => {
                  const variantesDelGrupo = Object.entries(asig)
                    .filter(([, can]) => (can || '').trim() === c)
                    .map(([norm]) => norm)
                    .filter(norm => norm !== normalizarTextoUX(c))
                  return (
                    <button
                      key={c}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11 }}
                      disabled={!editable || dirty}
                      title={!editable
                        ? 'La carga de resultados se habilita a partir de Grupos jugados'
                        : (dirty ? 'Guardá la canonización primero' : `Copia "${c}" + ${variantesDelGrupo.length} variantes al editor del resultado (no guarda: pasa por preview)`)}
                      onClick={() => onUsarComoResultado(c, variantesDelGrupo)}
                    >
                      → Usar “{c}” como resultado
                    </button>
                  )
                })}
                <span style={{ flex: 1 }} />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={guardar}
                  disabled={saving || !dirty}
                >
                  {saving ? 'Guardando...' : 'Guardar canonización'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

const canonTh = {
  padding: '6px 8px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  color: 'var(--color-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap',
}
const canonTd = { padding: '6px 8px', verticalAlign: 'middle' }
