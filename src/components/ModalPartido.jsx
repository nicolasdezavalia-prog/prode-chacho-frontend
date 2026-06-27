/**
 * ModalPartido — Sprint goleadores-por-partido (2026-06-25)
 *
 * Modal del Fixture admin para cargar TODO de un partido en una pasada:
 *   - Goles totales por equipo
 *   - Goleadores desglosados por equipo (con autocomplete inteligente)
 *   - Amarillas / Rojas por equipo
 *   - Penales (solo KO)
 *   - Estado del partido (Pendiente/En juego/Finalizado/Suspendido)
 *   - Observación
 *
 * Guarda con PUT /partidos/:id/full en una transacción.
 * El autocomplete de jugador trae sugerencias de 4 fuentes (datos_utiles,
 * goleadores, premios, partido_goleadores) y permite crear inline.
 *
 * Si la suma de goles de los goleadores no coincide con goles_local/visitante,
 * muestra un warning NO bloqueante (puede haber autogoles).
 */
import { useEffect, useState, useMemo, useRef } from 'react'
import { api } from '../api/index.js'

const ESTADOS = ['pendiente', 'en_juego', 'finalizado', 'suspendido']
const ESTADO_LABEL = {
  pendiente: 'Pendiente', en_juego: 'En juego',
  finalizado: 'Finalizado', suspendido: 'Suspendido',
}

const RONDA_LABEL = {
  grupos: 'Grupos', '16vos': '16vos', '8vos': 'Octavos',
  '4tos': 'Cuartos', semis: 'Semis', tercer_puesto: '3er puesto', final: 'Final',
}

export default function ModalPartido({ torneoId, partido, equiposCatalogo = [], onClose, onSaved }) {
  // Buffer del partido (campos editables).
  const [form, setForm] = useState({
    goles_local:         partido?.goles_local ?? '',
    goles_visitante:     partido?.goles_visitante ?? '',
    penales_local:       partido?.penales_local ?? '',
    penales_visitante:   partido?.penales_visitante ?? '',
    amarillas_local:     partido?.amarillas_local ?? '',
    amarillas_visitante: partido?.amarillas_visitante ?? '',
    rojas_local:         partido?.rojas_local ?? '',
    rojas_visitante:     partido?.rojas_visitante ?? '',
    estado:              partido?.estado || 'pendiente',
    observacion:         partido?.observacion || '',
  })
  // Goleadores: [{ jugador, equipo_codigo, goles }]
  const [goleadores, setGoleadores] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const localEq    = equiposCatalogo.find(e => e.codigo === partido?.equipo_local)
  const visitanteEq= equiposCatalogo.find(e => e.codigo === partido?.equipo_visitante)
  const esKO = partido?.ronda && partido.ronda !== 'grupos'

  useEffect(() => {
    let cancel = false
    if (!partido?.id) { setLoading(false); return }
    api.getMundialPartidoGoleadores(torneoId, partido.id)
      .then(r => {
        if (cancel) return
        setGoleadores(Array.isArray(r?.goleadores) ? r.goleadores.map(g => ({
          jugador: g.jugador, equipo_codigo: g.equipo_codigo, goles: g.goles,
        })) : [])
      })
      .catch(e => { if (!cancel) setError(e.message || String(e)) })
      .finally(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [torneoId, partido?.id])

  function setF(campo, valor) { setForm(prev => ({ ...prev, [campo]: valor })) }
  function parseIntOrEmpty(v) {
    if (v === '' || v === null || v === undefined) return ''
    const n = parseInt(v, 10)
    return Number.isInteger(n) && n >= 0 ? n : ''
  }

  // Suma de goleadores por equipo
  const sumaLocal     = goleadores.filter(g => g.equipo_codigo === partido?.equipo_local).reduce((a, g) => a + (g.goles || 0), 0)
  const sumaVisitante = goleadores.filter(g => g.equipo_codigo === partido?.equipo_visitante).reduce((a, g) => a + (g.goles || 0), 0)
  const golesLocalNum     = Number.isInteger(form.goles_local) ? form.goles_local : null
  const golesVisitanteNum = Number.isInteger(form.goles_visitante) ? form.goles_visitante : null

  function addGoleador(equipo_codigo, jugador) {
    if (!jugador.trim()) return
    // Si ya existe ese jugador en ese equipo, sumarle 1. Sino agregar con 1.
    setGoleadores(prev => {
      const idx = prev.findIndex(g => g.equipo_codigo === equipo_codigo && g.jugador.trim().toLowerCase() === jugador.trim().toLowerCase())
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], goles: next[idx].goles + 1 }
        return next
      }
      return [...prev, { jugador: jugador.trim(), equipo_codigo, goles: 1 }]
    })
  }
  function setGolesGoleador(idx, goles) {
    const n = parseInt(goles, 10)
    if (!Number.isInteger(n) || n < 1) return
    setGoleadores(prev => prev.map((g, i) => i === idx ? { ...g, goles: n } : g))
  }
  function removeGoleador(idx) {
    setGoleadores(prev => prev.filter((_, i) => i !== idx))
  }

  async function guardar() {
    if (!partido?.id) return
    setSaving(true); setError('')
    try {
      const payload = {
        goles_local:         Number.isInteger(form.goles_local) ? form.goles_local : null,
        goles_visitante:     Number.isInteger(form.goles_visitante) ? form.goles_visitante : null,
        penales_local:       Number.isInteger(form.penales_local) ? form.penales_local : null,
        penales_visitante:   Number.isInteger(form.penales_visitante) ? form.penales_visitante : null,
        amarillas_local:     Number.isInteger(form.amarillas_local) ? form.amarillas_local : null,
        amarillas_visitante: Number.isInteger(form.amarillas_visitante) ? form.amarillas_visitante : null,
        rojas_local:         Number.isInteger(form.rojas_local) ? form.rojas_local : null,
        rojas_visitante:     Number.isInteger(form.rojas_visitante) ? form.rojas_visitante : null,
        estado:              form.estado,
        observacion:         form.observacion || null,
        goleadores:          goleadores.map(g => ({ jugador: g.jugador, equipo_codigo: g.equipo_codigo, goles: g.goles })),
      }
      const r = await api.saveMundialPartidoFull(torneoId, partido.id, payload)
      if (onSaved) onSaved(r)
      onClose()
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  if (!partido) return null

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 12,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: 12, padding: 20,
        width: '100%', maxWidth: 720, maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 700 }}>
            {RONDA_LABEL[partido.ronda] || partido.ronda} {partido.grupo && `· Grupo ${partido.grupo}`} · #{partido.orden}
          </span>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, flex: 1 }}>
            {localEq?.emoji} {localEq?.nombre || partido.equipo_local}
            <span style={{ color: 'var(--color-muted)', margin: '0 8px' }}>vs</span>
            {visitanteEq?.emoji} {visitanteEq?.nombre || partido.equipo_visitante}
          </h3>
        </div>

        {/* Estado y observación */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            Estado
            <select value={form.estado} onChange={e => setF('estado', e.target.value)}
              style={{ display: 'block', marginTop: 2, padding: '6px 10px', fontSize: 14, borderRadius: 6, border: '1px solid var(--color-border)' }}>
              {ESTADOS.map(s => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: 'var(--color-muted)', flex: 1, minWidth: 200 }}>
            Observación
            <input type="text" value={form.observacion} maxLength={200} onChange={e => setF('observacion', e.target.value)}
              placeholder="opcional"
              style={{ display: 'block', marginTop: 2, width: '100%', padding: '6px 10px', fontSize: 14, borderRadius: 6, border: '1px solid var(--color-border)' }}/>
          </label>
        </div>

        {loading && <div style={{ color: 'var(--color-muted)', fontSize: 13 }}>Cargando goleadores...</div>}
        {error && (
          <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.10)', color: 'var(--color-danger)', borderRadius: 6, marginBottom: 10, fontSize: 13 }}>
            {error}
          </div>
        )}

        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Columna LOCAL */}
            <LadoPartido
              torneoId={torneoId}
              equipo={localEq}
              equipoCodigo={partido.equipo_local}
              golesEquipo={form.goles_local}
              setGolesEquipo={v => setF('goles_local', parseIntOrEmpty(v))}
              amarillas={form.amarillas_local}
              setAmarillas={v => setF('amarillas_local', parseIntOrEmpty(v))}
              rojas={form.rojas_local}
              setRojas={v => setF('rojas_local', parseIntOrEmpty(v))}
              penales={form.penales_local}
              setPenales={v => setF('penales_local', parseIntOrEmpty(v))}
              esKO={esKO}
              goleadores={goleadores.filter(g => g.equipo_codigo === partido.equipo_local)}
              goleadoresIdxBase={(jugador) => goleadores.findIndex(g => g.equipo_codigo === partido.equipo_local && g.jugador === jugador)}
              setGolesGoleador={setGolesGoleador}
              removeGoleador={removeGoleador}
              addGoleador={(jugador) => addGoleador(partido.equipo_local, jugador)}
              sumaGoleadores={sumaLocal}
              golesEquipoNum={golesLocalNum}
            />
            {/* Columna VISITANTE */}
            <LadoPartido
              torneoId={torneoId}
              equipo={visitanteEq}
              equipoCodigo={partido.equipo_visitante}
              golesEquipo={form.goles_visitante}
              setGolesEquipo={v => setF('goles_visitante', parseIntOrEmpty(v))}
              amarillas={form.amarillas_visitante}
              setAmarillas={v => setF('amarillas_visitante', parseIntOrEmpty(v))}
              rojas={form.rojas_visitante}
              setRojas={v => setF('rojas_visitante', parseIntOrEmpty(v))}
              penales={form.penales_visitante}
              setPenales={v => setF('penales_visitante', parseIntOrEmpty(v))}
              esKO={esKO}
              goleadores={goleadores.filter(g => g.equipo_codigo === partido.equipo_visitante)}
              goleadoresIdxBase={(jugador) => goleadores.findIndex(g => g.equipo_codigo === partido.equipo_visitante && g.jugador === jugador)}
              setGolesGoleador={setGolesGoleador}
              removeGoleador={removeGoleador}
              addGoleador={(jugador) => addGoleador(partido.equipo_visitante, jugador)}
              sumaGoleadores={sumaVisitante}
              golesEquipoNum={golesVisitanteNum}
            />
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm" disabled={saving}>
            Cancelar
          </button>
          <button type="button" onClick={guardar} className="btn btn-primary btn-sm" disabled={saving || loading}>
            {saving ? 'Guardando...' : '💾 Guardar partido'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// LadoPartido — columna por equipo (local o visitante).
// ─────────────────────────────────────────────────────────────────────────
function LadoPartido({
  torneoId, equipo, equipoCodigo,
  golesEquipo, setGolesEquipo,
  amarillas, setAmarillas, rojas, setRojas,
  penales, setPenales, esKO,
  goleadores, addGoleador, setGolesGoleador, removeGoleador, goleadoresIdxBase,
  sumaGoleadores, golesEquipoNum,
}) {
  // Warning visual
  let warningSuma = null
  if (Number.isInteger(golesEquipoNum) && goleadores.length > 0) {
    if (sumaGoleadores < golesEquipoNum) {
      warningSuma = `⚠ Falta${golesEquipoNum - sumaGoleadores === 1 ? '' : 'n'} ${golesEquipoNum - sumaGoleadores} gol(es) por asignar`
    } else if (sumaGoleadores > golesEquipoNum) {
      warningSuma = `⚠ Hay ${sumaGoleadores - golesEquipoNum} gol(es) de más`
    }
  }

  return (
    <div style={{ padding: '12px 10px', border: '1px solid var(--color-border)', borderRadius: 8 }}>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>
        {equipo?.emoji} {equipo?.nombre || equipoCodigo}
      </div>
      <label style={{ fontSize: 12, color: 'var(--color-muted)', display: 'block', marginBottom: 8 }}>
        Goles equipo
        <input type="number" min="0" value={golesEquipo} onChange={e => setGolesEquipo(e.target.value)}
          style={{ display: 'block', marginTop: 2, width: 80, padding: '6px 10px', fontSize: 14, borderRadius: 6, border: '1px solid var(--color-border)' }}/>
      </label>

      <div style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 700, marginBottom: 4 }}>Goleadores</div>
      {goleadores.length === 0 && <div style={{ fontSize: 11, color: 'var(--color-muted)', fontStyle: 'italic', marginBottom: 6 }}>sin goleadores cargados</div>}
      {goleadores.map((g) => (
        <div key={g.jugador} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <span style={{ flex: 1, fontSize: 13 }}>{g.jugador}</span>
          <input type="number" min="1" value={g.goles}
            onChange={e => setGolesGoleador(goleadoresIdxBase(g.jugador), e.target.value)}
            style={{ width: 50, padding: '2px 6px', fontSize: 12, borderRadius: 4, border: '1px solid var(--color-border)', textAlign: 'center' }}/>
          <button type="button" onClick={() => removeGoleador(goleadoresIdxBase(g.jugador))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: 16, padding: 0, lineHeight: 1 }} title="Quitar">×</button>
        </div>
      ))}

      <JugadorAutocomplete torneoId={torneoId} equipoCodigo={equipoCodigo} onSelect={addGoleador} />

      {warningSuma && (
        <div style={{ fontSize: 11, color: '#a16207', marginTop: 6 }}>{warningSuma}</div>
      )}
      {Number.isInteger(golesEquipoNum) && sumaGoleadores === golesEquipoNum && goleadores.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--color-success)', marginTop: 6 }}>↳ Suma {sumaGoleadores} ✓</div>
      )}

      <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 11, color: 'var(--color-muted)' }}>
          🟨 Amarillas
          <input type="number" min="0" value={amarillas} onChange={e => setAmarillas(e.target.value)}
            style={{ display: 'block', marginTop: 2, width: 60, padding: '4px 8px', fontSize: 13, borderRadius: 4, border: '1px solid var(--color-border)' }}/>
        </label>
        <label style={{ fontSize: 11, color: 'var(--color-muted)' }}>
          🟥 Rojas
          <input type="number" min="0" value={rojas} onChange={e => setRojas(e.target.value)}
            style={{ display: 'block', marginTop: 2, width: 60, padding: '4px 8px', fontSize: 13, borderRadius: 4, border: '1px solid var(--color-border)' }}/>
        </label>
        {esKO && (
          <label style={{ fontSize: 11, color: 'var(--color-muted)' }}>
            Penales
            <input type="number" min="0" value={penales} onChange={e => setPenales(e.target.value)}
              style={{ display: 'block', marginTop: 2, width: 60, padding: '4px 8px', fontSize: 13, borderRadius: 4, border: '1px solid var(--color-border)' }}/>
          </label>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// JugadorAutocomplete — autocomplete con sugerencias de 4 fuentes.
// Permite crear inline si no hay coincidencias.
// ─────────────────────────────────────────────────────────────────────────
function JugadorAutocomplete({ torneoId, equipoCodigo, onSelect }) {
  const [texto, setTexto] = useState('')
  const [sugerencias, setSugerencias] = useState([])
  const [foco, setFoco] = useState(false)
  const cacheRef = useRef(null)

  // Cargar sugerencias UNA vez al focusear (cache por equipo).
  async function loadSugerencias() {
    if (cacheRef.current && cacheRef.current.equipo === equipoCodigo) return
    try {
      const r = await api.getMundialJugadoresConocidos(torneoId, equipoCodigo)
      cacheRef.current = { equipo: equipoCodigo, list: Array.isArray(r?.jugadores) ? r.jugadores : [] }
      setSugerencias(cacheRef.current.list)
    } catch (e) {
      cacheRef.current = { equipo: equipoCodigo, list: [] }
      setSugerencias([])
    }
  }

  const filtradas = useMemo(() => {
    const q = texto.trim().toLowerCase()
    if (!q) return sugerencias.slice(0, 8)
    return sugerencias.filter(s => s.jugador.toLowerCase().includes(q)).slice(0, 8)
  }, [texto, sugerencias])

  const exacto = filtradas.find(s => s.jugador.trim().toLowerCase() === texto.trim().toLowerCase())
  const puedeCrear = texto.trim().length > 0 && !exacto

  function add(nombre) {
    onSelect(nombre)
    setTexto('')
  }

  return (
    <div style={{ position: 'relative', marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          type="text"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onFocus={() => { setFoco(true); loadSugerencias() }}
          onBlur={() => setTimeout(() => setFoco(false), 150)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); if (texto.trim()) add(texto) }
          }}
          placeholder="Agregar goleador..."
          style={{ flex: 1, padding: '4px 8px', fontSize: 12, borderRadius: 4, border: '1px solid var(--color-border)' }}
        />
        <button type="button" onClick={() => texto.trim() && add(texto)}
          className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '2px 8px' }}
          disabled={!texto.trim()}>
          + Agregar
        </button>
      </div>
      {foco && (filtradas.length > 0 || puedeCrear) && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
          marginTop: 2, background: 'white',
          border: '1px solid var(--color-border)',
          borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          maxHeight: 200, overflowY: 'auto', fontSize: 12,
        }}>
          {filtradas.map(s => (
            <div key={s.jugador} onMouseDown={() => add(s.jugador)}
              style={{
                padding: '6px 10px', cursor: 'pointer',
                borderBottom: '1px solid rgba(0,0,0,0.05)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              {s.jugador}
              <span style={{ color: 'var(--color-muted)', marginLeft: 6, fontSize: 10 }}>
                · {s.apariciones} prev.
              </span>
            </div>
          ))}
          {puedeCrear && (
            <div onMouseDown={() => add(texto)}
              style={{
                padding: '6px 10px', cursor: 'pointer', fontStyle: 'italic',
                background: 'rgba(22,163,74,0.06)', color: 'var(--color-success)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(22,163,74,0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(22,163,74,0.06)'}
            >
              + Crear "{texto.trim()}" como jugador nuevo
            </div>
          )}
        </div>
      )}
    </div>
  )
}
