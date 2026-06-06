/**
 * AdminMundialTarjetasMatriz — Datos útiles Fase 2 (Tarjetas estructuradas)
 *
 * Sub-tab dentro de AdminMundialDatosUtiles. Carga matriz Equipo × Partido
 * para amarillas y rojas. UX tipo Excel:
 *   - Dos tablas separadas (una arriba amarillas, otra abajo rojas).
 *   - Filas: TODOS los equipos del catálogo (incluso sin datos cargados).
 *   - Columnas: Partido 1..N (configurable; default 8 — los 8 partidos
 *     posibles del Mundial: 3 grupos + 16avos + 8avos + 4tos + semi + final).
 *     Equipos eliminados antes simplemente quedan en 0 o vacío.
 *   - Si max_partido_num cargado supera 8, se respeta ese máximo.
 *   - Dirty tracking por (equipo, partido): solo las celdas modificadas
 *     entran al bulk al guardar.
 *   - Botón "+ Partido" agrega columnas. No se permite reducir por debajo
 *     de 8 ni del max_partido_num cargado para no esconder datos.
 *
 * Persistencia:
 *   - PUT bulk con sólo las celdas modificadas. El backend UPSERT y
 *     responde el shape completo recalculado → refrescamos del response.
 *   - Una celda sin fila en DB se trata como 0. Al editarla se vuelve
 *     dirty y entra al próximo save aunque quede en 0.
 *
 * Sin observación (foco en números). Sin scoring, sin ranking, cero
 * acoplamiento con el resto del módulo.
 */

import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/index.js'

// Mundial: 3 partidos de grupo + 16avos + 8avos + 4tos + semi + final = 8.
// Es el máximo de partidos que un equipo puede jugar. Equipos eliminados
// antes simplemente quedan en 0 o vacío en las columnas posteriores.
const PARTIDOS_DEFAULT = 8

export default function AdminMundialTarjetasMatriz({ torneoId }) {
  const [equipos, setEquipos]       = useState([])
  // Map { 'equipo_codigo|partido_num' → { amarillas, rojas, observacion } }
  const [celdas, setCeldas]         = useState(new Map())
  // Set de keys 'equipo_codigo|partido_num' modificadas desde el último load.
  const [dirty, setDirty]           = useState(new Set())
  // ── Estado de columnas (refactor 2026-06-04) ─────────────────────────────
  // Separamos "piso calculado desde backend" de "expansión temporal del admin".
  // Esto hace imposible que la UI muestre más columnas que las autorizadas
  // por el backend (`max_partido_num`) salvo que el admin haya tocado
  // explícitamente "+ Partido" en esta sesión.
  //
  //   maxRealCargado: viene de data.max_partido_num. Backend ya lo calcula
  //                   ignorando celdas 0/0 sin observación.
  //   extraPartidos:  contador de columnas extra que el admin sumó con
  //                   "+ Partido". Se RESETEA a 0 en cada load/save.
  //
  // partidosVisibles (derivado) = max(PARTIDOS_DEFAULT, maxRealCargado) + extraPartidos.
  // Por construcción nunca cae por debajo de PARTIDOS_DEFAULT (8) ni del
  // máximo real cargado, y nunca crece por preservación de prev.
  const [maxRealCargado, setMaxRealCargado] = useState(0)
  const [extraPartidos, setExtraPartidos]   = useState(0)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [info, setInfo]             = useState('')

  useEffect(() => { load() /* eslint-disable-next-line */ }, [torneoId])

  function ingestData(data, equiposList) {
    const map = new Map()
    for (const c of (data?.celdas || [])) {
      map.set(`${c.equipo_codigo}|${c.partido_num}`, {
        amarillas:   c.amarillas,
        rojas:       c.rojas,
        observacion: c.observacion || null,
      })
    }
    setCeldas(map)
    setDirty(new Set())
    // Source of truth: backend. max_partido_num viene calculado ignorando
    // celdas 0/0 sin observación (ver routes/mundial.js → celdaTieneDataReal).
    // Number() defensivo por si el backend lo manda como string en algún caso.
    const maxReal = Number(data?.max_partido_num) || 0
    setMaxRealCargado(maxReal)
    // Reset cualquier expansión temporal — si admin había hecho + Partido
    // pero no guardó valores reales, esas columnas desaparecen al recargar.
    setExtraPartidos(0)
    return { map, maxReal }
  }

  async function load() {
    setLoading(true); setError(''); setInfo('')
    try {
      const [cat, data] = await Promise.all([
        api.getMundialEquiposCatalogo(torneoId).catch(() => []),
        api.getMundialTarjetasPartido(torneoId).catch(() => null),
      ])
      const catList = Array.isArray(cat) ? cat.filter(e => e.activo !== 0) : []
      setEquipos(catList)
      ingestData(data, catList)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  // ── Helpers de lectura ──────────────────────────────────────────────────
  function getCelda(codigo, partido) {
    return celdas.get(`${codigo}|${partido}`) || { amarillas: 0, rojas: 0, observacion: null }
  }
  function getValor(codigo, partido, campo) {
    const c = celdas.get(`${codigo}|${partido}`)
    if (!c) return 0
    return Number.isInteger(c[campo]) ? c[campo] : 0
  }
  // Floor calculado desde backend + extras del admin. Source of truth única.
  const floorPartidos      = Math.max(PARTIDOS_DEFAULT, maxRealCargado)
  const partidosVisibles   = floorPartidos + extraPartidos
  function totalEquipo(codigo, campo) {
    let s = 0
    for (let p = 1; p <= partidosVisibles; p++) s += getValor(codigo, p, campo)
    return s
  }

  // ── Edición ─────────────────────────────────────────────────────────────
  // setVal asegura que el dirty incluya la celda. Mantiene la otra columna
  // (amarillas o rojas) intacta y la observacion previa.
  function setVal(codigo, partido, campo, raw) {
    setError('')
    let v = raw === '' ? 0 : parseInt(raw, 10)
    if (!Number.isInteger(v) || v < 0) v = 0
    const key = `${codigo}|${partido}`
    setCeldas(prev => {
      const next = new Map(prev)
      const cur  = next.get(key) || { amarillas: 0, rojas: 0, observacion: null }
      next.set(key, { ...cur, [campo]: v })
      return next
    })
    setDirty(prev => {
      const next = new Set(prev)
      next.add(key)
      return next
    })
  }

  function agregarPartido() {
    // Suma una columna extra. Floor (8 ó max real cargado) queda intacto.
    setExtraPartidos(n => n + 1)
  }
  function quitarPartido() {
    // Solo achica las columnas EXTRA que el admin agregó. No se puede ir
    // por debajo del floor (PARTIDOS_DEFAULT ó max real cargado) — eso
    // escondería datos reales.
    setExtraPartidos(n => Math.max(0, n - 1))
  }

  async function guardar() {
    if (saving) return
    if (dirty.size === 0) { setInfo('No hay cambios para guardar.'); return }
    setError(''); setInfo(''); setSaving(true)
    try {
      const payload = []
      for (const key of dirty) {
        const [codigo, partStr] = key.split('|')
        const partido = parseInt(partStr, 10)
        const c = getCelda(codigo, partido)
        payload.push({
          equipo_codigo: codigo,
          partido_num:   partido,
          amarillas:     c.amarillas,
          rojas:         c.rojas,
          // Observación no editable en UI Fase 2 — mandamos null para no
          // pisar lo que pudiera estar cargado por DB previa.
          // Si en el futuro habilitamos el campo, replazar por c.observacion.
          observacion:   c.observacion,
        })
      }
      const data = await api.saveMundialTarjetasPartidoBulk(torneoId, payload)
      ingestData(data, equipos)
      setInfo(`Guardado · ${payload.length} celda${payload.length === 1 ? '' : 's'}.`)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  const partidos = useMemo(
    () => Array.from({ length: partidosVisibles }, (_, i) => i + 1),
    [partidosVisibles]
  )

  if (loading) return <div className="loading">Cargando matriz de tarjetas...</div>

  if (equipos.length === 0) {
    return (
      <div style={emptyBox}>
        Cargá equipos primero en la tab <strong>🌐 Equipos</strong>.
      </div>
    )
  }

  return (
    <div>
      {/* Controles globales */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
        marginBottom: 10,
      }}>
        <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
          Partidos visibles: <strong>{partidosVisibles}</strong>
        </span>
        <button
          className="btn btn-secondary btn-sm"
          onClick={quitarPartido}
          disabled={saving || extraPartidos === 0}
          title={
            extraPartidos === 0
              ? `Mínimo ${floorPartidos} (para no esconder datos reales)`
              : 'Quitar la última columna agregada'
          }
        >
          − Partido
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={agregarPartido}
          disabled={saving}
        >
          + Partido
        </button>
        <span style={{ flex: 1 }} />
        {dirty.size > 0 && (
          <span style={{
            fontSize: 11, color: '#a16207', background: 'rgba(234,179,8,0.12)',
            padding: '3px 8px', borderRadius: 99, fontWeight: 600,
          }}>
            {dirty.size} celda{dirty.size === 1 ? '' : 's'} sin guardar
          </span>
        )}
        <button
          className="btn btn-primary btn-sm"
          onClick={guardar}
          disabled={saving || dirty.size === 0}
          style={{ minWidth: 130 }}
        >
          {saving ? 'Guardando…' : '💾 Guardar'}
        </button>
      </div>

      {error && <div className="error-msg" style={{ marginBottom: 10 }}>{error}</div>}
      {info && (
        <div style={{
          padding: '6px 10px', marginBottom: 10,
          background: 'rgba(22,163,74,0.10)', color: 'var(--color-success)',
          borderRadius: 6, fontSize: 12,
        }}>{info}</div>
      )}

      {/* Matrices: amarillas + rojas */}
      <Matriz
        emoji="🟨"
        titulo="Amarillas"
        equipos={equipos}
        partidos={partidos}
        campo="amarillas"
        getValor={getValor}
        totalEquipo={totalEquipo}
        setVal={setVal}
        dirty={dirty}
        disabled={saving}
      />
      <div style={{ height: 16 }} />
      <Matriz
        emoji="🟥"
        titulo="Rojas"
        equipos={equipos}
        partidos={partidos}
        campo="rojas"
        getValor={getValor}
        totalEquipo={totalEquipo}
        setVal={setVal}
        dirty={dirty}
        disabled={saving}
      />

      <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 10, lineHeight: 1.5 }}>
        Tip: usá <kbd style={kbd}>Tab</kbd> para saltar de celda en celda. Solo se guardan las celdas que hayas modificado.
      </div>
    </div>
  )
}

// ── Sub-componentes ──────────────────────────────────────────────────────

function Matriz({ emoji, titulo, equipos, partidos, campo, getValor, totalEquipo, setVal, dirty, disabled }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--color-surface2, #f1f3f5)' }}>
            <th style={{ ...thMatriz, textAlign: 'left' }}>
              <span style={{ marginRight: 6, fontSize: 16 }}>{emoji}</span>
              {titulo}
            </th>
            {partidos.map(p => (
              <th key={p} style={{ ...thMatriz, textAlign: 'center' }}>P{p}</th>
            ))}
            <th style={{ ...thMatriz, textAlign: 'right', borderLeft: '2px solid var(--color-border)' }}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {equipos.map(eq => {
            const total = totalEquipo(eq.codigo, campo)
            return (
              <tr key={eq.codigo} style={{ borderTop: '1px solid var(--color-border)' }}>
                <td style={tdEquipo}>
                  <span style={{ marginRight: 6 }}>{eq.emoji || ''}</span>
                  {eq.nombre}
                  {eq.grupo && (
                    <span style={{ color: 'var(--color-muted)', marginLeft: 6, fontSize: 11 }}>
                      · Grupo {eq.grupo}
                    </span>
                  )}
                </td>
                {partidos.map(p => {
                  const v = getValor(eq.codigo, p, campo)
                  const isDirty = dirty.has(`${eq.codigo}|${p}`)
                  return (
                    <td key={p} style={{ ...tdInput, background: isDirty ? 'rgba(234,179,8,0.08)' : 'transparent' }}>
                      <input
                        type="number" min="0" step="1"
                        value={v}
                        onChange={e => setVal(eq.codigo, p, campo, e.target.value)}
                        disabled={disabled}
                        style={inputCelda}
                      />
                    </td>
                  )
                })}
                <td style={tdTotal}>
                  <strong>{total}</strong>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────
const thMatriz = {
  padding: '8px 10px',
  fontSize: 11, fontWeight: 700, color: 'var(--color-muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '2px solid var(--color-border)',
  whiteSpace: 'nowrap',
}
const tdEquipo = {
  padding: '6px 10px',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  borderRight: '1px solid var(--color-border)',
}
const tdInput = {
  padding: '4px 6px',
  textAlign: 'center',
  width: 56,
}
const tdTotal = {
  padding: '6px 10px',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  borderLeft: '2px solid var(--color-border)',
  background: 'rgba(0,0,0,0.025)',
}
const inputCelda = {
  width: 44,
  padding: '4px 6px',
  fontSize: 13,
  border: '1px solid var(--color-border)',
  borderRadius: 4,
  textAlign: 'center',
  fontVariantNumeric: 'tabular-nums',
  background: 'white',
  outline: 'none',
}
const emptyBox = {
  padding: '16px 18px', textAlign: 'center',
  background: 'rgba(0,0,0,0.04)', color: 'var(--color-muted)',
  borderRadius: 8, fontSize: 14, lineHeight: 1.5,
}
const kbd = {
  background: 'rgba(0,0,0,0.06)', padding: '0 4px',
  borderRadius: 3, fontFamily: 'monospace', fontSize: 10,
}
