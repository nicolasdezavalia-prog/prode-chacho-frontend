/**
 * ModalPartido — Sprint A fix-modal (2026-06-27):
 *   - Fuente de verdad: siempre el backend. La prop `partido` se usa SOLO
 *     como identidad (id + ronda + grupo + orden + equipos). Todos los goles,
 *     tarjetas, penales, estado, observacion y goleadores vienen del fetch.
 *   - Si el fetch falla, se muestra un error grande y se BLOQUEA el guardar
 *     para evitar pisar el backend con datos vacios.
 *   - Boton "+ Autogol" para cargar goles sin nombre de goleador.
 *   - Validacion "finalizado sin goles" antes de enviar (ademas del backend).
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
const AUTOGOL_JUGADOR = 'Autogol'

export default function ModalPartido({ torneoId, partido, equiposCatalogo = [], onClose, onSaved }) {
  const [form, setForm] = useState(vacio())
  const [goleadores, setGoleadores] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const localEq = equiposCatalogo.find(e => e.codigo === partido?.equipo_local)
  const visitanteEq = equiposCatalogo.find(e => e.codigo === partido?.equipo_visitante)
  const esKO = partido?.ronda && partido.ronda !== 'grupos'

  useEffect(() => {
    let cancel = false
    if (!partido?.id) { setLoading(false); return }
    setLoading(true); setLoadFailed(false); setError('')
    api.getMundialPartidoGoleadores(torneoId, partido.id)
      .then(r => {
        if (cancel) return
        // Sprint A: usar el partido persistido, no la prop.
        const p = r?.partido || {}
        setForm({
          goles_local:         intOrEmpty(p.goles_local),
          goles_visitante:     intOrEmpty(p.goles_visitante),
          penales_local:       intOrEmpty(p.penales_local),
          penales_visitante:   intOrEmpty(p.penales_visitante),
          amarillas_local:     intOrEmpty(p.amarillas_local),
          amarillas_visitante: intOrEmpty(p.amarillas_visitante),
          rojas_local:         intOrEmpty(p.rojas_local),
          rojas_visitante:     intOrEmpty(p.rojas_visitante),
          estado:              p.estado || 'pendiente',
          observacion:         p.observacion || '',
        })
        setGoleadores(Array.isArray(r?.goleadores) ? r.goleadores.map(g => ({
          jugador: g.jugador, equipo_codigo: g.equipo_codigo, goles: g.goles,
        })) : [])
      })
      .catch(e => {
        if (!cancel) { setError('No pude cargar el partido: ' + (e.message || e)); setLoadFailed(true) }
      })
      .finally(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [torneoId, partido?.id])

  function setF(campo, valor) { setForm(prev => ({ ...prev, [campo]: valor })) }
  function parseIntOrEmpty(v) {
    if (v === '' || v === null || v === undefined) return ''
    const n = parseInt(v, 10)
    return Number.isInteger(n) && n >= 0 ? n : ''
  }

  const sumaLocal = goleadores.filter(g => g.equipo_codigo === partido?.equipo_local).reduce((a, g) => a + (g.goles || 0), 0)
  const sumaVisitante = goleadores.filter(g => g.equipo_codigo === partido?.equipo_visitante).reduce((a, g) => a + (g.goles || 0), 0)
  const golesLocalNum = Number.isInteger(form.goles_local) ? form.goles_local : null
  const golesVisitanteNum = Number.isInteger(form.goles_visitante) ? form.goles_visitante : null

  function addGoleador(equipo_codigo, jugador) {
    const nombre = (jugador || '').trim()
    if (!nombre) return
    setGoleadores(prev => {
      const idx = prev.findIndex(g => g.equipo_codigo === equipo_codigo && sameJugador(g.jugador, nombre))
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], goles: next[idx].goles + 1 }
        return next
      }
      return [...prev, { jugador: nombre, equipo_codigo, goles: 1 }]
    })
  }
  function addAutogol(equipo_codigo) {
    addGoleador(equipo_codigo, AUTOGOL_JUGADOR)
  }
  function setGolesGoleador(idx, goles) {
    if (idx < 0) return
    const raw = (goles === '' || goles === null || goles === undefined) ? 0 : parseInt(goles, 10)
    if (!Number.isInteger(raw) || raw < 0) return
    if (raw === 0) {
      setGoleadores(prev => prev.filter((_, i) => i !== idx))
      return
    }
    setGoleadores(prev => prev.map((g, i) => i === idx ? { ...g, goles: raw } : g))
  }
  function removeGoleador(idx) {
    if (idx < 0) return
    setGoleadores(prev => prev.filter((_, i) => i !== idx))
  }

  async function guardar() {
    if (!partido?.id) return
    if (loadFailed) { setError('No se pudo cargar el partido — no guardo para no pisar datos.'); return }
    if (loading) return
    // Sprint A: validacion cliente "finalizado + sin goles".
    if (form.estado === 'finalizado' &&
        (!Number.isInteger(form.goles_local) || !Number.isInteger(form.goles_visitante))) {
      setError('Partido finalizado requiere goles cargados en ambos equipos.')
      return
    }
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
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: 12, padding: 20,
        width: '100%', maxWidth: 720, maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
      }}>
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

        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            Estado
            <select value={form.estado} onChange={e => setF('estado', e.target.value)} disabled={loadFailed || loading}
              style={{ display: 'block', marginTop: 2, padding: '6px 10px', fontSize: 14, borderRadius: 6, border: '1px solid var(--color-border)' }}>
              {ESTADOS.map(s => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: 'var(--color-muted)', flex: 1, minWidth: 200 }}>
            Observación
            <input type="text" value={form.observacion} maxLength={200} onChange={e => setF('observacion', e.target.value)} disabled={loadFailed || loading}
              placeholder="opcional"
              style={{ display: 'block', marginTop: 2, width: '100%', padding: '6px 10px', fontSize: 14, borderRadius: 6, border: '1px solid var(--color-border)' }}/>
          </label>
        </div>

        {loading && <div style={{ color: 'var(--color-muted)', fontSize: 13, marginBottom: 10 }}>Cargando partido...</div>}
        {error && (
          <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.10)', color: 'var(--color-danger)', borderRadius: 6, marginBottom: 10, fontSize: 13 }}>
            {error}
          </div>
        )}

        {!loading && !loadFailed && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <LadoPartido
              torneoId={torneoId} equipo={localEq} equipoCodigo={partido.equipo_local}
              golesEquipo={form.goles_local} setGolesEquipo={v => setF('goles_local', parseIntOrEmpty(v))}
              amarillas={form.amarillas_local} setAmarillas={v => setF('amarillas_local', parseIntOrEmpty(v))}
              rojas={form.rojas_local} setRojas={v => setF('rojas_local', parseIntOrEmpty(v))}
              penales={form.penales_local} setPenales={v => setF('penales_local', parseIntOrEmpty(v))} esKO={esKO}
              goleadores={goleadores.filter(g => g.equipo_codigo === partido.equipo_local)}
              goleadoresIdxBase={(jugador) => goleadores.findIndex(g => g.equipo_codigo === partido.equipo_local && sameJugador(g.jugador, jugador))}
              setGolesGoleador={setGolesGoleador} removeGoleador={removeGoleador}
              addGoleador={(jugador) => addGoleador(partido.equipo_local, jugador)}
              addAutogol={() => addAutogol(partido.equipo_local)}
              sumaGoleadores={sumaLocal} golesEquipoNum={golesLocalNum}
            />
            <LadoPartido
              torneoId={torneoId} equipo={visitanteEq} equipoCodigo={partido.equipo_visitante}
              golesEquipo={form.goles_visitante} setGolesEquipo={v => setF('goles_visitante', parseIntOrEmpty(v))}
              amarillas={form.amarillas_visitante} setAmarillas={v => setF('amarillas_visitante', parseIntOrEmpty(v))}
              rojas={form.rojas_visitante} setRojas={v => setF('rojas_visitante', parseIntOrEmpty(v))}
              penales={form.penales_visitante} setPenales={v => setF('penales_visitante', parseIntOrEmpty(v))} esKO={esKO}
              goleadores={goleadores.filter(g => g.equipo_codigo === partido.equipo_visitante)}
              goleadoresIdxBase={(jugador) => goleadores.findIndex(g => g.equipo_codigo === partido.equipo_visitante && sameJugador(g.jugador, jugador))}
              setGolesGoleador={setGolesGoleador} removeGoleador={removeGoleador}
              addGoleador={(jugador) => addGoleador(partido.equipo_visitante, jugador)}
              addAutogol={() => addAutogol(partido.equipo_visitante)}
              sumaGoleadores={sumaVisitante} golesEquipoNum={golesVisitanteNum}
            />
          </div>
        )}

        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm" disabled={saving}>Cancelar</button>
          <button type="button" onClick={guardar} className="btn btn-primary btn-sm" disabled={saving || loading || loadFailed}>
            {saving ? 'Guardando...' : (loadFailed ? '⚠ No se puede guardar' : '💾 Guardar partido')}
          </button>
        </div>
      </div>
    </div>
  )
}

function vacio() {
  return {
    goles_local: '', goles_visitante: '',
    penales_local: '', penales_visitante: '',
    amarillas_local: '', amarillas_visitante: '',
    rojas_local: '', rojas_visitante: '',
    estado: 'pendiente', observacion: '',
  }
}
function intOrEmpty(v) {
  return Number.isInteger(v) ? v : (v === 0 ? 0 : '')
}
function sameJugador(a, b) {
  return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase()
}

function LadoPartido({
  torneoId, equipo, equipoCodigo,
  golesEquipo, setGolesEquipo,
  amarillas, setAmarillas, rojas, setRojas,
  penales, setPenales, esKO,
  goleadores, addGoleador, addAutogol, setGolesGoleador, removeGoleador, goleadoresIdxBase,
  sumaGoleadores, golesEquipoNum,
}) {
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
      {goleadores.map((g, listIdx) => (
        <div key={`${equipoCodigo}-${g.jugador}-${listIdx}`} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <span style={{ flex: 1, fontSize: 13, fontStyle: g.jugador === 'Autogol' ? 'italic' : 'normal', color: g.jugador === 'Autogol' ? 'var(--color-muted)' : 'inherit' }}>
            {g.jugador}
          </span>
          <input type="number" min="0" value={g.goles}
            onChange={e => setGolesGoleador(goleadoresIdxBase(g.jugador), e.target.value)}
            style={{ width: 50, padding: '2px 6px', fontSize: 12, borderRadius: 4, border: '1px solid var(--color-border)', textAlign: 'center' }}/>
          <button type="button" onClick={() => removeGoleador(goleadoresIdxBase(g.jugador))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: 16, padding: 0, lineHeight: 1 }} title="Quitar">×</button>
        </div>
      ))}

      <JugadorAutocomplete torneoId={torneoId} equipoCodigo={equipoCodigo} onSelect={addGoleador} />
      <button type="button" onClick={addAutogol} className="btn btn-secondary btn-sm"
        style={{ marginTop: 4, fontSize: 10, padding: '2px 8px' }}
        title="Autogol: suma un gol al equipo sin nombre de goleador.">
        + Autogol
      </button>

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

function JugadorAutocomplete({ torneoId, equipoCodigo, onSelect }) {
  const [texto, setTexto] = useState('')
  const [sugerencias, setSugerencias] = useState([])
  const [foco, setFoco] = useState(false)
  const cacheRef = useRef(null)

  async function loadSugerencias() {
    if (cacheRef.current && cacheRef.current.equipo === equipoCodigo) {
      setSugerencias(cacheRef.current.list)
      return
    }
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
        <input type="text" value={texto}
          onChange={e => setTexto(e.target.value)}
          onFocus={() => { setFoco(true); loadSugerencias() }}
          onBlur={() => setTimeout(() => setFoco(false), 150)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (texto.trim()) add(texto) } }}
          placeholder="Agregar goleador..."
          style={{ flex: 1, padding: '4px 8px', fontSize: 12, borderRadius: 4, border: '1px solid var(--color-border)' }}
        />
        <button type="button" onClick={() => texto.trim() && add(texto)}
          className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '2px 8px' }}
          disabled={!texto.trim()}>+ Agregar</button>
      </div>
      {foco && (filtradas.length > 0 || puedeCrear) && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
          marginTop: 2, background: 'white', border: '1px solid var(--color-border)',
          borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          maxHeight: 200, overflowY: 'auto', fontSize: 12,
        }}>
          {filtradas.map(s => (
            <div key={s.jugador} onMouseDown={() => add(s.jugador)}
              style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.05)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              {s.jugador}
              <span style={{ color: 'var(--color-muted)', marginLeft: 6, fontSize: 10 }}>· {s.apariciones} prev.</span>
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
