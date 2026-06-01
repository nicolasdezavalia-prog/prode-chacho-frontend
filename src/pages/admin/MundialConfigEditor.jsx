/**
 * MundialConfigEditor — Fase 2.2
 *
 * Editor estructurado de `config_json` según `tipo_pregunta`.
 *
 * Props:
 *   tipo      — string, uno de los 8 tipos válidos.
 *   config    — objeto (parseado) con la config actual.
 *   onChange  — (nuevaConfig) => void. Se llama con un nuevo objeto en cada edit.
 *   disabled  — bool. Si true, todos los inputs quedan readonly.
 *
 * Filosofía: funcional antes que perfecta. Estructura mínima para que el admin
 * pueda armar la pregunta sin escribir JSON. Si algo falla la validación strict
 * del backend, el banner del parent muestra el mensaje.
 *
 * Para `regla_especial` se usa textarea JSON (escape hatch documentado).
 */

import { useState } from 'react'

// ── Plantillas por defecto ──────────────────────────────────────────────────
// Usadas cuando el admin crea una pregunta nueva y elige tipo: se prepara una
// config válida mínima que pasa la validación strict del backend.
export const PLANTILLAS_CONFIG = {
  opcion_unica:          () => ({ opciones: ['Sí', 'No'], pts: 10 }),
  equipo_categoria:      () => ({ categorias: [
                                    { label: 'top', equipos: [], pts: 50 },
                                    { label: 'otro', pts: 100, default: true },
                                ] }),
  instancia_eliminacion: () => ({
                            equipo: '',
                            instancias: ['Grupos', '16°', '8°', '4°', 'Semis', 'Final'],
                            pts_por_instancia: { 'Grupos': 50, '16°': 40, '8°': 30, '4°': 20, 'Semis': 30, 'Final': 30 },
                          }),
  numero_exacto:         () => ({ pts_si_acierta: 10, pts_si_no_acierta: 0 }),
  numero_por_banda:      () => ({ bandas: [
                                    { min: 0, max: 2, pts: 10 },
                                    { min: 3, pts: 25 },
                                ] }),
  multi_equipo:          () => ({ n_equipos: 8, pts_por_acierto: 10 }),
  respuesta_manual:      () => ({ pts_max: 25, instrucciones: '' }),
  regla_especial:        () => ({ scoring_manual: true, descripcion: '' }),
}

// Etiquetas para el dropdown de tipo
export const TIPO_LABEL = {
  opcion_unica:          'Opción única',
  equipo_categoria:      'Equipo por categoría',
  instancia_eliminacion: 'Instancia de eliminación',
  numero_exacto:         'Número exacto',
  numero_por_banda:      'Número por banda',
  multi_equipo:          'Multi-equipo',
  respuesta_manual:      'Respuesta manual',
  regla_especial:        'Regla especial (uso avanzado)',
}

const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', display: 'block', marginBottom: 4 }
const inputBase  = { padding: '6px 10px', fontSize: 13, border: '1px solid var(--color-border)', borderRadius: 6, outline: 'none', background: 'white' }
const fieldset   = { padding: 10, border: '1px solid var(--color-border)', borderRadius: 6, marginBottom: 10, background: 'rgba(0,0,0,0.015)' }
const btnXs      = { fontSize: 11, padding: '3px 8px', cursor: 'pointer' }

// Helper: forzar entero ≥ 0, o null
const toIntPos = (v) => {
  if (v === '' || v === null || v === undefined) return ''
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : ''
}

export default function MundialConfigEditor({ tipo, config, onChange, disabled, equiposCatalogo = [] }) {
  const Editor = EDITORES[tipo]
  if (!Editor) {
    return (
      <div style={{ padding: 10, color: 'var(--color-danger)', fontSize: 13 }}>
        Editor no disponible para tipo: <code>{tipo}</code>
      </div>
    )
  }
  return (
    <Editor
      config={config || PLANTILLAS_CONFIG[tipo]()}
      onChange={onChange}
      disabled={disabled}
      equiposCatalogo={equiposCatalogo}
    />
  )
}

// ── opcion_unica ────────────────────────────────────────────────────────────
function EditorOpcionUnica({ config, onChange, disabled }) {
  const opciones = Array.isArray(config.opciones) ? config.opciones : []
  const set = (patch) => onChange({ ...config, ...patch })
  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Puntos por acierto</label>
        <input
          type="number" min="0"
          value={config.pts ?? 0}
          onChange={e => set({ pts: toIntPos(e.target.value) })}
          disabled={disabled}
          style={{ ...inputBase, width: 120 }}
        />
      </div>
      <label style={labelStyle}>Opciones (una por línea)</label>
      <textarea
        rows={Math.max(3, opciones.length + 1)}
        value={opciones.join('\n')}
        onChange={e => set({ opciones: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
        disabled={disabled}
        style={{ ...inputBase, width: '100%', fontFamily: 'inherit', resize: 'vertical' }}
        placeholder={'Sí\nNo'}
      />
      <small style={{ color: 'var(--color-muted)', fontSize: 11 }}>
        {opciones.length} opción(es). Una por línea. Sin duplicados.
      </small>
    </div>
  )
}

// ── equipo_categoria ────────────────────────────────────────────────────────
// Selector asistido contra mundial_equipos_catalogo: dropdown + chips.
// - Cada categoria muestra sus equipos como chips (emoji + código + nombre).
// - El dropdown solo lista equipos NO usados en esta ni en otras categorías
//   (el backend rechaza códigos duplicados entre categorías con 400).
// - Si un código del config NO está en el catálogo (legacy / typo), el chip
//   se renderiza igual con marca visual amarilla.
function EditorEquipoCategoria({ config, onChange, disabled, equiposCatalogo = [] }) {
  const categorias = Array.isArray(config.categorias) ? config.categorias : []
  const setCat = (idx, patch) => {
    const next = categorias.map((c, i) => i === idx ? { ...c, ...patch } : c)
    onChange({ ...config, categorias: next })
  }
  const addCat = () => {
    onChange({ ...config, categorias: [...categorias, { label: 'nueva', equipos: [], pts: 0 }] })
  }
  const delCat = (idx) => {
    onChange({ ...config, categorias: categorias.filter((_, i) => i !== idx) })
  }

  const getInfo = (codigo) => equiposCatalogo.find(e => e.codigo === codigo)

  return (
    <div>
      {categorias.map((c, i) => {
        // Códigos ya usados en OTRAS categorías de esta misma pregunta
        const usadosEnOtras = new Set()
        categorias.forEach((cat, j) => {
          if (j !== i && Array.isArray(cat.equipos)) {
            cat.equipos.forEach(code => usadosEnOtras.add(code))
          }
        })
        const enEsta = new Set(c.equipos || [])
        const disponibles = (equiposCatalogo || []).filter(
          eq => !enEsta.has(eq.codigo) && !usadosEnOtras.has(eq.codigo)
        )

        return (
          <div key={i} style={fieldset}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px auto', gap: 8, alignItems: 'end' }}>
              <div>
                <label style={labelStyle}>Label</label>
                <input
                  value={c.label || ''}
                  onChange={e => setCat(i, { label: e.target.value })}
                  disabled={disabled}
                  style={{ ...inputBase, width: '100%' }}
                />
              </div>
              <div>
                <label style={labelStyle}>Pts</label>
                <input
                  type="number" min="0"
                  value={c.pts ?? 0}
                  onChange={e => setCat(i, { pts: toIntPos(e.target.value) })}
                  disabled={disabled}
                  style={{ ...inputBase, width: '100%' }}
                />
              </div>
              <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="checkbox"
                  checked={c.default === true}
                  onChange={e => {
                    if (e.target.checked) setCat(i, { default: true, equipos: undefined })
                    else                  setCat(i, { default: false, equipos: c.equipos || [] })
                  }}
                  disabled={disabled}
                />
                default
              </label>
              <button type="button" onClick={() => delCat(i)} disabled={disabled} className="btn btn-secondary btn-sm" style={btnXs}>
                🗑️
              </button>
            </div>
            {c.default !== true && (
              <div style={{ marginTop: 10 }}>
                <label style={labelStyle}>Equipos de esta categoría</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, minHeight: 28 }}>
                  {(c.equipos || []).length === 0 && (
                    <span style={{ fontSize: 12, color: 'var(--color-muted)', fontStyle: 'italic' }}>
                      Sin equipos. Elegí desde el dropdown.
                    </span>
                  )}
                  {(c.equipos || []).map(codigo => {
                    const info = getInfo(codigo)
                    const orfano = !info
                    return (
                      <span
                        key={codigo}
                        title={orfano ? 'Código no encontrado en el catálogo' : undefined}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '3px 4px 3px 10px', borderRadius: 99, fontSize: 12,
                          background: orfano ? 'rgba(234,179,8,0.15)' : 'rgba(99,102,241,0.10)',
                          color: orfano ? '#a16207' : 'var(--color-text)',
                          border: orfano ? '1px dashed #a16207' : '1px solid transparent',
                        }}
                      >
                        <span>{info?.emoji || '🏳️'}</span>
                        <strong>{codigo}</strong>
                        {info && <span style={{ color: 'var(--color-muted)' }}>— {info.nombre}</span>}
                        {!disabled && (
                          <button
                            type="button"
                            onClick={() => setCat(i, { equipos: (c.equipos || []).filter(x => x !== codigo) })}
                            title="Quitar"
                            style={{
                              background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer',
                              fontSize: 14, lineHeight: 1, padding: '2px 7px', marginLeft: 2,
                              borderRadius: 99, color: 'var(--color-muted)',
                            }}
                          >×</button>
                        )}
                      </span>
                    )
                  })}
                </div>
                <SelectorAgregarEquipo
                  disponibles={disponibles}
                  disabled={disabled}
                  totalCatalogo={equiposCatalogo.length}
                  onSelect={(codigo) => setCat(i, { equipos: [...(c.equipos || []), codigo] })}
                />
              </div>
            )}
          </div>
        )
      })}
      <button type="button" onClick={addCat} disabled={disabled} className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}>
        + Agregar categoría
      </button>
      <small style={{ display: 'block', marginTop: 6, color: 'var(--color-muted)', fontSize: 11 }}>
        Exactamente 1 categoría debe tener default ✓ (catch-all si no matchea ninguna otra).
        Los equipos ya elegidos en otra categoría no aparecen en el selector (el backend no acepta duplicados).
      </small>
    </div>
  )
}

// Helper reusable: dropdown de equipos disponibles + botón "Agregar".
function SelectorAgregarEquipo({ disponibles, disabled, onSelect, totalCatalogo }) {
  const [seleccionado, setSeleccionado] = useState('')
  const sinCatalogo = totalCatalogo === 0
  const sinDisponibles = !sinCatalogo && disponibles.length === 0

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <select
        value={seleccionado}
        onChange={e => setSeleccionado(e.target.value)}
        disabled={disabled || sinCatalogo || sinDisponibles}
        style={{ ...inputBase, flex: 1, maxWidth: 380 }}
      >
        <option value="">
          {sinCatalogo
            ? '— Cargá equipos en el catálogo primero —'
            : sinDisponibles
              ? '— No quedan equipos disponibles —'
              : '— Elegí un equipo —'}
        </option>
        {disponibles.map(eq => (
          <option key={eq.codigo} value={eq.codigo}>
            {eq.codigo} — {eq.nombre}{eq.grupo ? ` (Grupo ${eq.grupo})` : ''}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => { if (seleccionado) { onSelect(seleccionado); setSeleccionado('') } }}
        disabled={disabled || !seleccionado}
        className="btn btn-primary btn-sm"
        style={{ fontSize: 11 }}
      >
        + Agregar
      </button>
    </div>
  )
}

// ── instancia_eliminacion ───────────────────────────────────────────────────
// El campo `equipo` ahora es un dropdown contra mundial_equipos_catalogo.
// Si el valor actual no matchea ningún equipo del catálogo, se agrega como
// opción "huérfana" para que el admin pueda verla y reemplazarla.
function EditorInstanciaEliminacion({ config, onChange, disabled, equiposCatalogo = [] }) {
  const instancias = Array.isArray(config.instancias) ? config.instancias : []
  const pts = config.pts_por_instancia || {}

  const setInstancia = (idx, nuevoNombre) => {
    const viejoNombre = instancias[idx]
    const nuevasInstancias = [...instancias]
    nuevasInstancias[idx] = nuevoNombre
    const nuevoPts = { ...pts }
    if (viejoNombre in nuevoPts) {
      nuevoPts[nuevoNombre] = nuevoPts[viejoNombre]
      if (viejoNombre !== nuevoNombre) delete nuevoPts[viejoNombre]
    }
    onChange({ ...config, instancias: nuevasInstancias, pts_por_instancia: nuevoPts })
  }
  const setPts = (instancia, valor) => {
    onChange({ ...config, pts_por_instancia: { ...pts, [instancia]: toIntPos(valor) } })
  }
  const addInstancia = () => {
    const nuevo = 'Nueva'
    onChange({
      ...config,
      instancias: [...instancias, nuevo],
      pts_por_instancia: { ...pts, [nuevo]: 0 },
    })
  }
  const delInstancia = (idx) => {
    const viejo = instancias[idx]
    const nuevoPts = { ...pts }
    delete nuevoPts[viejo]
    onChange({
      ...config,
      instancias: instancias.filter((_, i) => i !== idx),
      pts_por_instancia: nuevoPts,
    })
  }

  const equipoActual = config.equipo || ''
  const enCatalogo = equiposCatalogo.find(eq => eq.codigo === equipoActual)
  const huerfano = equipoActual && !enCatalogo

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Equipo</label>
        <select
          value={equipoActual}
          onChange={e => onChange({ ...config, equipo: e.target.value })}
          disabled={disabled || equiposCatalogo.length === 0}
          style={{ ...inputBase, width: '100%', maxWidth: 380 }}
        >
          <option value="">
            {equiposCatalogo.length === 0
              ? '— Cargá equipos en el catálogo primero —'
              : '— Elegí un equipo —'}
          </option>
          {equiposCatalogo.map(eq => (
            <option key={eq.codigo} value={eq.codigo}>
              {eq.codigo} — {eq.nombre}{eq.grupo ? ` (Grupo ${eq.grupo})` : ''}
            </option>
          ))}
          {huerfano && (
            <option value={equipoActual}>
              {equipoActual} — (no en catálogo)
            </option>
          )}
        </select>
        {huerfano && (
          <div style={{ marginTop: 4, color: '#a16207', fontSize: 11 }}>
            ⚠️ El código <code>{equipoActual}</code> no está en el catálogo. Cuando se cargen respuestas (Fase 2.4) va a fallar la validación.
          </div>
        )}
      </div>
      <label style={labelStyle}>Instancias y puntos</label>
      <div style={fieldset}>
        {instancias.map((inst, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px auto', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <input
              value={inst}
              onChange={e => setInstancia(i, e.target.value)}
              disabled={disabled}
              style={{ ...inputBase, width: '100%' }}
            />
            <input
              type="number" min="0"
              value={pts[inst] ?? 0}
              onChange={e => setPts(inst, e.target.value)}
              disabled={disabled}
              style={{ ...inputBase, width: '100%' }}
            />
            <button type="button" onClick={() => delInstancia(i)} disabled={disabled} className="btn btn-secondary btn-sm" style={btnXs}>
              🗑️
            </button>
          </div>
        ))}
        <button type="button" onClick={addInstancia} disabled={disabled} className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}>
          + Agregar instancia
        </button>
      </div>
    </div>
  )
}

// ── numero_exacto ───────────────────────────────────────────────────────────
function EditorNumeroExacto({ config, onChange, disabled }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <div>
        <label style={labelStyle}>Pts si acierta exacto</label>
        <input
          type="number" min="0"
          value={config.pts_si_acierta ?? 0}
          onChange={e => onChange({ ...config, pts_si_acierta: toIntPos(e.target.value) })}
          disabled={disabled}
          style={{ ...inputBase, width: '100%' }}
        />
      </div>
      <div>
        <label style={labelStyle}>Pts si NO acierta (opcional, default 0)</label>
        <input
          type="number" min="0"
          value={config.pts_si_no_acierta ?? 0}
          onChange={e => onChange({ ...config, pts_si_no_acierta: toIntPos(e.target.value) })}
          disabled={disabled}
          style={{ ...inputBase, width: '100%' }}
        />
      </div>
    </div>
  )
}

// ── numero_por_banda ────────────────────────────────────────────────────────
function EditorNumeroPorBanda({ config, onChange, disabled }) {
  const bandas = Array.isArray(config.bandas) ? config.bandas : []
  const setBanda = (idx, patch) => {
    onChange({ ...config, bandas: bandas.map((b, i) => i === idx ? { ...b, ...patch } : b) })
  }
  const addBanda = () => {
    const ultima = bandas[bandas.length - 1]
    const nuevoMin = ultima && Number.isInteger(ultima.max) ? ultima.max + 1 : 0
    onChange({ ...config, bandas: [...bandas, { min: nuevoMin, pts: 0 }] })
  }
  const delBanda = (idx) => {
    onChange({ ...config, bandas: bandas.filter((_, i) => i !== idx) })
  }
  return (
    <div>
      <label style={labelStyle}>Bandas (rango continuo, sin huecos. Dejá `max` vacío para la banda abierta superior.)</label>
      {bandas.map((b, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 90px 1fr auto', gap: 8, marginBottom: 6, alignItems: 'center' }}>
          <div>
            <input
              type="number"
              value={b.min ?? 0}
              onChange={e => setBanda(i, { min: parseInt(e.target.value, 10) || 0 })}
              disabled={disabled}
              style={{ ...inputBase, width: '100%' }}
              placeholder="min"
            />
          </div>
          <div>
            <input
              type="number"
              value={b.max === undefined || b.max === null ? '' : b.max}
              onChange={e => {
                const v = e.target.value
                setBanda(i, v === '' ? { max: undefined } : { max: parseInt(v, 10) })
              }}
              disabled={disabled}
              style={{ ...inputBase, width: '100%' }}
              placeholder="max (vacío = ∞)"
            />
          </div>
          <div>
            <input
              type="number" min="0"
              value={b.pts ?? 0}
              onChange={e => setBanda(i, { pts: toIntPos(e.target.value) })}
              disabled={disabled}
              style={{ ...inputBase, width: '100%' }}
              placeholder="pts"
            />
          </div>
          <button type="button" onClick={() => delBanda(i)} disabled={disabled} className="btn btn-secondary btn-sm" style={btnXs}>
            🗑️
          </button>
        </div>
      ))}
      <button type="button" onClick={addBanda} disabled={disabled} className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}>
        + Agregar banda
      </button>
      <small style={{ display: 'block', marginTop: 6, color: 'var(--color-muted)', fontSize: 11 }}>
        Ejemplo: <code>{`{min: 0, max: 2}`}</code> + <code>{`{min: 3, max: vacío}`}</code> cubre todo desde 0 a ∞.
      </small>
    </div>
  )
}

// ── multi_equipo ────────────────────────────────────────────────────────────
function EditorMultiEquipo({ config, onChange, disabled }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <div>
        <label style={labelStyle}>Cantidad de equipos esperados (n_equipos)</label>
        <input
          type="number" min="1"
          value={config.n_equipos ?? 1}
          onChange={e => onChange({ ...config, n_equipos: toIntPos(e.target.value) })}
          disabled={disabled}
          style={{ ...inputBase, width: '100%' }}
        />
      </div>
      <div>
        <label style={labelStyle}>Pts por acierto</label>
        <input
          type="number" min="0"
          value={config.pts_por_acierto ?? 0}
          onChange={e => onChange({ ...config, pts_por_acierto: toIntPos(e.target.value) })}
          disabled={disabled}
          style={{ ...inputBase, width: '100%' }}
        />
      </div>
    </div>
  )
}

// ── respuesta_manual ────────────────────────────────────────────────────────
function EditorRespuestaManual({ config, onChange, disabled }) {
  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Pts máx que el admin puede asignar</label>
        <input
          type="number" min="0"
          value={config.pts_max ?? 0}
          onChange={e => onChange({ ...config, pts_max: toIntPos(e.target.value) })}
          disabled={disabled}
          style={{ ...inputBase, width: 120 }}
        />
      </div>
      <label style={labelStyle}>Instrucciones (opcional)</label>
      <textarea
        rows={3}
        value={config.instrucciones || ''}
        onChange={e => onChange({ ...config, instrucciones: e.target.value })}
        disabled={disabled}
        style={{ ...inputBase, width: '100%', fontFamily: 'inherit', resize: 'vertical' }}
        placeholder="Cómo va a evaluar el admin esta respuesta."
      />
    </div>
  )
}

// ── regla_especial ──────────────────────────────────────────────────────────
function EditorReglaEspecial({ config, onChange, disabled }) {
  // Editor mixto: descripcion estructurada + JSON crudo para el resto.
  // Si el usuario rompe el JSON, el banner del parent va a mostrar el 400.
  const [jsonRaw, setJsonRaw] = useState(() => JSON.stringify(config, null, 2))
  const [jsonError, setJsonError] = useState('')

  const tryParseAndPropagate = (txt) => {
    setJsonRaw(txt)
    try {
      const parsed = JSON.parse(txt)
      setJsonError('')
      // Forzar scoring_manual: true (escape hatch)
      onChange({ ...parsed, scoring_manual: true })
    } catch (e) {
      setJsonError(`JSON inválido: ${e.message}`)
    }
  }

  return (
    <div>
      <div style={{
        padding: '8px 10px', background: 'rgba(234,179,8,0.12)', color: '#a16207',
        borderRadius: 6, marginBottom: 10, fontSize: 12,
      }}>
        ⚠️ <strong>Uso avanzado.</strong> Escape hatch para reglas que no entran en los otros tipos.
        Backend exige <code>scoring_manual: true</code> + <code>descripcion</code> string. Scoring 100% manual del admin.
      </div>
      <label style={labelStyle}>Descripción (humana, obligatoria)</label>
      <input
        value={config.descripcion || ''}
        onChange={e => {
          const next = { ...config, descripcion: e.target.value, scoring_manual: true }
          onChange(next)
          setJsonRaw(JSON.stringify(next, null, 2))
          setJsonError('')
        }}
        disabled={disabled}
        style={{ ...inputBase, width: '100%', marginBottom: 10 }}
        placeholder="Cómo funciona esta regla y cómo se va a puntuar a mano."
      />
      <label style={labelStyle}>JSON completo (resto del config)</label>
      <textarea
        rows={6}
        value={jsonRaw}
        onChange={e => tryParseAndPropagate(e.target.value)}
        disabled={disabled}
        style={{ ...inputBase, width: '100%', fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
      />
      {jsonError && (
        <div style={{ color: 'var(--color-danger)', fontSize: 12, marginTop: 4 }}>{jsonError}</div>
      )}
    </div>
  )
}

const EDITORES = {
  opcion_unica:          EditorOpcionUnica,
  equipo_categoria:      EditorEquipoCategoria,
  instancia_eliminacion: EditorInstanciaEliminacion,
  numero_exacto:         EditorNumeroExacto,
  numero_por_banda:      EditorNumeroPorBanda,
  multi_equipo:          EditorMultiEquipo,
  respuesta_manual:      EditorRespuestaManual,
  regla_especial:        EditorReglaEspecial,
}
