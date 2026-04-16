import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../../api/index.js'

// Grilla estilo Excel para cargar los 30 eventos
// Tab/Enter navegan entre celdas en filas de partido

const COLS = ['evento', 'local', 'visitante', 'condicion', 'pts_local', 'pts_empate', 'pts_visitante', 'pts_exacto']

// ---------- helpers ----------

function slugify(str) {
  return str.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 30)
}

function parseCfg(config_json) {
  if (!config_json) return null
  try { return JSON.parse(config_json) } catch { return null }
}

function cfgResumen(config_json) {
  const cfg = parseCfg(config_json)
  if (!cfg) return null
  const subtipoLabel = {
    binaria: 'Binaria', opcion_unica: 'Opción única',
    multi_select: 'Multi-selección', abierta: 'Abierta'
  }
  if (cfg.subtipo === 'abierta') {
    return `Abierta · corrección manual${cfg.pts_max ? ` · máx ${cfg.pts_max}pts` : ''}`
  }
  return `${subtipoLabel[cfg.subtipo] || cfg.subtipo} · ${cfg.opciones?.length || 0} opciones`
}

// ---------- init state ----------

function initEventos(existentes = []) {
  return Array.from({ length: 30 }, (_, i) => {
    const orden = i + 1
    const ex = existentes.find(e => e.orden === orden)
    return ex ? {
      orden,
      tipo: ex.tipo || 'partido',
      evento: ex.evento || ex.torneo_contexto || '',
      local: ex.local || '',
      visitante: ex.visitante || '',
      condicion: ex.condicion || '',
      pts_local: ex.pts_local || 5,
      pts_empate: ex.pts_empate || 5,
      pts_visitante: ex.pts_visitante || 5,
      pts_exacto: ex.pts_exacto || 5,
      pregunta_texto: ex.pregunta_texto || '',
      config_json: ex.config_json || null,
      resultado_json: ex.resultado_json || null,
    } : {
      orden,
      tipo: 'partido',
      evento: '',
      local: '', visitante: '', condicion: '',
      pts_local: 5, pts_empate: 5, pts_visitante: 5, pts_exacto: 5,
      pregunta_texto: '', config_json: null, resultado_json: null,
    }
  })
}

// ---------- página principal ----------

export default function AdminEventos() {
  const { fechaId } = useParams()
  const [fecha, setFecha] = useState(null)
  const [eventos, setEventos] = useState(() => initEventos())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const cellRefs = useRef({})
  const [bulkTexto, setBulkTexto] = useState('')
  const [modalIdx, setModalIdx] = useState(null)   // índice del evento en modo modal

  useEffect(() => { loadFecha() }, [fechaId])

  const loadFecha = async () => {
    try {
      const f = await api.getFecha(fechaId)
      setFecha(f)
      const evs = await api.getEventos(fechaId)
      setEventos(initEventos(evs))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const updateEvento = (idx, campo, valor) => {
    setEventos(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [campo]: valor }
      return next
    })
  }

  const handleKeyNav = (e, rowIdx, colKey) => {
    if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault()
      const colIdx = COLS.indexOf(colKey)
      let nextRow = rowIdx, nextCol = colIdx + 1
      if (nextCol >= COLS.length) { nextCol = 0; nextRow++ }
      if (nextRow >= 30) return
      cellRefs.current[`${nextRow}-${COLS[nextCol]}`]?.focus()
    }
  }

  const rellenarEventoBloque = (inicio, fin) => {
    if (!bulkTexto.trim()) return
    setEventos(prev => prev.map(ev =>
      ev.orden >= inicio && ev.orden <= fin ? { ...ev, evento: bulkTexto.trim() } : ev
    ))
  }

  const aplicarPuntajeBloque = (inicio, fin, pts) => {
    setEventos(prev => prev.map(ev =>
      ev.orden >= inicio && ev.orden <= fin ? { ...ev, ...pts } : ev
    ))
  }

  const condicionesUsadas = useMemo(() =>
    [...new Set(eventos.map(e => e.condicion).filter(Boolean))],
  [eventos])

  const handleGuardar = async () => {
    setSaving(true); setError('')
    try {
      const payload = eventos.map(ev => {
        if (ev.tipo === 'pregunta') {
          return {
            orden: ev.orden, tipo: 'pregunta',
            evento: ev.evento || null,
            pregunta_texto: ev.pregunta_texto || null,
            config_json: ev.config_json || null,
            resultado_json: ev.resultado_json || null,
            local: null, visitante: null, condicion: null,
            pts_local: 0, pts_empate: 0, pts_visitante: 0, pts_exacto: 0,
          }
        }
        return {
          orden: ev.orden, tipo: ev.tipo,
          evento: ev.evento || null,
          local: ev.local || null,
          visitante: ev.visitante || null,
          condicion: ev.condicion || null,
          pts_local: parseInt(ev.pts_local) || 0,
          pts_empate: parseInt(ev.pts_empate) || 0,
          pts_visitante: parseInt(ev.pts_visitante) || 0,
          pts_exacto: parseInt(ev.pts_exacto) || 0,
          pregunta_texto: null, config_json: null, resultado_json: null,
        }
      })
      await api.bulkEventos(fechaId, payload)
      setSuccess('Eventos guardados correctamente')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSavePregunta = (idx, data) => {
    setEventos(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], ...data }
      return next
    })
  }

  if (loading) return <div className="loading">Cargando...</div>

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <Link to={`/admin/fecha/${fechaId}`} className="text-muted" style={{fontSize: 13, textDecoration: 'none'}}>
            ← Volver a la fecha
          </Link>
          <div className="page-title" style={{marginTop: 4}}>Eventos: {fecha?.nombre}</div>
          <p className="text-muted" style={{fontSize: 12}}>
            Bloque 1 (1-15): {fecha?.bloque1_nombre} · Bloque 2 (16-30): {fecha?.bloque2_nombre}
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleGuardar} disabled={saving}>
          {saving ? 'Guardando...' : '💾 Guardar todos'}
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {success && <div className="success-msg">{success}</div>}

      {/* Toolbar: rellenar Evento por bloque */}
      <div className="card mb-12" style={{padding: '12px 16px'}}>
        <div style={{fontSize: 12, fontWeight: 600, marginBottom: 8}}>Rellenar campo "Evento" por bloque</div>
        <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center'}}>
          <input
            type="text"
            value={bulkTexto}
            onChange={e => setBulkTexto(e.target.value)}
            placeholder="Ej: Liga Argentina, Champions..."
            style={{flex: '1 1 200px', minWidth: 160, maxWidth: 300, padding: '5px 8px', fontSize: 13}}
            onKeyDown={e => { if (e.key === 'Enter') rellenarEventoBloque(1, 15) }}
          />
          <button className="btn btn-secondary btn-sm" onClick={() => rellenarEventoBloque(1, 15)} disabled={!bulkTexto.trim()}>Bloque 1 (1-15)</button>
          <button className="btn btn-secondary btn-sm" onClick={() => rellenarEventoBloque(16, 30)} disabled={!bulkTexto.trim()}>Bloque 2 (16-30)</button>
          <button className="btn btn-secondary btn-sm" onClick={() => rellenarEventoBloque(1, 30)} disabled={!bulkTexto.trim()}>Ambos bloques</button>
        </div>
      </div>

      {/* Toolbar: puntaje rápido */}
      <div className="card mb-12" style={{padding: '12px 16px'}}>
        <div style={{fontSize: 12, fontWeight: 600, marginBottom: 8}}>Aplicar puntaje L/E/V/+Ex a un bloque</div>
        <div style={{display: 'flex', gap: 12, flexWrap: 'wrap'}}>
          <button className="btn btn-secondary btn-sm" onClick={() => aplicarPuntajeBloque(1, 15, {pts_local:5,pts_empate:5,pts_visitante:5,pts_exacto:5})}>Bloque 1: 5/5/5 +5</button>
          <button className="btn btn-secondary btn-sm" onClick={() => aplicarPuntajeBloque(16, 30, {pts_local:5,pts_empate:5,pts_visitante:5,pts_exacto:5})}>Bloque 2: 5/5/5 +5</button>
          <button className="btn btn-secondary btn-sm" onClick={() => aplicarPuntajeBloque(1, 30, {pts_local:3,pts_empate:3,pts_visitante:3,pts_exacto:2})}>Todos: 3/3/3 +2</button>
        </div>
      </div>

      <datalist id="condiciones-datalist">
        {condicionesUsadas.map(c => <option key={c} value={c} />)}
      </datalist>

      <EventosGrilla
        titulo={`🟩 Bloque 1: ${fecha?.bloque1_nombre} (eventos 1-15)`}
        eventos={eventos.slice(0, 15)} startIdx={0}
        onUpdate={updateEvento} onKeyNav={handleKeyNav}
        cellRefs={cellRefs} color="#166534"
        onConfigurarPregunta={idx => setModalIdx(idx)}
      />
      <EventosGrilla
        titulo={`🟦 Bloque 2: ${fecha?.bloque2_nombre} (eventos 16-30)`}
        eventos={eventos.slice(15, 30)} startIdx={15}
        onUpdate={updateEvento} onKeyNav={handleKeyNav}
        cellRefs={cellRefs} color="#1e3a5f"
        onConfigurarPregunta={idx => setModalIdx(idx)}
      />

      <div style={{textAlign: 'right', marginTop: 16}}>
        <button className="btn btn-primary btn-lg" onClick={handleGuardar} disabled={saving}>
          {saving ? 'Guardando...' : '💾 Guardar todos los eventos'}
        </button>
      </div>

      {/* Modal de configuración de pregunta */}
      {modalIdx !== null && (
        <PreguntaModal
          evento={eventos[modalIdx]}
          onSave={data => handleSavePregunta(modalIdx, data)}
          onClose={() => setModalIdx(null)}
        />
      )}
    </div>
  )
}

// ---------- grilla de eventos ----------

function EventosGrilla({ titulo, eventos, startIdx, onUpdate, onKeyNav, cellRefs, color, onConfigurarPregunta }) {
  return (
    <div className="card" style={{marginBottom: 16, borderLeft: `3px solid ${color}`}}>
      <div className="card-header">{titulo}</div>
      <div style={{overflowX: 'auto'}}>
        <table className="excel-table">
          <thead>
            <tr>
              <th style={{width: 30}}>#</th>
              <th style={{width: 70}}>Tipo</th>
              <th style={{minWidth: 110}}>Evento</th>
              <th style={{minWidth: 130}}>Local / Pregunta</th>
              <th style={{minWidth: 130}}>Visitante</th>
              <th style={{minWidth: 100}}>Condición</th>
              <th style={{width: 58}} title="Pts Local">L</th>
              <th style={{width: 58}} title="Pts Empate">E</th>
              <th style={{width: 58}} title="Pts Visitante">V</th>
              <th style={{width: 58}} title="Pts Exacto">+Ex</th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((ev, i) => {
              const idx = startIdx + i
              if (ev.tipo === 'pregunta') {
                return (
                  <tr key={ev.orden} style={{background: 'rgba(139,92,246,0.07)'}}>
                    <td style={{textAlign:'center', color:'var(--color-muted)', fontSize:12}}>{ev.orden}</td>
                    <td>
                      <select value={ev.tipo} onChange={e => onUpdate(idx, 'tipo', e.target.value)} style={{padding:'3px 4px',fontSize:12,width:'100%'}}>
                        <option value="partido">Partido</option>
                        <option value="pregunta">Pregunta</option>
                      </select>
                    </td>
                    {/* Evento (categoría) */}
                    <td>
                      <input
                        ref={el => cellRefs.current[`${idx}-evento`] = el}
                        value={ev.evento}
                        onChange={e => onUpdate(idx, 'evento', e.target.value)}
                        onKeyDown={e => onKeyNav(e, idx, 'evento')}
                        placeholder="Categoría"
                      />
                    </td>
                    {/* Celda unificada: resumen + botón configurar */}
                    <td colSpan={7} style={{padding: '5px 10px'}}>
                      <div style={{display:'flex', alignItems:'center', gap:10}}>
                        <div style={{flex:1}}>
                          {ev.pregunta_texto
                            ? <span style={{fontSize:13}}>❓ {ev.pregunta_texto.length > 55 ? ev.pregunta_texto.slice(0,55)+'…' : ev.pregunta_texto}</span>
                            : <span style={{fontSize:12, color:'var(--color-muted)'}}>— sin configurar —</span>
                          }
                          {ev.config_json && (
                            <span style={{fontSize:11, color:'var(--color-muted)', marginLeft:10}}>
                              {cfgResumen(ev.config_json)}
                            </span>
                          )}
                        </div>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onConfigurarPregunta(idx)}
                          style={{whiteSpace:'nowrap'}}
                        >
                          ⚙ Configurar
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              }

              // Fila partido (igual que antes)
              return (
                <tr key={ev.orden}>
                  <td style={{textAlign:'center', color:'var(--color-muted)', fontSize:12}}>{ev.orden}</td>
                  <td>
                    <select value={ev.tipo} onChange={e => onUpdate(idx, 'tipo', e.target.value)} style={{padding:'3px 4px',fontSize:12,width:'100%'}}>
                      <option value="partido">Partido</option>
                      <option value="pregunta">Pregunta</option>
                    </select>
                  </td>
                  <td>
                    <input ref={el => cellRefs.current[`${idx}-evento`] = el}
                      value={ev.evento} onChange={e => onUpdate(idx,'evento',e.target.value)}
                      onKeyDown={e => onKeyNav(e,idx,'evento')} placeholder="Liga / torneo" />
                  </td>
                  <td>
                    <input ref={el => cellRefs.current[`${idx}-local`] = el}
                      value={ev.local} onChange={e => onUpdate(idx,'local',e.target.value)}
                      onKeyDown={e => onKeyNav(e,idx,'local')} placeholder="Local" />
                  </td>
                  <td>
                    <input ref={el => cellRefs.current[`${idx}-visitante`] = el}
                      value={ev.visitante} onChange={e => onUpdate(idx,'visitante',e.target.value)}
                      onKeyDown={e => onKeyNav(e,idx,'visitante')} placeholder="Visitante" />
                  </td>
                  <td>
                    <input ref={el => cellRefs.current[`${idx}-condicion`] = el}
                      list="condiciones-datalist" value={ev.condicion}
                      onChange={e => onUpdate(idx,'condicion',e.target.value)}
                      onKeyDown={e => onKeyNav(e,idx,'condicion')}
                      placeholder="Opcional" autoComplete="off" />
                  </td>
                  {['pts_local','pts_empate','pts_visitante','pts_exacto'].map(campo => (
                    <td key={campo}>
                      <input ref={el => cellRefs.current[`${idx}-${campo}`] = el}
                        className="pts-input" type="text" inputMode="numeric"
                        value={ev[campo]}
                        onChange={e => onUpdate(idx, campo, e.target.value)}
                        onKeyDown={e => onKeyNav(e, idx, campo)} />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------- modal de configuración de pregunta ----------

const SUBTIPOS = [
  { id: 'opcion_unica',  label: 'Opción única',                  desc: 'Una respuesta correcta, pts planos' },
  { id: 'binaria',       label: 'Binaria (pts por opción)',       desc: 'Dos opciones, pts distintos por cada una' },
  { id: 'multi_select',  label: 'Multi-selección / Acumulativa', desc: 'Varias correctas, pts por acierto' },
  { id: 'abierta',       label: 'Abierta (corrección manual)',    desc: 'El jugador escribe texto libre. El admin asigna puntos manualmente.' },
]

function buildDefaultConfig(subtipo) {
  if (subtipo === 'binaria') return {
    subtipo: 'binaria',
    opciones: [
      { id: 'si', label: 'Sí', pts: 10 },
      { id: 'no', label: 'No', pts: 5 },
    ]
  }
  if (subtipo === 'multi_select') return {
    subtipo: 'multi_select',
    opciones: [{ id: 'op1', label: '' }],
    pts_por_acierto: 3
  }
  if (subtipo === 'abierta') return {
    subtipo: 'abierta',
    pts_max: 10,
    criterio: ''
  }
  return {
    subtipo: 'opcion_unica',
    opciones: [{ id: 'op1', label: '' }, { id: 'op2', label: '' }],
    pts: 5
  }
}

function PreguntaModal({ evento, onSave, onClose }) {
  const initial = parseCfg(evento.config_json) || buildDefaultConfig('opcion_unica')
  const [texto, setTexto] = useState(evento.pregunta_texto || '')
  const [subtipo, setSubtipo] = useState(initial.subtipo || 'opcion_unica')
  const [opciones, setOpciones] = useState(initial.opciones || [{ id: 'op1', label: '' }])
  const [pts, setPts] = useState(initial.pts ?? 5)
  const [ptsPorAcierto, setPtsPorAcierto] = useState(initial.pts_por_acierto ?? 3)
  // Campos exclusivos de abierta
  const [ptsMax, setPtsMax] = useState(initial.pts_max ?? 10)
  const [criterio, setCriterio] = useState(initial.criterio || '')

  // Cuando cambia subtipo, cargar defaults si las opciones son del tipo anterior
  const handleSubtipoChange = (nuevoSub) => {
    setSubtipo(nuevoSub)
    const def = buildDefaultConfig(nuevoSub)
    if (nuevoSub === 'abierta') {
      // No hay opciones en abierta, no modificar el estado de opciones
      return
    }
    // Migrar opciones: mantener labels existentes, ajustar estructura
    if (nuevoSub === 'binaria' && opciones.length !== 2) {
      setOpciones(def.opciones)
    } else if (nuevoSub !== 'binaria') {
      setOpciones(opciones.map(({id, label}) => ({id, label})))
    }
    if (nuevoSub === 'binaria') setPts(def.pts ?? 5)
    if (nuevoSub === 'multi_select') setPtsPorAcierto(def.pts_por_acierto ?? 3)
  }

  const updateOpcion = (i, campo, val) => {
    setOpciones(prev => prev.map((op, j) => j !== i ? op : { ...op, [campo]: val }))
  }

  const autoId = (label, i) => {
    const slug = slugify(label)
    return slug || `op${i + 1}`
  }

  const handleLabelChange = (i, val) => {
    setOpciones(prev => prev.map((op, j) => {
      if (j !== i) return op
      // Solo auto-generar id si todavía tiene el id default (no fue editado manualmente)
      const idEsDefault = op.id === `op${j+1}` || op.id === slugify(op.label) || op.id === ''
      return { ...op, label: val, id: idEsDefault ? autoId(val, j) : op.id }
    }))
  }

  const addOpcion = () => {
    const idx = opciones.length
    setOpciones(prev => [...prev, { id: `op${idx+1}`, label: '', pts: 0 }])
  }

  const removeOpcion = (i) => {
    if (opciones.length <= 2) return // mínimo 2
    setOpciones(prev => prev.filter((_, j) => j !== i))
  }

  const buildConfig = () => {
    if (subtipo === 'abierta') {
      const cfg = { subtipo: 'abierta' }
      const max = parseInt(ptsMax)
      if (!isNaN(max) && max > 0) cfg.pts_max = max
      if (criterio.trim()) cfg.criterio = criterio.trim()
      return cfg
    }
    const cfg = { subtipo, opciones: opciones.map(o => ({ ...o, id: o.id || slugify(o.label) || `op_${Math.random().toString(36).slice(2,6)}` })) }
    if (subtipo === 'opcion_unica') cfg.pts = Number(pts)
    if (subtipo === 'multi_select') cfg.pts_por_acierto = Number(ptsPorAcierto)
    return cfg
  }

  const handleSave = () => {
    if (!texto.trim()) { alert('El enunciado de la pregunta no puede estar vacío'); return }
    // abierta: no requiere opciones
    if (subtipo !== 'abierta' && opciones.some(o => !o.label.trim())) {
      alert('Todas las opciones deben tener un label'); return
    }
    onSave({ pregunta_texto: texto.trim(), config_json: JSON.stringify(buildConfig()) })
    onClose()
  }

  const overlay = { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }
  const modal  = { background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius)', width:'100%', maxWidth:580, maxHeight:'90vh', overflowY:'auto', padding:24 }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
          <div style={{fontWeight:700, fontSize:16}}>⚙ Configurar pregunta #{evento.orden}</div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕ Cerrar</button>
        </div>

        {/* Enunciado */}
        <div className="form-group">
          <label>Enunciado</label>
          <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="¿Quién ganará el torneo?" />
        </div>

        {/* Subtipo */}
        <div className="form-group">
          <label>Tipo de pregunta</label>
          <div style={{display:'flex', flexDirection:'column', gap:6}}>
            {SUBTIPOS.map(s => (
              <label key={s.id} style={{display:'flex', alignItems:'flex-start', gap:8, cursor:'pointer', padding:'8px 10px', border:`1px solid ${subtipo===s.id ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius:'var(--radius)', background: subtipo===s.id ? 'rgba(99,102,241,0.08)' : 'transparent'}}>
                <input type="radio" name="subtipo" value={s.id} checked={subtipo===s.id} onChange={() => handleSubtipoChange(s.id)} style={{marginTop:2, width:'auto'}} />
                <div>
                  <div style={{fontWeight:600, fontSize:13}}>{s.label}</div>
                  <div style={{fontSize:11, color:'var(--color-muted)'}}>{s.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Pts globales (opcion_unica) */}
        {subtipo === 'opcion_unica' && (
          <div className="form-group">
            <label>Puntos por acierto</label>
            <input type="text" inputMode="numeric" value={pts} onChange={e => setPts(e.target.value)} style={{width:80}} />
          </div>
        )}
        {/* Pts por acierto (multi_select) */}
        {subtipo === 'multi_select' && (
          <div className="form-group">
            <label>Puntos por cada acierto</label>
            <input type="text" inputMode="numeric" value={ptsPorAcierto} onChange={e => setPtsPorAcierto(e.target.value)} style={{width:80}} />
          </div>
        )}

        {/* Campos exclusivos de abierta */}
        {subtipo === 'abierta' && (
          <>
            <div className="form-group">
              <label>Puntaje máximo sugerido <span style={{fontWeight:400, color:'var(--color-muted)'}}>(opcional)</span></label>
              <input
                type="text" inputMode="numeric" value={ptsMax}
                onChange={e => setPtsMax(e.target.value)}
                placeholder="Ej: 20"
                style={{width:80}}
              />
              <div style={{fontSize:11, color:'var(--color-muted)', marginTop:4}}>
                Solo referencia para el admin al corregir. No limita el puntaje ingresable.
              </div>
            </div>
            <div className="form-group">
              <label>Criterio de corrección <span style={{fontWeight:400, color:'var(--color-muted)'}}>(opcional)</span></label>
              <textarea
                value={criterio}
                onChange={e => setCriterio(e.target.value)}
                placeholder="Ej: 3 pts por posición exacta en el podio, 1 pt por aparecer"
                rows={3}
                style={{width:'100%', resize:'vertical', fontFamily:'inherit', fontSize:13,
                        background:'var(--color-surface2)', border:'1px solid var(--color-border)',
                        borderRadius:'var(--radius)', color:'var(--color-text)', padding:'8px 10px'}}
              />
            </div>
            <div style={{background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)',
                         borderRadius:'var(--radius)', padding:'10px 14px', marginBottom:16, fontSize:12}}>
              📝 El jugador escribirá una respuesta libre. Los puntos se asignan manualmente
              en la pantalla de resultados, fila por fila para cada jugador.
            </div>
          </>
        )}

        {/* Opciones (no aplica para abierta) */}
        {subtipo !== 'abierta' && (
          <div className="form-group">
            <label>Opciones {subtipo === 'binaria' && '(exactamente 2)'}</label>
            <div style={{display:'flex', flexDirection:'column', gap:6}}>
              {opciones.map((op, i) => (
                <div key={i} style={{display:'flex', gap:6, alignItems:'center'}}>
                  <input
                    value={op.label}
                    onChange={e => handleLabelChange(i, e.target.value)}
                    placeholder={`Opción ${i+1}`}
                    style={{flex:2}}
                  />
                  <input
                    value={op.id}
                    onChange={e => updateOpcion(i, 'id', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,''))}
                    placeholder="id"
                    style={{flex:1, fontSize:12, color:'var(--color-muted)'}}
                    title="ID interno (auto-generado, editable)"
                  />
                  {subtipo === 'binaria' && (
                    <input
                      type="text" inputMode="numeric"
                      value={op.pts ?? 0}
                      onChange={e => updateOpcion(i, 'pts', Number(e.target.value))}
                      placeholder="Pts"
                      style={{width:55}}
                      title="Puntos si elige esta opción"
                    />
                  )}
                  {subtipo !== 'binaria' && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => removeOpcion(i)}
                      disabled={opciones.length <= 2}
                      style={{padding:'3px 8px'}}
                      title="Eliminar opción"
                    >✕</button>
                  )}
                </div>
              ))}
            </div>
            {subtipo !== 'binaria' && (
              <button className="btn btn-secondary btn-sm" onClick={addOpcion} style={{marginTop:8}}>
                + Agregar opción
              </button>
            )}
          </div>
        )}

        {/* Preview */}
        <div style={{background:'var(--color-surface2)', borderRadius:'var(--radius)', padding:12, marginBottom:16, fontSize:12, color:'var(--color-muted)'}}>
          <strong>Preview config_json:</strong>
          <pre style={{margin:'6px 0 0', fontSize:11, overflowX:'auto'}}>
            {JSON.stringify(buildConfig(), null, 2)}
          </pre>
        </div>

        <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>✅ Guardar configuración</button>
        </div>
      </div>
    </div>
  )
}
