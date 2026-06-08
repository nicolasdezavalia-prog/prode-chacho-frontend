/**
 * MundialRespuestaInput — Fase 2.4
 *
 * Input dinámico que se ajusta al `tipo_pregunta` para que el USER cargue su
 * respuesta. Análogo al MundialConfigEditor pero más simple — el user no edita
 * la config, solo responde según el shape que la pregunta espera.
 *
 * Props:
 *   tipo            — string, uno de los 8 tipos válidos.
 *   configPregunta  — objeto (parseado) con la config de la pregunta. Usado para:
 *                       - mostrar opciones disponibles (opcion_unica, instancia_eliminacion)
 *                       - validar cantidad (multi_equipo.n_equipos)
 *                       - mostrar contexto (instancia_eliminacion.equipo)
 *   equiposCatalogo — lista de equipos del catálogo (filtrados a activos).
 *   valor           — respuesta_json actual del user (objeto parseado), o null/undefined.
 *   onChange(nuevo) — callback con el nuevo respuesta_json (objeto).
 *   disabled        — bool. Bloquea inputs (modo lectura).
 */

import EquipoAutocomplete from './EquipoAutocomplete.jsx'

const selectStyle = {
  width: '100%',
  padding: '8px 12px',
  fontSize: 14,
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  background: 'white',
  outline: 'none',
}
const inputStyle = { ...selectStyle }
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

// Aplica la `restriccion` del config_json (si existe) sobre la lista de
// equipos del catálogo. Sin restriccion → devuelve todos los activos.
function filtrarPorRestriccion(equipos, restriccion) {
  const activos = equipos.filter(eq => eq.activo !== 0)
  if (!restriccion || typeof restriccion !== 'object') return activos
  if (restriccion.tipo === 'grupo') {
    return activos.filter(eq => eq.grupo === restriccion.grupo)
  }
  if (restriccion.tipo === 'confederacion') {
    return activos.filter(eq => eq.confederacion === restriccion.confederacion)
  }
  return activos
}

export default function MundialRespuestaInput({ tipo, configPregunta, equiposCatalogo = [], valor, onChange, disabled }) {
  const cfg = configPregunta || {}
  const respuesta = valor || {}
  const Editor = INPUTS[tipo]
  if (!Editor) return <div style={{ color: 'var(--color-danger)', fontSize: 13 }}>Tipo no soportado: {tipo}</div>
  const equiposFiltrados = filtrarPorRestriccion(equiposCatalogo, cfg.restriccion)
  return (
    <Editor
      cfg={cfg}
      respuesta={respuesta}
      onChange={onChange}
      disabled={disabled}
      equiposCatalogo={equiposFiltrados}
    />
  )
}

// ── opcion_unica: botones tipo pill con pts visible ────────────────────────
// Soporta tanto pts uniforme (cfg.pts) como pts_por_opcion (cfg.pts_por_opcion).
function InputOpcionUnica({ cfg, respuesta, onChange, disabled }) {
  const opciones = Array.isArray(cfg.opciones) ? cfg.opciones : []
  const ptsPorOpcion = cfg.pts_por_opcion && typeof cfg.pts_por_opcion === 'object' ? cfg.pts_por_opcion : null
  const ptsFor = (opt) => {
    if (ptsPorOpcion && opt in ptsPorOpcion) return ptsPorOpcion[opt]
    return Number.isInteger(cfg.pts) ? cfg.pts : 0
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {opciones.map(o => {
        const seleccionada = respuesta.opcion === o
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange({ opcion: o })}
            disabled={disabled}
            style={{
              padding: '10px 18px',
              borderRadius: 999,
              border: seleccionada ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
              background: seleccionada ? 'rgba(59,130,246,0.10)' : 'white',
              color: 'var(--color-text)',
              cursor: disabled ? 'default' : 'pointer',
              fontSize: 14,
              fontWeight: seleccionada ? 600 : 500,
              transition: 'border-color 0.1s, background 0.1s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 110,
              justifyContent: 'center',
            }}
          >
            <span>{o}</span>
            <span style={{
              fontSize: 12,
              fontWeight: 500,
              color: seleccionada ? 'var(--color-primary)' : 'var(--color-muted)',
            }}>
              — {ptsFor(o)} pts
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── equipo_categoria: autocomplete contra catálogo, devuelve { equipo: 'ARG' } ─
// Reemplazo del <select> nativo (Fase UX equipos mobile-friendly).
// El código sigue siendo el value interno; el display muestra solo
// "🇦🇷 Argentina (Grupo J)" para que la lista sea legible en mobile.
function InputEquipoCategoria({ respuesta, onChange, disabled, equiposCatalogo }) {
  return (
    <EquipoAutocomplete
      equipos={equiposCatalogo}
      valor={respuesta.equipo || ''}
      onChange={codigo => onChange({ equipo: codigo })}
      disabled={disabled}
      placeholder="Buscá un equipo (ej: argentina, ARG)…"
      autoLimpiar={false}
    />
  )
}

// ── instancia_eliminacion: badge de equipo + grilla de pills (UX 2026-06-04) ─
// Reemplazo del <select> nativo. Shape de respuesta intacta: { instancia: 'Semis' }.
// Los users que ya respondieron mantienen su selección visible (el pill
// correspondiente aparece pre-marcado). NO se requiere recargar nada en DB.
//
// Diseño:
//   - Hero: badge circular con el código del equipo (color por confederación)
//     + nombre + grupo. Reemplaza la línea "Equipo: ARG — Argentina".
//   - Sin emoji bandera (rendering inconsistente entre Win/Linux/macOS — ver
//     fix de EquipoAutocomplete). El código en el badge es estable.
//   - Pills: una por instancia, con el label arriba y +N pts abajo desde
//     cfg.pts_por_instancia. Sin línea separada de scoring densa.
//   - Pill seleccionada: borde azul + fondo azul claro + check.
//
// pts_por_instancia es opcional — si no viene, el pill solo muestra el label.
const CONFED_COLOR = {
  UEFA:     '#534AB7',
  CONMEBOL: '#3B6D11',
  CONCACAF: '#185FA5',
  AFC:      '#993C1D',
  CAF:      '#854F0B',
  OFC:      '#0F6E56',
}

function InputInstanciaEliminacion({ cfg, respuesta, onChange, disabled, equiposCatalogo }) {
  const eqInfo     = equiposCatalogo.find(e => e.codigo === cfg.equipo)
  const instancias = Array.isArray(cfg.instancias) ? cfg.instancias : []
  const ptsPorInst = (cfg.pts_por_instancia && typeof cfg.pts_por_instancia === 'object')
    ? cfg.pts_por_instancia
    : {}
  const seleccionada = respuesta.instancia || ''

  const codigo       = eqInfo?.codigo || cfg.equipo || '?'
  const nombre       = eqInfo?.nombre || cfg.equipo || 'Equipo'
  const grupo        = eqInfo?.grupo  || null
  const confederacion = eqInfo?.confederacion
  const badgeBg      = CONFED_COLOR[confederacion] || '#444441'

  return (
    <div>
      {/* Hero del equipo */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: badgeBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 700, fontSize: 13,
          letterSpacing: '0.04em',
          flexShrink: 0,
        }}>
          {codigo}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.2 }}>
            {nombre}
          </span>
          {grupo && (
            <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
              Grupo {grupo}{confederacion ? ` · ${confederacion}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Grilla de pills por instancia */}
      {instancias.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--color-muted)', fontStyle: 'italic' }}>
          La pregunta no tiene instancias configuradas.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: 6,
        }}>
          {instancias.map(inst => {
            const pts = Number.isInteger(ptsPorInst[inst]) ? ptsPorInst[inst] : null
            const isSelected = inst === seleccionada
            return (
              <button
                key={inst}
                type="button"
                onClick={() => !disabled && onChange({ instancia: inst })}
                disabled={disabled}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  padding: '10px 8px',
                  minHeight: 56,
                  borderRadius: 8,
                  cursor: disabled ? 'default' : 'pointer',
                  background: isSelected ? '#E6F1FB' : 'white',
                  border: isSelected
                    ? '2px solid #185FA5'
                    : '1px solid var(--color-border)',
                  transition: 'border-color 0.1s, background 0.1s',
                  opacity: disabled && !isSelected ? 0.6 : 1,
                }}
              >
                {isSelected && (
                  <span style={{
                    position: 'absolute', top: 4, right: 6,
                    fontSize: 14, color: '#185FA5', fontWeight: 700,
                    lineHeight: 1,
                  }}>
                    ✓
                  </span>
                )}
                <span style={{
                  fontSize: 13,
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? '#0C447C' : 'var(--color-text)',
                }}>
                  {inst}
                </span>
                {pts !== null && (
                  <span style={{
                    fontSize: 11,
                    fontWeight: isSelected ? 600 : 400,
                    color: isSelected ? '#185FA5' : 'var(--color-muted)',
                  }}>
                    +{pts} pts
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── numero_exacto / numero_por_banda: input number ─────────────────────────
function InputNumero({ respuesta, onChange, disabled, placeholder }) {
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
      value={respuesta.numero === undefined || respuesta.numero === null ? '' : respuesta.numero}
      onChange={handle}
      disabled={disabled}
      style={{ ...inputStyle, maxWidth: 160 }}
      placeholder={placeholder || 'Tu número'}
    />
  )
}
function InputNumeroExacto(p)   { return <InputNumero {...p} placeholder="Número exacto" /> }
function InputNumeroPorBanda(p) { return <InputNumero {...p} placeholder="Tu número" /> }

// ── multi_equipo: chips + EquipoAutocomplete con auto-add hasta n_equipos ──
// Reemplazo del <select> + botón "+ Agregar" (Fase UX equipos mobile-friendly).
// El autocomplete agrega el equipo en cuanto el user lo selecciona y
// re-foca para seguir tipeando. Sin botón Agregar.
function InputMultiEquipo({ cfg, respuesta, onChange, disabled, equiposCatalogo }) {
  const n = cfg.n_equipos || 0
  const equiposActuales = Array.isArray(respuesta.equipos) ? respuesta.equipos : []

  const completo = equiposActuales.length >= n
  const getInfo  = (codigo) => equiposCatalogo.find(e => e.codigo === codigo)

  const agregar = (codigo) => {
    // Defensa extra: el autocomplete ya filtra excluidos y el padre ya
    // limita por `disabled`, pero por las dudas validamos acá.
    if (!codigo || completo || equiposActuales.includes(codigo)) return
    onChange({ equipos: [...equiposActuales, codigo] })
  }
  const quitar = (codigo) => {
    onChange({ equipos: equiposActuales.filter(c => c !== codigo) })
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 8 }}>
        <strong>{equiposActuales.length}</strong> de <strong>{n}</strong> equipos seleccionados
        {!completo && <span> · faltan {n - equiposActuales.length}</span>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, minHeight: 28 }}>
        {equiposActuales.length === 0 && (
          <span style={{ fontSize: 12, color: 'var(--color-muted)', fontStyle: 'italic' }}>
            Sin equipos. Buscá y elegí abajo.
          </span>
        )}
        {equiposActuales.map(codigo => {
          const info = getInfo(codigo)
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
        <EquipoAutocomplete
          equipos={equiposCatalogo}
          valor=""                       /* siempre vacío: en multi el chip arriba lleva el estado */
          excluir={equiposActuales}      /* evita duplicados del que ya está como chip */
          onChange={agregar}             /* auto-agrega y vuelve a abrir */
          autoLimpiar={true}
          placeholder="Buscá un equipo para agregar…"
        />
      )}
    </div>
  )
}

// ── respuesta_manual / regla_especial: textarea libre ─────────────────────
function InputTexto({ respuesta, onChange, disabled }) {
  return (
    <textarea
      rows={3}
      value={respuesta.texto || ''}
      onChange={e => {
        const v = e.target.value
        if (v.trim() === '') onChange({})
        else onChange({ texto: v })
      }}
      disabled={disabled}
      style={textareaStyle}
      placeholder="Tu respuesta"
    />
  )
}

const INPUTS = {
  opcion_unica:          InputOpcionUnica,
  equipo_categoria:      InputEquipoCategoria,
  instancia_eliminacion: InputInstanciaEliminacion,
  numero_exacto:         InputNumeroExacto,
  numero_por_banda:      InputNumeroPorBanda,
  multi_equipo:          InputMultiEquipo,
  respuesta_manual:      InputTexto,
  regla_especial:        InputTexto,
}
