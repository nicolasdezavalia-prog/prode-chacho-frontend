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

// ── equipo_categoria: dropdown contra catálogo, devuelve { equipo: 'ARG' } ──
function InputEquipoCategoria({ respuesta, onChange, disabled, equiposCatalogo }) {
  return (
    <select
      value={respuesta.equipo || ''}
      onChange={e => onChange({ equipo: e.target.value })}
      disabled={disabled || equiposCatalogo.length === 0}
      style={selectStyle}
    >
      <option value="">
        {equiposCatalogo.length === 0 ? '— Sin equipos en catálogo —' : '— Elegí un equipo —'}
      </option>
      {equiposCatalogo.map(eq => (
        <option key={eq.codigo} value={eq.codigo}>
          {eq.codigo} — {eq.nombre}{eq.grupo ? ` (Grupo ${eq.grupo})` : ''}
        </option>
      ))}
    </select>
  )
}

// ── instancia_eliminacion: contexto del equipo + dropdown de instancias ────
function InputInstanciaEliminacion({ cfg, respuesta, onChange, disabled, equiposCatalogo }) {
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
        value={respuesta.instancia || ''}
        onChange={e => onChange({ instancia: e.target.value })}
        disabled={disabled || instancias.length === 0}
        style={selectStyle}
      >
        <option value="">— Elegí la instancia —</option>
        {instancias.map(i => <option key={i} value={i}>{i}</option>)}
      </select>
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

// ── multi_equipo: chips + dropdown contra catálogo, hasta n_equipos ────────
function InputMultiEquipo({ cfg, respuesta, onChange, disabled, equiposCatalogo }) {
  const n = cfg.n_equipos || 0
  const equiposActuales = Array.isArray(respuesta.equipos) ? respuesta.equipos : []
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
        <strong>{equiposActuales.length}</strong> de <strong>{n}</strong> equipos seleccionados
        {!completo && <span> · faltan {n - equiposActuales.length}</span>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, minHeight: 28 }}>
        {equiposActuales.length === 0 && (
          <span style={{ fontSize: 12, color: 'var(--color-muted)', fontStyle: 'italic' }}>
            Sin equipos. Elegí desde el dropdown.
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
        <div style={{ display: 'flex', gap: 6 }}>
          <select
            value={seleccionado}
            onChange={e => setSeleccionado(e.target.value)}
            disabled={disponibles.length === 0}
            style={{ ...selectStyle, flex: 1, maxWidth: 380 }}
          >
            <option value="">
              {disponibles.length === 0
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
