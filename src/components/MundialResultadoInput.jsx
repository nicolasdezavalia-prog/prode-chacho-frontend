/**
 * MundialResultadoInput — Fase 3
 *
 * Input dinámico para que el ADMIN cargue el `resultado_json` real de una
 * pregunta. Es análogo a `MundialRespuestaInput.jsx` (usado por el user) pero:
 *
 *   - No aplica filtro por `restriccion` del config: el resultado real puede
 *     venir de cualquier equipo activo del catálogo (la restricción es para
 *     respuestas, no para resultados — el real es lo que pasó).
 *   - Para `respuesta_manual` / `regla_especial` incluye un editor simple de
 *     `overrides_pts` (textarea con JSON: `{ "user_id": pts }`). No es UI bonita
 *     pero permite carga MVP sin retrasar la fase. Si más adelante se vuelve
 *     incómodo, se migra a un widget por usuario.
 *
 * Props:
 *   tipo            — uno de los 8 tipos.
 *   configPregunta  — config_json parseado de la pregunta.
 *   equiposCatalogo — lista de equipos activos del catálogo (sin filtrar por restriccion).
 *   valor           — resultado_json actual (objeto parseado), o null.
 *   onChange(nuevo) — callback con el nuevo resultado_json (objeto).
 *   disabled        — bool. Bloquea inputs.
 */

import { useState } from 'react'

const selectStyle = {
  width: '100%',
  padding: '8px 12px',
  fontSize: 14,
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  background: 'white',
  outline: 'none',
}
const inputStyle    = { ...selectStyle }
const textareaStyle = { ...selectStyle, resize: 'vertical', fontFamily: 'inherit' }
const chipStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '3px 4px 3px 10px', borderRadius: 99, fontSize: 12,
  background: 'rgba(99,102,241,0.10)', color: 'var(--color-text)',
  border: '1px solid transparent',
}
const chipClose = {
  background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer',
  fontSize: 14, lineHeight: 1, padding: '2px 7px', marginLeft: 2,
  borderRadius: 99, color: 'var(--color-muted)',
}

export default function MundialResultadoInput({
  tipo, configPregunta, equiposCatalogo = [], valor, onChange, disabled,
  respuestasUsuarios,  // Fase 3.1 — solo aplica a tipos texto. Array de { user_id, nombre, respuesta_json }.
}) {
  const cfg = configPregunta || {}
  const resultado = valor || {}
  // Fase 3.2: equipo_categoria con scoring_manual usa un editor distinto
  // (tabla de overrides) en vez del dropdown estándar de "equipo ganador".
  let editorKey = tipo
  if (tipo === 'equipo_categoria' && cfg.scoring_manual === true) {
    editorKey = '__equipo_categoria_manual__'
  }
  const Editor = INPUTS[editorKey]
  if (!Editor) return <div style={{ color: 'var(--color-danger)', fontSize: 13 }}>Tipo no soportado: {tipo}</div>
  const equiposActivos = equiposCatalogo.filter(eq => eq.activo !== 0)
  return (
    <Editor
      cfg={cfg}
      resultado={resultado}
      onChange={onChange}
      disabled={disabled}
      equiposCatalogo={equiposActivos}
      respuestasUsuarios={respuestasUsuarios}
    />
  )
}

// ── opcion_unica: select con las opciones del config ──────────────────────
function InputOpcionUnica({ cfg, resultado, onChange, disabled }) {
  const opciones = Array.isArray(cfg.opciones) ? cfg.opciones : []
  return (
    <select
      value={resultado.opcion || ''}
      onChange={e => onChange({ opcion: e.target.value })}
      disabled={disabled || opciones.length === 0}
      style={selectStyle}
    >
      <option value="">— Elegí la opción ganadora —</option>
      {opciones.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

// ── equipo_categoria: dropdown contra catálogo, sin restriccion ───────────
function InputEquipoCategoria({ resultado, onChange, disabled, equiposCatalogo }) {
  return (
    <select
      value={resultado.equipo || ''}
      onChange={e => onChange({ equipo: e.target.value })}
      disabled={disabled || equiposCatalogo.length === 0}
      style={selectStyle}
    >
      <option value="">
        {equiposCatalogo.length === 0 ? '— Sin equipos en catálogo —' : '— Elegí el equipo real —'}
      </option>
      {equiposCatalogo.map(eq => (
        <option key={eq.codigo} value={eq.codigo}>
          {eq.codigo} — {eq.nombre}{eq.grupo ? ` (Grupo ${eq.grupo})` : ''}
        </option>
      ))}
    </select>
  )
}

// ── instancia_eliminacion: contexto + dropdown ────────────────────────────
function InputInstanciaEliminacion({ cfg, resultado, onChange, disabled, equiposCatalogo }) {
  const eqInfo = equiposCatalogo.find(e => e.codigo === cfg.equipo)
  const instancias = Array.isArray(cfg.instancias) ? cfg.instancias : []
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 8 }}>
        Equipo:{' '}
        <strong>
          {eqInfo ? (
            <>
              {eqInfo.emoji ? `${eqInfo.emoji} ` : ''}
              {eqInfo.codigo} — {eqInfo.nombre}
            </>
          ) : (cfg.equipo || '?')}
        </strong>
      </div>
      <select
        value={resultado.instancia || ''}
        onChange={e => onChange({ instancia: e.target.value })}
        disabled={disabled || instancias.length === 0}
        style={selectStyle}
      >
        <option value="">— Elegí la instancia donde quedó eliminado —</option>
        {instancias.map(i => <option key={i} value={i}>{i}</option>)}
      </select>
    </div>
  )
}

// ── numero_exacto / numero_por_banda ──────────────────────────────────────
function InputNumero({ resultado, onChange, disabled, placeholder }) {
  const handle = (e) => {
    const v = e.target.value
    if (v === '') onChange({})
    else {
      const n = parseInt(v, 10)
      if (Number.isInteger(n) && n >= 0) onChange({ numero: n })
    }
  }
  return (
    <input
      type="number" min="0" step="1"
      value={resultado.numero === undefined || resultado.numero === null ? '' : resultado.numero}
      onChange={handle}
      disabled={disabled}
      style={{ ...inputStyle, maxWidth: 160 }}
      placeholder={placeholder || 'Número real'}
    />
  )
}
function InputNumeroExacto(p)   { return <InputNumero {...p} placeholder="Número exacto real" /> }
function InputNumeroPorBanda(p) { return <InputNumero {...p} placeholder="Número real" /> }

// ── multi_equipo: chips + dropdown contra catálogo, hasta n_equipos ────────
function InputMultiEquipo({ cfg, resultado, onChange, disabled, equiposCatalogo }) {
  const n = cfg.n_equipos || 0
  const equiposActuales = Array.isArray(resultado.equipos) ? resultado.equipos : []
  const [seleccionado, setSeleccionado] = useState('')

  const enUso = new Set(equiposActuales)
  const disponibles = equiposCatalogo.filter(eq => !enUso.has(eq.codigo))
  const completo = equiposActuales.length >= n
  const getInfo = (codigo) => equiposCatalogo.find(e => e.codigo === codigo)

  const agregar = () => {
    if (!seleccionado || completo) return
    onChange({ equipos: [...equiposActuales, seleccionado] })
    setSeleccionado('')
  }
  const quitar = (codigo) => {
    onChange({ equipos: equiposActuales.filter(c => c !== codigo) })
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 8 }}>
        <strong>{equiposActuales.length}</strong> de <strong>{n}</strong> equipos cargados
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, minHeight: 28 }}>
        {equiposActuales.length === 0 && (
          <span style={{ fontSize: 12, color: 'var(--color-muted)', fontStyle: 'italic' }}>
            Sin equipos cargados. Elegí desde el dropdown.
          </span>
        )}
        {equiposActuales.map(codigo => {
          const info   = getInfo(codigo)
          const orfano = !info
          return (
            <span
              key={codigo}
              title={orfano ? 'Código no encontrado en el catálogo' : undefined}
              style={{
                ...chipStyle,
                background: orfano ? 'rgba(234,179,8,0.15)' : 'rgba(99,102,241,0.10)',
                color: orfano ? '#a16207' : 'var(--color-text)',
                border: orfano ? '1px dashed #a16207' : '1px solid transparent',
              }}
            >
              <span>{info?.emoji || '🏳️'}</span>
              <strong>{codigo}</strong>
              {info && <span style={{ color: 'var(--color-muted)' }}>— {info.nombre}</span>}
              {!disabled && (
                <button type="button" onClick={() => quitar(codigo)} style={chipClose} title="Quitar">×</button>
              )}
            </span>
          )
        })}
      </div>
      {!completo && !disabled && (
        <div style={{ display: 'flex', gap: 6 }}>
          <select
            value={seleccionado}
            onChange={e => setSeleccionado(e.target.value)}
            disabled={disponibles.length === 0}
            style={{ ...selectStyle, flex: 1, maxWidth: 380 }}
          >
            <option value="">
              {disponibles.length === 0 ? '— No quedan equipos —' : '— Elegí un equipo —'}
            </option>
            {disponibles.map(eq => (
              <option key={eq.codigo} value={eq.codigo}>
                {eq.codigo} — {eq.nombre}{eq.grupo ? ` (Grupo ${eq.grupo})` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={agregar}
            disabled={!seleccionado}
            className="btn btn-primary btn-sm"
            style={{ fontSize: 11 }}
          >
            + Agregar
          </button>
        </div>
      )}
    </div>
  )
}

// ── Helpers compartidos para tipos con scoring por overrides ──────────────

/**
 * Botón rápido para asignar un pts puntual desde la tabla de overrides.
 * `variant='ghost'` usa colores grises (para el botón "Auto" que limpia override).
 */
function BotonRapido({ label, active, onClick, disabled, title, variant }) {
  const isGhost = variant === 'ghost'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: '3px 8px', fontSize: 11, borderRadius: 4,
        border: active
          ? (isGhost ? '1px solid var(--color-muted)' : '1px solid var(--color-primary)')
          : '1px solid var(--color-border)',
        background: active
          ? (isGhost ? 'rgba(0,0,0,0.06)' : 'rgba(59,130,246,0.10)')
          : 'white',
        color: isGhost ? 'var(--color-muted)' : 'var(--color-text)',
        fontWeight: active ? 600 : 400,
        cursor: disabled ? 'default' : 'pointer',
        minWidth: 28,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

/**
 * Tabla genérica para asignar overrides_pts por usuario. Usada por:
 *   - respuesta_manual / regla_especial (formatRespuesta extrae .texto)
 *   - equipo_categoria scoring_manual   (formatRespuesta extrae .equipo + lookup catalogo)
 *
 * Botones rápidos: si cfg trae `presets: [...]`, se usan esos. Sino [0, ptsMax].
 * El botón "Auto" limpia el override (vuelve a la lógica default del tipo).
 */
function TablaOverridesPts({
  respuestasUsuarios = [],
  overrides = {},
  onSetOverride,
  formatRespuesta,
  presets,
  ptsMax,
  autoTooltip,
  disabled,
}) {
  const botones = (Array.isArray(presets) && presets.length > 0)
    ? presets
    : (Number.isInteger(ptsMax) ? [0, ptsMax] : [0])

  if (respuestasUsuarios.length === 0) {
    return (
      <div style={{
        padding: '12px 14px', borderRadius: 6,
        background: 'rgba(0,0,0,0.04)', color: 'var(--color-muted)',
        fontSize: 12, fontStyle: 'italic',
      }}>
        Sin respuestas cargadas en esta pregunta todavía.
      </div>
    )
  }

  return (
    <div style={{
      border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--color-surface2, rgba(0,0,0,0.03))' }}>
            <th style={cellTh}>Usuario</th>
            <th style={cellTh}>Respuesta</th>
            <th style={{ ...cellTh, textAlign: 'right' }}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {respuestasUsuarios.map(r => {
            const overrideVal   = overrides[String(r.user_id)]
            const tieneOverride = Number.isInteger(overrideVal)
            return (
              <tr key={r.user_id} style={{ borderTop: '1px solid var(--color-border)' }}>
                <td style={cellTd}>{r.nombre || `Usuario ${r.user_id}`}</td>
                <td style={{ ...cellTd, fontFamily: 'monospace', fontSize: 12 }}>
                  {formatRespuesta(r.respuesta_json)}
                </td>
                <td style={{ ...cellTd, textAlign: 'right' }}>
                  <div style={{
                    display: 'inline-flex', gap: 4, alignItems: 'center',
                    flexWrap: 'wrap', justifyContent: 'flex-end',
                  }}>
                    {botones.map(b => (
                      <BotonRapido
                        key={b}
                        label={String(b)}
                        active={tieneOverride && overrideVal === b}
                        onClick={() => onSetOverride(r.user_id, b)}
                        disabled={disabled}
                      />
                    ))}
                    <BotonRapido
                      label="Auto"
                      active={!tieneOverride}
                      onClick={() => onSetOverride(r.user_id, '')}
                      disabled={disabled}
                      title={autoTooltip}
                      variant="ghost"
                    />
                    <input
                      type="number" min="0" step="1"
                      value={tieneOverride ? overrideVal : ''}
                      onChange={e => onSetOverride(r.user_id, e.target.value)}
                      disabled={disabled}
                      placeholder="—"
                      style={{
                        width: 56, padding: '3px 6px',
                        border: '1px solid var(--color-border)', borderRadius: 4,
                        fontSize: 12, textAlign: 'right',
                      }}
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Lee overrides_pts del resultado de forma segura.
function leerOverrides(resultado) {
  return (resultado && resultado.overrides_pts && typeof resultado.overrides_pts === 'object')
    ? resultado.overrides_pts
    : {}
}

// Construye el handler de setOverride genérico para cualquier tipo manual.
function makeSetOverride(resultado, overrides, onChange) {
  return function setOverride(userId, rawValue) {
    const next = { ...resultado }
    const ov   = { ...overrides }
    const key  = String(userId)
    if (rawValue === '' || rawValue === null || rawValue === undefined) {
      delete ov[key]
    } else {
      const n = parseInt(rawValue, 10)
      if (!Number.isInteger(n) || n < 0) return
      ov[key] = n
    }
    if (Object.keys(ov).length === 0) delete next.overrides_pts
    else                              next.overrides_pts = ov
    onChange(next)
  }
}

// ── respuesta_manual / regla_especial: texto + tabla de overrides ────────
// Fase 3.1/3.2: el JSON crudo fue reemplazado por una tabla con las respuestas
// reales de los usuarios. El admin asigna pts por fila (botones rápidos +
// input numérico). Lo escrito por el user NO se modifica — solo guardamos
// overrides_pts[user_id]. Si una fila queda en "Auto", ese user cae al
// matching normalizado contra `texto` del resultado.
function InputTexto({ cfg, resultado, onChange, disabled, respuestasUsuarios }) {
  const overrides    = leerOverrides(resultado)
  const setOverride  = makeSetOverride(resultado, overrides, onChange)

  function handleTexto(e) {
    const v = e.target.value
    const next = { ...resultado, texto: v }
    if (v.trim() === '') delete next.texto
    onChange(next)
  }
  function handlePtsSiAcierta(e) {
    const v = e.target.value
    const next = { ...resultado }
    if (v === '') delete next.pts_si_acierta
    else {
      const n = parseInt(v, 10)
      if (Number.isInteger(n) && n >= 0) next.pts_si_acierta = n
    }
    onChange(next)
  }

  function formatTexto(respJsonStr) {
    if (!respJsonStr) return <span style={{ color: 'var(--color-muted)', fontStyle: 'italic' }}>(vacío)</span>
    try {
      const obj = JSON.parse(respJsonStr)
      const t = (obj && typeof obj.texto === 'string') ? obj.texto : ''
      return t || <span style={{ color: 'var(--color-muted)', fontStyle: 'italic' }}>(vacío)</span>
    } catch {
      return <span style={{ color: 'var(--color-muted)', fontStyle: 'italic' }}>(inválido)</span>
    }
  }

  const ptsAutoDefault = Number.isInteger(resultado.pts_si_acierta)
    ? resultado.pts_si_acierta
    : (Number.isInteger(cfg.pts_max) ? cfg.pts_max : 0)

  const autoTooltip = `Auto: compara la respuesta del usuario contra el texto correcto (${ptsAutoDefault} pts si matchea, 0 si no).`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={{ fontSize: 12, color: 'var(--color-muted)', display: 'block', marginBottom: 4 }}>
          Texto de la respuesta correcta (matching automático: lowercase + sin tildes)
        </label>
        <textarea
          rows={2}
          value={resultado.texto || ''}
          onChange={handleTexto}
          disabled={disabled}
          style={textareaStyle}
          placeholder="Ej: Mbappé"
        />
      </div>

      <div>
        <label style={{ fontSize: 12, color: 'var(--color-muted)', display: 'block', marginBottom: 4 }}>
          pts_si_acierta (opcional; default = cfg.pts_max = {Number.isInteger(cfg.pts_max) ? cfg.pts_max : '?'})
        </label>
        <input
          type="number" min="0" step="1"
          value={resultado.pts_si_acierta === undefined ? '' : resultado.pts_si_acierta}
          onChange={handlePtsSiAcierta}
          disabled={disabled}
          style={{ ...inputStyle, maxWidth: 160 }}
          placeholder={`Default: ${cfg.pts_max ?? 0}`}
        />
      </div>

      <div>
        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 6, lineHeight: 1.45 }}>
          <strong>Asignación de puntos por usuario.</strong>
          {' '}Botón <em>Auto</em>: compara la respuesta contra el texto correcto de arriba
          ({ptsAutoDefault} pts si matchea, 0 si no). Botones rápidos o input numérico
          para overridear ese cálculo.
        </div>
        <TablaOverridesPts
          respuestasUsuarios={respuestasUsuarios}
          overrides={overrides}
          onSetOverride={setOverride}
          formatRespuesta={formatTexto}
          presets={cfg.presets}
          ptsMax={cfg.pts_max}
          autoTooltip={autoTooltip}
          disabled={disabled}
        />
      </div>
    </div>
  )
}

// ── equipo_categoria con scoring_manual (Fase 3.2) ────────────────────────
// La UI del usuario sigue siendo dropdown de equipos (sin cambios). Pero
// el scoring es 100% manual: solo se aplica overrides_pts[user_id].
// Sin override → 0 pts. NO hay auto-matching.
// La columna "Respuesta" muestra CÓDIGO — Nombre del equipo desde el catálogo.
function InputEquipoCategoriaManual({ cfg, resultado, onChange, disabled, respuestasUsuarios, equiposCatalogo }) {
  const overrides   = leerOverrides(resultado)
  const setOverride = makeSetOverride(resultado, overrides, onChange)

  function formatEquipo(respJsonStr) {
    if (!respJsonStr) return <span style={{ color: 'var(--color-muted)', fontStyle: 'italic' }}>(vacío)</span>
    try {
      const obj = JSON.parse(respJsonStr)
      const codigo = obj?.equipo
      if (!codigo) return <span style={{ color: 'var(--color-muted)', fontStyle: 'italic' }}>(vacío)</span>
      const eq = equiposCatalogo.find(e => e.codigo === codigo)
      if (eq) return `${eq.emoji ? eq.emoji + ' ' : ''}${eq.codigo} — ${eq.nombre}`
      return `${codigo} (no en catálogo)`
    } catch {
      return <span style={{ color: 'var(--color-muted)', fontStyle: 'italic' }}>(inválido)</span>
    }
  }

  // Para botón "Máx" cuando no hay pts_max explícito, derivamos del max de presets.
  const ptsMaxFromPresets = (Array.isArray(cfg.presets) && cfg.presets.length > 0)
    ? Math.max(...cfg.presets.filter(n => Number.isInteger(n) && n >= 0))
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.45 }}>
        <strong>Scoring manual.</strong> Esta pregunta no usa categorías automáticas:
        cada usuario se evalúa a mano. Botón <em>Auto</em> = sin override (0 pts).
        Usá los botones rápidos para asignar los valores típicos.
      </div>
      <TablaOverridesPts
        respuestasUsuarios={respuestasUsuarios}
        overrides={overrides}
        onSetOverride={setOverride}
        formatRespuesta={formatEquipo}
        presets={cfg.presets}
        ptsMax={ptsMaxFromPresets}
        autoTooltip="Auto: sin override → 0 pts (esta pregunta es scoring manual, sin auto-match)."
        disabled={disabled}
      />
    </div>
  )
}

const cellTh = {
  padding: '8px 10px', textAlign: 'left',
  fontSize: 11, fontWeight: 700, color: 'var(--color-muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
}
const cellTd = { padding: '8px 10px', verticalAlign: 'middle' }

const INPUTS = {
  opcion_unica:                 InputOpcionUnica,
  equipo_categoria:             InputEquipoCategoria,
  __equipo_categoria_manual__:  InputEquipoCategoriaManual,  // Fase 3.2: ruteado por dispatcher cuando cfg.scoring_manual===true
  instancia_eliminacion:        InputInstanciaEliminacion,
  numero_exacto:                InputNumeroExacto,
  numero_por_banda:             InputNumeroPorBanda,
  multi_equipo:                 InputMultiEquipo,
  respuesta_manual:             InputTexto,
  regla_especial:               InputTexto,
}
