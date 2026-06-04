/**
 * AdminMundialPremios — Fase Premios (modelo fijo) + Fase 6.1 (comida_rol)
 *
 * Tab Premios del AdminMundialHub. Editor de la tabla `mundial_premios`
 * cruzada con el ranking actual.
 *
 * Modelo:
 *   - Filas: { posicion: int >= 1, usd: int (acepta negativos), comida_rol }.
 *   - comida_rol ∈ { null, 'gratis', 'paga', 'organiza' } — informativo.
 *   - SIN porcentaje. SIN pozo. SIN moneda configurable (USD).
 *   - Editable salvo estado='finalizado'.
 *
 * Cruce con ranking:
 *   - Para cada posicion: muestra el usuario del ranking en esa posición
 *     (o null si nadie está ahí todavía).
 *   - Estimado mientras estado != 'finalizado'.
 *
 * Preset Mundial 2026 (USD + comida_rol):
 *   1°: 200/gratis,  2°: 50/gratis,  3°: 25/gratis,  4°: -5/gratis,
 *   5°: -10/gratis,  6°: -15/paga,   7°: -20/paga,   8°: -25/paga,
 *   9°: -30/paga,   10°: -35/paga,  11°: -40/paga,  12°: -45/paga,
 *  13°: -50/organiza.
 *
 * ROADMAP (no implementar acá):
 *   - Desempates por compra de cambios + por última pregunta.
 *   - Snapshot al finalizar.
 *   - ARS / TC.
 *   - Lógica real de Comida post Mundial (asistencia + deudas + economía).
 */

import { useEffect, useState, useMemo } from 'react'
import { api } from '../../api/index.js'

// Whitelist de comida_rol — el backend valida lo mismo.
// Mapeo a labels en COMIDA_LABELS más abajo.
const COMIDA_ROLES = [null, 'gratis', 'paga', 'organiza']
const COMIDA_LABELS = {
  null:       '—',
  gratis:     'Come gratis',
  paga:       'Paga',
  organiza:   'Organiza',
}

const PRESET_MUNDIAL_2026 = [
  { posicion: 1,  usd:  200, comida_rol: 'gratis'   },
  { posicion: 2,  usd:   50, comida_rol: 'gratis'   },
  { posicion: 3,  usd:   25, comida_rol: 'gratis'   },
  { posicion: 4,  usd:   -5, comida_rol: 'gratis'   },
  { posicion: 5,  usd:  -10, comida_rol: 'gratis'   },
  { posicion: 6,  usd:  -15, comida_rol: 'paga'     },
  { posicion: 7,  usd:  -20, comida_rol: 'paga'     },
  { posicion: 8,  usd:  -25, comida_rol: 'paga'     },
  { posicion: 9,  usd:  -30, comida_rol: 'paga'     },
  { posicion: 10, usd:  -35, comida_rol: 'paga'     },
  { posicion: 11, usd:  -40, comida_rol: 'paga'     },
  { posicion: 12, usd:  -45, comida_rol: 'paga'     },
  { posicion: 13, usd:  -50, comida_rol: 'organiza' },
]

export default function AdminMundialPremios({ torneoId, estado }) {
  const editable = estado !== 'finalizado'

  const [filas, setFilas]           = useState([])  // [{ posicion, usd, comida_rol }]
  const [calculados, setCalculados] = useState(null) // respuesta de /premios-calculados
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [info, setInfo]              = useState('')

  useEffect(() => { load() /* eslint-disable-next-line */ }, [torneoId])

  async function load() {
    setLoading(true); setError(''); setInfo('')
    try {
      const [premios, calc] = await Promise.all([
        api.getMundialPremios(torneoId),
        api.getMundialPremiosCalculados(torneoId).catch(() => null),
      ])
      const arr = Array.isArray(premios) ? premios : []
      setFilas(arr.map(p => ({
        posicion:   p.posicion,
        usd:        p.usd,
        comida_rol: p.comida_rol || null,
      })))
      setCalculados(calc)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Map { posicion: usuarioDelRanking } para el join en el editor.
  const usuarioPorPosicion = useMemo(() => {
    const m = new Map()
    for (const p of (calculados?.premios || [])) {
      m.set(p.posicion, p.usuario || null)
    }
    return m
  }, [calculados])

  const totalNeto = useMemo(
    () => filas.reduce((acc, f) => acc + (Number.isInteger(f.usd) ? f.usd : 0), 0),
    [filas]
  )

  function setFila(idx, patch) {
    setFilas(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f))
  }
  function quitarFila(idx) {
    setFilas(prev => prev.filter((_, i) => i !== idx))
  }
  function agregarFila() {
    const nextPos = filas.length === 0
      ? 1
      : Math.max(...filas.map(f => f.posicion || 0)) + 1
    setFilas(prev => [...prev, { posicion: nextPos, usd: 0, comida_rol: null }])
  }
  function cargarPreset() {
    if (filas.length > 0 && !window.confirm('Esto reemplaza todas las filas actuales con el preset Mundial 2026 (13 posiciones). ¿Continuar?')) return
    setFilas(PRESET_MUNDIAL_2026.map(p => ({ ...p })))
    setInfo('Preset Mundial 2026 cargado. Acordate de guardar.')
  }

  async function guardar() {
    if (saving) return
    setError(''); setInfo('')
    // Validación cliente: posiciones únicas, enteros válidos.
    const vistos = new Set()
    const payload = []
    for (let i = 0; i < filas.length; i++) {
      const f = filas[i]
      const pos = parseInt(f.posicion, 10)
      const usd = parseInt(f.usd, 10)
      if (!Number.isInteger(pos) || pos < 1) {
        setError(`Fila ${i + 1}: posición debe ser entero >= 1`); return
      }
      if (!Number.isInteger(usd)) {
        setError(`Fila ${i + 1} (pos ${pos}): Premio/Castigo USD debe ser entero (puede ser negativo)`); return
      }
      if (vistos.has(pos)) {
        setError(`Posición ${pos} duplicada`); return
      }
      vistos.add(pos)
      // comida_rol: null o un valor de la whitelist. La UI ya restringe vía select.
      const rol = (f.comida_rol === '' || f.comida_rol === undefined) ? null : f.comida_rol
      if (rol !== null && !['gratis', 'paga', 'organiza'].includes(rol)) {
        setError(`Fila ${i + 1} (pos ${pos}): comida_rol inválido (${rol})`); return
      }
      payload.push({ posicion: pos, usd, comida_rol: rol })
    }
    if (payload.length === 0) {
      setError('Cargá al menos una fila antes de guardar.'); return
    }
    setSaving(true)
    try {
      await api.saveMundialPremiosBulk(torneoId, payload)
      setInfo(`Guardado · ${payload.length} posición${payload.length === 1 ? '' : 'es'}.`)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading">Cargando premios...</div>

  // Ordenar filas por posición para mostrar siempre consistente.
  const filasOrd = [...filas].sort((a, b) => (a.posicion || 0) - (b.posicion || 0))

  return (
    <div>
      {/* Banner contextual: estimado vs definitivo */}
      <div style={{
        padding: '8px 12px',
        background: editable ? 'rgba(99,102,241,0.08)' : 'rgba(124,58,237,0.10)',
        color: editable ? '#6366f1' : '#7c3aed',
        borderRadius: 6, marginBottom: 8, fontSize: 12, fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        border: `1px solid ${editable ? 'rgba(99,102,241,0.20)' : 'rgba(124,58,237,0.25)'}`,
      }}>
        {editable ? 'ℹ️ ' : '🏁 '}
        {editable
          ? `Premios estimados — estado actual: ${estado}. Editable hasta finalizar el torneo.`
          : `Premios DEFINITIVOS — torneo finalizado. Edición bloqueada.`}
      </div>

      {/* Aclaración del modelo: la columna Usuario es derivada del ranking,
          no se asigna manualmente. Reduce confusión del admin. */}
      <div style={{
        padding: '8px 12px', marginBottom: 12,
        fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5,
      }}>
        Los premios se configuran <strong>por posición</strong>. El usuario que corresponde
        a cada premio se determina <strong>automáticamente según el ranking actual</strong> —
        no se asigna manualmente. Si el ranking cambia, también cambia quién corresponde.
      </div>

      {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}
      {info && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(22,163,74,0.10)', color: 'var(--color-success)',
          borderRadius: 6, marginBottom: 12, fontSize: 13,
        }}>
          {info}
        </div>
      )}

      {/* Acciones */}
      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap',
        alignItems: 'center', marginBottom: 12,
      }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={cargarPreset}
          disabled={!editable || saving}
          title="Reemplaza las filas con el preset Mundial 2026 (200/50/25/-5/.../-50)"
        >
          🌍 Cargar preset Mundial 2026
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={agregarFila}
          disabled={!editable || saving}
        >
          + Agregar posición
        </button>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
          Total neto: <strong style={{
            color: totalNeto > 0 ? 'var(--color-success)' : totalNeto < 0 ? 'var(--color-danger)' : 'var(--color-text)',
          }}>{totalNeto >= 0 ? '+' : ''}{totalNeto} USD</strong>
        </span>
      </div>

      {/* Tabla editor */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--color-surface2)' }}>
              <th style={{ ...thStyle, width: 80 }}>Posición</th>
              <th style={{ ...thStyle, width: 140 }}>Premio/Castigo USD</th>
              <th style={{ ...thStyle, width: 140 }}>Comida</th>
              <th style={thStyle}>Hoy corresponde a</th>
              <th style={{ ...thStyle, width: 80, textAlign: 'right' }}>Puntos actuales</th>
              <th style={{ ...thStyle, width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {filasOrd.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>
                  No hay premios configurados. Usá <strong>+ Agregar posición</strong> o <strong>🌍 Cargar preset</strong>.
                </td>
              </tr>
            )}
            {filasOrd.map((f) => {
              const idxReal = filas.findIndex(x => x === f) // referencia estable
              const usuario = usuarioPorPosicion.get(f.posicion)
              const usd     = Number.isInteger(f.usd) ? f.usd : 0
              const usdColor = usd > 0 ? 'var(--color-success)' : usd < 0 ? 'var(--color-danger)' : 'var(--color-muted)'
              return (
                <tr key={`${f.posicion}-${idxReal}`} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td style={cellStyle}>
                    <input
                      type="number" min="1" step="1"
                      value={f.posicion}
                      onChange={e => setFila(idxReal, { posicion: parseInt(e.target.value, 10) || '' })}
                      disabled={!editable || saving}
                      style={{ ...inputStyle, width: 60, textAlign: 'right' }}
                    />
                  </td>
                  <td style={cellStyle}>
                    <input
                      type="number" step="1"
                      value={f.usd}
                      onChange={e => setFila(idxReal, { usd: e.target.value === '' ? '' : parseInt(e.target.value, 10) })}
                      disabled={!editable || saving}
                      style={{
                        ...inputStyle, width: 90, textAlign: 'right',
                        color: usdColor, fontWeight: 600,
                      }}
                    />
                  </td>
                  <td style={cellStyle}>
                    <select
                      value={f.comida_rol || ''}
                      onChange={e => setFila(idxReal, { comida_rol: e.target.value || null })}
                      disabled={!editable || saving}
                      style={{ ...inputStyle, width: 120, padding: '4px 6px', background: 'white' }}
                    >
                      {COMIDA_ROLES.map(rol => (
                        <option key={String(rol)} value={rol || ''}>
                          {COMIDA_LABELS[rol]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={cellStyle}>
                    {usuario ? (
                      <span style={{ fontWeight: 500 }}>{usuario.nombre}</span>
                    ) : (
                      <span style={{ color: 'var(--color-muted)', fontStyle: 'italic' }}>(sin user en esa posición)</span>
                    )}
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'right', color: 'var(--color-muted)', fontSize: 12 }}>
                    {usuario ? usuario.puntos : '—'}
                  </td>
                  <td style={cellStyle}>
                    <button
                      type="button"
                      onClick={() => quitarFila(idxReal)}
                      disabled={!editable || saving}
                      title="Quitar esta posición"
                      style={{
                        background: 'none', border: 'none', cursor: editable ? 'pointer' : 'default',
                        fontSize: 14, color: 'var(--color-muted)', padding: '4px 6px',
                      }}
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Save */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={load}
          disabled={saving}
        >
          Recargar
        </button>
        <button
          className="btn btn-primary btn-sm"
          onClick={guardar}
          disabled={!editable || saving}
          style={{ minWidth: 130 }}
        >
          {saving ? 'Guardando...' : '💾 Guardar premios'}
        </button>
      </div>
    </div>
  )
}

// ── Estilos ───────────────────────────────────────────────────────────
const thStyle = {
  padding: '8px 10px', textAlign: 'left',
  fontSize: 11, fontWeight: 700, color: 'var(--color-muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '2px solid var(--color-border)',
  whiteSpace: 'nowrap',
}
const cellStyle = {
  padding: '6px 10px',
  fontSize: 13,
  verticalAlign: 'middle',
}
const inputStyle = {
  border: '1px solid var(--color-border)',
  borderRadius: 4,
  padding: '4px 8px',
  fontSize: 13,
  outline: 'none',
  background: 'white',
}
