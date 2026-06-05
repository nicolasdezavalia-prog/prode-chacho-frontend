/**
 * EquipoAutocomplete — Mini-fase UX equipos mobile-friendly
 *
 * Reemplazo del <select> nativo para elegir un equipo del catálogo.
 * Mantiene el código como valor interno; muestra solo "Nombre (Grupo X)".
 *
 * Props:
 *   equipos       — array de { codigo, nombre, emoji?, grupo?, confederacion?, activo? }
 *                   Se asume YA filtrado por restricción de la pregunta.
 *   valor         — string código actualmente seleccionado, o ''.
 *   onChange(c)   — callback con el código seleccionado.
 *   disabled      — bool.
 *   placeholder   — string para el input.
 *   excluir       — array de códigos a ocultar (multi-equipo evita duplicados).
 *   autoLimpiar   — bool. Si true, después de seleccionar limpia el query
 *                   (multi-equipo) y vuelve a abrir la lista para seguir
 *                   agregando. Si false, cierra y muestra el equipo elegido
 *                   en el input (modo single).
 *
 * Búsqueda: substring case/diacrítico-insensitive contra nombre, código,
 * grupo y confederación. El user puede tipear "argen" o "ARG" indistinto.
 *
 * Teclado: ↑↓ navegan, Enter selecciona, Esc cierra. Click afuera cierra.
 *
 * Sin librerías externas. Sin matchMedia. Mismo path en desktop y mobile.
 *
 * ROADMAP: el mismo componente puede reusarse en MundialResultadoInput
 * (admin) cuando se quiera; los props ya están preparados para eso.
 */

import { useEffect, useMemo, useRef, useState } from 'react'

// Normaliza: lowercase + trim + sin tildes. Para matching tolerante.
// Implementación mínima — no usamos regex unicode para evitar issues de
// encoding. Mismo patrón que `normalizarTexto` del backend (no se importa
// para no acoplar el frontend a archivos de scoring).
function normalizar(s) {
  if (typeof s !== 'string') return ''
  const nfd = s.normalize('NFD')
  let out = ''
  for (let i = 0; i < nfd.length; i++) {
    const c = nfd.charCodeAt(i)
    if (c >= 0x0300 && c <= 0x036F) continue
    out += nfd[i]
  }
  return out.toLowerCase().trim()
}

// Display público para la lista desplegable (renderizada en <div>):
// "🇦🇷 Argentina (Grupo J)". Sin código visible.
// Si la pregunta no tiene grupo (algunas confederaciones), lo omite.
function displayEquipo(eq) {
  if (!eq) return ''
  const emoji = eq.emoji ? `${eq.emoji} ` : ''
  const grupo = eq.grupo ? ` (Grupo ${eq.grupo})` : ''
  return `${emoji}${eq.nombre || eq.codigo}${grupo}`
}

// Display sin emoji para mostrar el equipo seleccionado dentro del <input>
// cerrado. Los flag emojis están compuestos por dos "regional indicators"
// (ej. 🇨 + 🇿 = 🇨🇿). En <input type="text"> varias fuentes del sistema
// (Windows / algunos Android) no tienen glyph compuesto y renderizan los
// regional indicators como las letras del código de país ("cz", "us", "fr"),
// produciendo cosas como "cz República Checa". En <div> el font stack del
// body sí soporta emoji y se ve correcto.
// Solución mínima y cross-platform: omitir emoji solo en el input cerrado.
function displayEquipoTexto(eq) {
  if (!eq) return ''
  const grupo = eq.grupo ? ` (Grupo ${eq.grupo})` : ''
  return `${eq.nombre || eq.codigo}${grupo}`
}

const inputBaseStyle = {
  width: '100%',
  padding: '8px 12px',
  fontSize: 14,
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  background: 'white',
  outline: 'none',
  boxSizing: 'border-box',
}

const panelStyle = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0,
  right: 0,
  zIndex: 30,
  background: 'white',
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  maxHeight: 260,
  overflowY: 'auto',
}

const itemBaseStyle = {
  padding: '8px 12px',
  fontSize: 14,
  cursor: 'pointer',
  borderBottom: '1px solid rgba(0,0,0,0.04)',
  color: 'var(--color-text)',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

export default function EquipoAutocomplete({
  equipos = [],
  valor = '',
  onChange,
  disabled = false,
  placeholder,
  excluir = [],
  autoLimpiar = false,
}) {
  const [open, setOpen]       = useState(false)
  const [query, setQuery]     = useState('')
  const [highlight, setHighlight] = useState(0)
  const wrapperRef = useRef(null)
  const inputRef   = useRef(null)

  // Set de exclusiones para lookup O(1).
  const excluirSet = useMemo(() => new Set(excluir || []), [excluir])

  // Equipo seleccionado actual — para mostrar display en modo single
  // cuando está cerrado.
  const equipoActual = useMemo(
    () => equipos.find(e => e.codigo === valor) || null,
    [equipos, valor]
  )

  // Lista filtrada por query + excluidos. Si query es vacío y está abierto,
  // mostramos todo (el user ve la lista entera al tocar el campo).
  const sugerencias = useMemo(() => {
    const q = normalizar(query)
    return equipos
      .filter(e => e && e.activo !== 0)
      .filter(e => !excluirSet.has(e.codigo))
      .filter(e => {
        if (!q) return true
        // Match contra nombre + codigo + grupo + confederacion.
        const haystack = [
          e.nombre, e.codigo, e.grupo, e.confederacion,
        ].map(normalizar).join(' ')
        return haystack.includes(q)
      })
  }, [equipos, excluirSet, query])

  // Reset del índice highlighted cuando cambia la lista filtrada.
  useEffect(() => {
    setHighlight(0)
  }, [query, open])

  // Click afuera → cerrar.
  useEffect(() => {
    if (!open) return
    function onDocClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('touchstart', onDocClick)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('touchstart', onDocClick)
    }
  }, [open])

  function abrir() {
    if (disabled) return
    setOpen(true)
    setQuery('')
  }

  function elegir(codigo) {
    onChange && onChange(codigo)
    if (autoLimpiar) {
      // multi-equipo: limpia el query, mantiene el panel abierto si
      // todavía quedan sugerencias después de la exclusión que el padre
      // va a recalcular en el próximo render.
      setQuery('')
      // Re-foco para seguir tipeando.
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      // single: muestra el equipo elegido cerrado.
      setOpen(false)
      setQuery('')
    }
  }

  function onKey(e) {
    if (disabled) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) { setOpen(true); return }
      setHighlight(i => Math.min(i + 1, sugerencias.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const eq = sugerencias[highlight]
      if (eq) elegir(eq.codigo)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // Valor del input:
  //   - Si está abierto → query (lo que está tipeando).
  //   - Si cerrado + tiene selección + modo single → display SIN emoji
  //     (ver comentario de displayEquipoTexto sobre flags + regional
  //     indicators que se rompen en <input> en algunas fuentes).
  //   - Si cerrado + modo multi (autoLimpiar) → vacío para próximo agregado.
  let inputValue
  if (open) {
    inputValue = query
  } else if (!autoLimpiar && equipoActual) {
    inputValue = displayEquipoTexto(equipoActual)
  } else if (!autoLimpiar && valor && !equipoActual) {
    // Código huérfano: lo mostramos tal cual.
    inputValue = valor
  } else {
    inputValue = ''
  }

  const sinResultados = open && sugerencias.length === 0
  const sinCatalogo   = equipos.length === 0

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        value={inputValue}
        placeholder={
          sinCatalogo
            ? '— Sin equipos en catálogo —'
            : (placeholder || 'Buscá un equipo (nombre o código)…')
        }
        disabled={disabled || sinCatalogo}
        onFocus={abrir}
        onClick={abrir}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onKeyDown={onKey}
        style={inputBaseStyle}
      />

      {open && (
        <div style={panelStyle} role="listbox">
          {sinResultados && (
            <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--color-muted)' }}>
              Sin resultados para "{query}"
            </div>
          )}
          {sugerencias.map((eq, i) => {
            const seleccionado = !autoLimpiar && eq.codigo === valor
            const isHi = i === highlight
            return (
              <div
                key={eq.codigo}
                role="option"
                aria-selected={seleccionado}
                onMouseEnter={() => setHighlight(i)}
                // mousedown en vez de click — evita perder el foco antes
                // de procesar la selección (race con onBlur/click afuera).
                onMouseDown={e => { e.preventDefault(); elegir(eq.codigo) }}
                style={{
                  ...itemBaseStyle,
                  background: isHi
                    ? 'rgba(59,130,246,0.10)'
                    : (seleccionado ? 'rgba(99,102,241,0.06)' : 'white'),
                  fontWeight: seleccionado ? 600 : 400,
                }}
              >
                <span>{displayEquipo(eq)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
