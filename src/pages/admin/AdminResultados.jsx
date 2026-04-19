import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../../api/index.js'

function calcularLEV(gl, gv) {
  if (gl === '' || gv === '' || gl === null || gv === null) return '—'
  const l = parseInt(gl), v = parseInt(gv)
  if (isNaN(l) || isNaN(v)) return '—'
  if (l > v) return 'L'
  if (l === v) return 'E'
  return 'V'
}

function levColor(lev) {
  if (lev === 'L') return 'var(--color-success)'
  if (lev === 'E') return 'var(--color-muted)'
  if (lev === 'V') return 'var(--color-danger)'
  return 'var(--color-muted)'
}

function parseCfg(config_json) {
  if (!config_json) return null
  try { return JSON.parse(config_json) } catch { return null }
}

export default function AdminResultados() {
  const { fechaId } = useParams()
  const [fecha, setFecha] = useState(null)
  const [resultados, setResultados] = useState({})     // ev.id → {tipo, ...campos}
  const [eventos, setEventos] = useState([])
  const [pronosAdmin, setPronosAdmin] = useState([])   // todos los pronósticos (para preguntas abiertas)
  const [puntosAbierta, setPuntosAbierta] = useState({}) // pron.id → pts (edición local)
  const [savingAbierta, setSavingAbierta] = useState({})  // pron.id → bool
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [levSeccionAbierta, setLevSeccionAbierta] = useState(false)
  const [pronosTodos, setPronosTodos] = useState([])       // todos los pronósticos para corrección LEV
  const [levCargando, setLevCargando] = useState(false)
  const [levSaving, setLevSaving] = useState({})           // pronoId → bool
  const cellRefs = useRef({})

  useEffect(() => {
    loadData()
  }, [fechaId])

  const loadData = async () => {
    try {
      const [f, evs] = await Promise.all([
        api.getFecha(fechaId),
        api.getEventos(fechaId)
      ])
      setFecha(f)
      setEventos(evs)

      // Pre-cargar resultados existentes
      const resMap = {}
      for (const ev of evs) {
        if (ev.tipo === 'partido') {
          resMap[ev.id] = {
            tipo: 'partido',
            resultado_local: ev.resultado_local ?? '',
            resultado_visitante: ev.resultado_visitante ?? ''
          }
        } else {
          const cfg = parseCfg(ev.config_json)
          const subtipo = cfg?.subtipo
          let correcta = null, correctas = []
          if (ev.resultado_json) {
            try {
              const parsed = JSON.parse(ev.resultado_json)
              if (subtipo === 'multi_select') correctas = parsed.correctas || []
              else correcta = parsed.correcta || null
            } catch {}
          }
          resMap[ev.id] = { tipo: 'pregunta', subtipo, cfg, correcta, correctas }
        }
      }
      setResultados(resMap)

      // Cargar todos los pronósticos de la fecha (para preguntas abiertas)
      const hayAbiertas = evs.some(ev => {
        const cfg = parseCfg(ev.config_json)
        return ev.tipo === 'pregunta' && cfg?.subtipo === 'abierta'
      })
      if (hayAbiertas) {
        const todos = await api.getPronosticosAdmin(fechaId)
        setPronosAdmin(todos)
        // Inicializar edición local de puntos desde puntos_obtenidos existentes
        const ptMap = {}
        for (const p of todos) {
          ptMap[p.id] = p.puntos_obtenidos ?? 0
        }
        setPuntosAbierta(ptMap)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const updateRes = (eventoId, campo, valor) => {
    setResultados(prev => ({
      ...prev,
      [eventoId]: { ...(prev[eventoId] || {}), [campo]: valor }
    }))
  }

  const toggleCorrectaMulti = (eventoId, opId) => {
    setResultados(prev => {
      const current = prev[eventoId] || {}
      const correctas = current.correctas || []
      return {
        ...prev,
        [eventoId]: {
          ...current,
          correctas: correctas.includes(opId)
            ? correctas.filter(id => id !== opId)
            : [...correctas, opId]
        }
      }
    })
  }

  const handleKeyNav = (e, idx, col) => {
    if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault()
      const COLS = ['rl', 'rv']
      const colIdx = COLS.indexOf(col)
      let nextRow = idx, nextCol = colIdx + 1
      if (nextCol >= COLS.length) { nextCol = 0; nextRow++ }
      if (nextRow >= eventos.length) return
      cellRefs.current[`${nextRow}-${COLS[nextCol]}`]?.focus()
    }
  }

  // Guardar puntos manuales de un pronóstico de abierta (inline, uno por vez)
  const handleGuardarPuntoAbierta = async (pronoId) => {
    const pts = parseInt(puntosAbierta[pronoId] ?? 0)
    if (isNaN(pts)) return
    setSavingAbierta(prev => ({ ...prev, [pronoId]: true }))
    try {
      await api.setPuntosManual(pronoId, pts)
      // Actualizar el pronóstico en la lista local
      setPronosAdmin(prev => prev.map(p =>
        p.id === pronoId ? { ...p, puntos_obtenidos: pts } : p
      ))
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingAbierta(prev => ({ ...prev, [pronoId]: false }))
    }
  }

  // Guardar todos los puntos de una pregunta abierta de una vez
  const handleGuardarTodosAbierta = async (eventoId) => {
    const pronosEvento = pronosAdmin.filter(p => p.evento_id === eventoId)
    setSaving(true); setError('')
    try {
      for (const p of pronosEvento) {
        const pts = parseInt(puntosAbierta[p.id] ?? 0)
        if (!isNaN(pts)) {
          await api.setPuntosManual(p.id, pts)
        }
      }
      setPronosAdmin(prev => prev.map(p => {
        if (p.evento_id !== eventoId) return p
        const pts = parseInt(puntosAbierta[p.id] ?? 0)
        return isNaN(pts) ? p : { ...p, puntos_obtenidos: pts }
      }))
      setSuccess('Puntos guardados correctamente')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleLevSeccion = async () => {
    if (!levSeccionAbierta && pronosTodos.length === 0) {
      setLevCargando(true)
      try {
        const todos = await api.getPronosticosAdmin(fechaId)
        setPronosTodos(todos.filter(p => p.tipo === 'partido'))
      } catch (err) {
        setError(err.message)
      } finally {
        setLevCargando(false)
      }
    }
    setLevSeccionAbierta(o => !o)
  }

  const handleSetLev = async (pronoId, lev) => {
    setLevSaving(prev => ({ ...prev, [pronoId]: true }))
    try {
      const updated = await api.setLevManual(pronoId, lev)
      setPronosTodos(prev => prev.map(p =>
        p.id === pronoId ? { ...p, lev_pronostico: updated.lev_pronostico, puntos_obtenidos: updated.puntos_obtenidos } : p
      ))
      setSuccess(`LEV corregido → recalculado`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLevSaving(prev => ({ ...prev, [pronoId]: false }))
    }
  }

  const handleGuardar = async () => {
    setSaving(true); setError('')
    try {
      // 1. Guardar partidos en bulk
      const payloadPartidos = eventos
        .filter(ev => ev.tipo === 'partido')
        .filter(ev => {
          const r = resultados[ev.id]
          return r && r.resultado_local !== '' && r.resultado_visitante !== ''
        })
        .map(ev => ({
          evento_id: ev.id,
          resultado_local: parseInt(resultados[ev.id].resultado_local),
          resultado_visitante: parseInt(resultados[ev.id].resultado_visitante)
        }))

      if (payloadPartidos.length > 0) {
        await api.bulkResultados(fechaId, payloadPartidos)
      }

      // 2. Guardar preguntas no-abiertas individualmente (PATCH con resultado_json)
      for (const ev of eventos.filter(e => e.tipo === 'pregunta')) {
        const r = resultados[ev.id]
        if (!r || r.subtipo === 'abierta') continue  // abiertas: no tienen resultado_json automático

        let resultado_json = null
        if (r.subtipo === 'multi_select') {
          if (r.correctas && r.correctas.length > 0)
            resultado_json = JSON.stringify({ correctas: r.correctas })
        } else {
          if (r.correcta)
            resultado_json = JSON.stringify({ correcta: r.correcta })
        }

        if (resultado_json !== null) {
          await api.updateEvento(ev.id, { resultado_json })
        }
      }

      setSuccess('Resultados guardados y puntos recalculados correctamente')
      loadData()
      setTimeout(() => setSuccess(''), 4000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading">Cargando...</div>

  const bloque1 = eventos.filter(ev => ev.orden <= 15)
  const bloque2 = eventos.filter(ev => ev.orden >= 16)

  const renderRow = (ev, globalIdx) => {
    const r = resultados[ev.id] || {}

    if (ev.tipo === 'partido') {
      const lev = calcularLEV(r.resultado_local, r.resultado_visitante)
      return (
        <tr key={ev.id}>
          <td style={{color: 'var(--color-muted)', fontSize: 12, textAlign: 'center'}}>{ev.orden}</td>
          <td>
            <span><strong>{ev.local}</strong> vs <strong>{ev.visitante}</strong></span>
          </td>
          <td style={{fontSize: 11, color: 'var(--color-muted)'}}>{ev.torneo_contexto}</td>
          <td>
            <input
              ref={el => cellRefs.current[`${globalIdx}-rl`] = el}
              type="number" min="0" max="20"
              value={r.resultado_local ?? ''}
              onChange={e => updateRes(ev.id, 'resultado_local', e.target.value)}
              onKeyDown={e => handleKeyNav(e, globalIdx, 'rl')}
              style={{textAlign: 'center', fontWeight: 700, padding: '4px'}}
              placeholder="—"
            />
          </td>
          <td style={{textAlign: 'center', color: 'var(--color-muted)'}}>-</td>
          <td>
            <input
              ref={el => cellRefs.current[`${globalIdx}-rv`] = el}
              type="number" min="0" max="20"
              value={r.resultado_visitante ?? ''}
              onChange={e => updateRes(ev.id, 'resultado_visitante', e.target.value)}
              onKeyDown={e => handleKeyNav(e, globalIdx, 'rv')}
              style={{textAlign: 'center', fontWeight: 700, padding: '4px'}}
              placeholder="—"
            />
          </td>
          <td style={{textAlign: 'center', fontWeight: 700, color: levColor(lev)}}>{lev}</td>
          <td style={{fontSize: 11, color: 'var(--color-muted)'}}>
            {ev.pts_local}/{ev.pts_empate}/{ev.pts_visitante} +{ev.pts_exacto}
          </td>
        </tr>
      )
    }

    // Pregunta
    const cfg = r.cfg || parseCfg(ev.config_json)
    const subtipo = r.subtipo || cfg?.subtipo
    const opciones = cfg?.opciones || []

    // ── Pregunta abierta: tabla inline de respuestas + corrección manual ──
    if (subtipo === 'abierta') {
      const pronosEvento = pronosAdmin.filter(p => p.evento_id === ev.id)
      return (
        <tr key={ev.id}>
          <td colSpan={8} style={{padding: 0}}>
            {/* Cabecera del evento */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px',
              background: 'rgba(139,92,246,0.08)',
              borderBottom: '1px solid var(--color-border)'
            }}>
              <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                <span style={{color: 'var(--color-muted)', fontSize: 12, minWidth: 22, textAlign: 'center'}}>{ev.orden}</span>
                <div>
                  <span style={{fontSize: 13}}>✏️ <em>{ev.pregunta_texto}</em></span>
                  {cfg?.criterio && (
                    <div style={{fontSize: 11, color: 'var(--color-muted)', marginTop: 2}}>
                      📋 {cfg.criterio}
                    </div>
                  )}
                </div>
                {cfg?.pts_max && (
                  <span style={{fontSize: 11, color: 'var(--color-muted)', marginLeft: 6, whiteSpace: 'nowrap'}}>
                    (máx {cfg.pts_max} pts)
                  </span>
                )}
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleGuardarTodosAbierta(ev.id)}
                disabled={saving}
                style={{whiteSpace: 'nowrap'}}
              >
                💾 Guardar correcciones
              </button>
            </div>

            {/* Sub-tabla de respuestas */}
            {pronosEvento.length === 0 ? (
              <div style={{padding: '8px 48px', fontSize: 12, color: 'var(--color-muted)'}}>
                Ningún jugador respondió esta pregunta aún.
              </div>
            ) : (
              <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12}}>
                <thead>
                  <tr style={{background: 'var(--color-surface2)'}}>
                    <th style={{padding: '5px 12px 5px 48px', textAlign: 'left', fontWeight: 600, color: 'var(--color-muted)', fontSize: 11}}>Jugador</th>
                    <th style={{padding: '5px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--color-muted)', fontSize: 11}}>Respuesta</th>
                    <th style={{padding: '5px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--color-muted)', fontSize: 11, width: 130}}>Puntos</th>
                  </tr>
                </thead>
                <tbody>
                  {pronosEvento.map(pron => {
                    const pts = puntosAbierta[pron.id] ?? pron.puntos_obtenidos ?? 0
                    const yaGuardado = pron.puntos_obtenidos > 0
                    return (
                      <tr key={pron.id} style={{borderTop: '1px solid var(--color-border)'}}>
                        <td style={{padding: '6px 12px 6px 48px', fontWeight: 500}}>
                          {pron.usuario_nombre}
                        </td>
                        <td style={{padding: '6px 12px', color: pron.opcion_elegida ? 'var(--color-text)' : 'var(--color-muted)'}}>
                          {pron.opcion_elegida
                            ? <em>"{pron.opcion_elegida}"</em>
                            : <span style={{fontSize: 11}}>sin respuesta</span>
                          }
                        </td>
                        <td style={{padding: '6px 12px', textAlign: 'center'}}>
                          <div style={{display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center'}}>
                            <input
                              type="text" inputMode="numeric"
                              value={puntosAbierta[pron.id] ?? pron.puntos_obtenidos ?? 0}
                              onChange={e => setPuntosAbierta(prev => ({ ...prev, [pron.id]: e.target.value }))}
                              style={{
                                width: 60, textAlign: 'center', fontWeight: 700,
                                padding: '3px 4px', borderRadius: 4,
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-surface2)',
                                color: 'var(--color-text)'
                              }}
                            />
                            {yaGuardado && (
                              <span style={{fontSize: 10, color: 'var(--color-success)'}}>✓</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )
    }

    // ── Pregunta con opciones (binaria, opcion_unica, multi_select) ──
    return (
      <tr key={ev.id} style={{background: 'rgba(139,92,246,0.06)'}}>
        <td style={{color: 'var(--color-muted)', fontSize: 12, textAlign: 'center'}}>{ev.orden}</td>
        <td colSpan={2}>
          <span style={{fontSize: 12}}>❓ <em>{ev.pregunta_texto || '(sin texto)'}</em></span>
        </td>
        <td colSpan={5} style={{padding: '6px 10px'}}>
          {!subtipo && (
            <span style={{fontSize: 11, color: 'var(--color-muted)'}}>Sin configurar</span>
          )}
          {(subtipo === 'binaria' || subtipo === 'opcion_unica') && (
            <div style={{display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap'}}>
              <span style={{fontSize: 11, color: 'var(--color-muted)'}}>Opción correcta:</span>
              <select
                value={r.correcta || ''}
                onChange={e => updateRes(ev.id, 'correcta', e.target.value)}
                style={{fontSize: 12, padding: '2px 6px', borderRadius: 4}}
              >
                <option value="">— sin resultado —</option>
                {opciones.map(op => (
                  <option key={op.id} value={op.id}>
                    {op.label}
                    {subtipo === 'binaria' ? ` (${op.pts} pts)` : ''}
                  </option>
                ))}
              </select>
              {subtipo === 'opcion_unica' && cfg?.pts !== undefined && (
                <span style={{fontSize: 11, color: 'var(--color-muted)'}}>→ {cfg.pts} pts al acertar</span>
              )}
            </div>
          )}
          {subtipo === 'multi_select' && (
            <div style={{display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap'}}>
              <span style={{fontSize: 11, color: 'var(--color-muted)'}}>Correctas:</span>
              {opciones.map(op => (
                <label key={op.id} style={{display: 'flex', gap: 4, alignItems: 'center', fontSize: 12, cursor: 'pointer'}}>
                  <input
                    type="checkbox"
                    checked={(r.correctas || []).includes(op.id)}
                    onChange={() => toggleCorrectaMulti(ev.id, op.id)}
                    style={{width: 'auto'}}
                  />
                  {op.label}
                </label>
              ))}
              {cfg?.pts_por_acierto != null && (
                <span style={{fontSize: 11, color: 'var(--color-muted)'}}>({cfg.pts_por_acierto} pts/acierto)</span>
              )}
            </div>
          )}
        </td>
      </tr>
    )
  }

  const renderBloque = (evs, titulo, bIdx) => (
    <div className="card" style={{marginBottom: 16}}>
      <div className="card-header">{titulo}</div>
      <table className="excel-table">
        <thead>
          <tr>
            <th style={{width: 30}}>#</th>
            <th>Partido / Pregunta</th>
            <th>Contexto</th>
            <th style={{width: 60}}>Local</th>
            <th style={{width: 16, padding: 0}}></th>
            <th style={{width: 60}}>Visit.</th>
            <th style={{width: 40}}>LEV</th>
            <th style={{width: 100}}>Puntajes</th>
          </tr>
        </thead>
        <tbody>
          {evs.map((ev, i) => {
            const globalIdx = bIdx === 1 ? i : bloque1.length + i
            return renderRow(ev, globalIdx)
          })}
        </tbody>
      </table>
    </div>
  )

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <Link to={`/admin/fecha/${fechaId}`} className="text-muted" style={{fontSize: 13, textDecoration: 'none'}}>
            ← Volver a la fecha
          </Link>
          <div className="page-title" style={{marginTop: 4}}>
            Resultados: {fecha?.nombre}
          </div>
          <p className="text-muted" style={{fontSize: 12}}>
            Partidos y preguntas con opciones: guardar y recalcular.<br />
            Preguntas abiertas: asignar puntos manualmente fila por fila.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleGuardar} disabled={saving}>
          {saving ? 'Calculando...' : '⚽ Guardar y recalcular'}
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {success && <div className="success-msg">{success}</div>}

      {renderBloque(bloque1, `🟩 ${fecha?.bloque1_nombre} (1-15)`, 1)}
      {renderBloque(bloque2, `🟦 ${fecha?.bloque2_nombre} (16-30)`, 2)}

      <div style={{textAlign: 'right', marginTop: 8}}>
        <button className="btn btn-primary btn-lg" onClick={handleGuardar} disabled={saving}>
          {saving ? 'Calculando...' : '⚽ Guardar y recalcular puntos'}
        </button>
      </div>

      {/* Corrección manual de LEV */}
      <div className="card" style={{marginTop: 20}}>
        <div
          className="card-header"
          style={{cursor: 'pointer', userSelect: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}
          onClick={handleToggleLevSeccion}
        >
          <span>🔧 Corrección de LEV (condición de partido)</span>
          <span style={{fontSize: 12, color: 'var(--color-muted)'}}>{levSeccionAbierta ? '▲ cerrar' : '▼ abrir'}</span>
        </div>
        {levSeccionAbierta && (
          <div style={{padding: '8px 0'}}>
            <p style={{fontSize: 12, color: 'var(--color-muted)', padding: '0 14px 8px'}}>
              Usá esto cuando un jugador eligió L/E/V manualmente pero se perdió al volver a guardar. El cambio recalcula los puntos automáticamente.
            </p>
            {levCargando ? (
              <div style={{padding: 16, textAlign: 'center', color: 'var(--color-muted)', fontSize: 12}}>Cargando...</div>
            ) : (
              <table className="excel-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Partido</th>
                    <th>Jugador</th>
                    <th style={{textAlign:'center'}}>Score</th>
                    <th style={{textAlign:'center'}}>LEV actual</th>
                    <th style={{textAlign:'center'}}>Pts</th>
                    <th style={{textAlign:'center'}}>Corregir</th>
                  </tr>
                </thead>
                <tbody>
                  {pronosTodos.map(p => {
                    const lev = p.lev_pronostico
                    const score = p.goles_local != null ? `${p.goles_local}–${p.goles_visitante}` : '—'
                    return (
                      <tr key={p.id}>
                        <td style={{color:'var(--color-muted)', fontSize:11}}>{p.orden}</td>
                        <td style={{fontSize:12}}>{p.local} vs {p.visitante}</td>
                        <td style={{fontWeight: 600}}>{p.usuario_nombre}</td>
                        <td style={{textAlign:'center', fontSize:12}}>{score}</td>
                        <td style={{textAlign:'center', fontWeight:700, color: levColor(lev)}}>
                          {lev || '—'}
                          {p.lev_manual ? <span style={{fontSize:9, color:'var(--color-muted)', marginLeft:3}}>M</span> : ''}
                        </td>
                        <td style={{textAlign:'center'}}>{p.puntos_obtenidos ?? 0}</td>
                        <td style={{textAlign:'center'}}>
                          <div style={{display:'flex', gap:4, justifyContent:'center'}}>
                            {['L','E','V'].map(l => (
                              <button
                                key={l}
                                disabled={levSaving[p.id]}
                                onClick={() => handleSetLev(p.id, l)}
                                style={{
                                  width: 28, height: 26, border: 'none', borderRadius: 4,
                                  cursor: 'pointer', fontSize: 11, fontWeight: 700,
                                  background: lev === l ? 'var(--color-primary)' : 'var(--color-surface2)',
                                  color: lev === l ? '#fff' : 'var(--color-muted)',
                                }}
                              >{l}</button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
