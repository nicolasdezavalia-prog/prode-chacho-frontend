import { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { api } from '../api/index.js'
import { useAuth } from '../App.jsx'

function calcularLEV(gl, gv) {
  if (gl === '' || gv === '' || gl === null || gv === null) return null
  const l = parseInt(gl), v = parseInt(gv)
  if (isNaN(l) || isNaN(v)) return null
  if (l > v) return 'L'
  if (l === v) return 'E'
  return 'V'
}

function parseCfg(config_json) {
  if (!config_json) return null
  try { return JSON.parse(config_json) } catch { return null }
}

// Dado config_json y un id de opción, retorna el label visible
function labelOpcion(config_json, id) {
  const cfg = parseCfg(config_json)
  if (!cfg) return id
  const op = (cfg.opciones || []).find(o => o.id === id)
  return op?.label || id
}

// Retorna true si el evento tiene resultado cargado (partido o pregunta)
function tieneResultadoCargado(ev) {
  if (ev.tipo === 'partido') return ev.lev_real !== null && ev.lev_real !== undefined
  return ev.resultado_json !== null && ev.resultado_json !== undefined
}

function BloquePronos({ nombre, eventos, pronosticos, onChangePronostico, editando, bloqueNum }) {
  const [abierto, setAbierto] = useState(true)

  const totalPts = eventos.reduce((sum, ev) => {
    const p = pronosticos[ev.id]
    return sum + (p?.puntos_obtenidos || 0)
  }, 0)

  const eventosConResultado = eventos.filter(tieneResultadoCargado)

  return (
    <div className="bloque-section">
      <div className="bloque-header" onClick={() => setAbierto(!abierto)}>
        <div>
          <span style={{marginRight: 8}}>{bloqueNum === 1 ? '🟩' : '🟦'}</span>
          {nombre}
          <span className="text-muted" style={{fontSize: 12, marginLeft: 12}}>
            ({eventosConResultado.length}/{eventos.length} resultados)
          </span>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <span style={{fontWeight: 700, color: 'var(--color-primary)'}}>{totalPts} pts</span>
          <span>{abierto ? '▲' : '▼'}</span>
        </div>
      </div>

      {abierto && (
        <div className="bloque-content">
          {eventos.map(ev => {
            const pron = pronosticos[ev.id] || {}
            const tieneResultado = tieneResultadoCargado(ev)
            const cfg = parseCfg(ev.config_json)
            const subtipo = cfg?.subtipo

            // acertó: partido → LEV correcto; pregunta → opcion correcta
            const acerto = (() => {
              if (!tieneResultado) return false
              if (ev.tipo === 'partido') return pron.lev_pronostico === ev.lev_real
              if (!pron.opcion_elegida || !ev.resultado_json) return false
              try {
                const res = JSON.parse(ev.resultado_json)
                if (subtipo === 'multi_select') {
                  const elegidas = JSON.parse(pron.opcion_elegida || '[]')
                  return (res.correctas || []).some(id => elegidas.includes(id))
                }
                return pron.opcion_elegida === res.correcta
              } catch { return false }
            })()

            const exacto = ev.tipo === 'partido' && tieneResultado && acerto &&
              pron.goles_local === ev.resultado_local &&
              pron.goles_visitante === ev.resultado_visitante

            // Label visible del pronóstico de pregunta
            const labelPronPregunta = (() => {
              if (!pron.opcion_elegida) return null
              if (subtipo === 'multi_select') {
                try {
                  const ids = JSON.parse(pron.opcion_elegida)
                  return ids.map(id => labelOpcion(ev.config_json, id)).join(', ')
                } catch { return pron.opcion_elegida }
              }
              return labelOpcion(ev.config_json, pron.opcion_elegida)
            })()

            // Label visible del resultado correcto de pregunta
            const labelResultadoPregunta = (() => {
              if (!ev.resultado_json) return null
              try {
                const res = JSON.parse(ev.resultado_json)
                if (subtipo === 'multi_select') {
                  return (res.correctas || []).map(id => labelOpcion(ev.config_json, id)).join(', ')
                }
                return labelOpcion(ev.config_json, res.correcta)
              } catch { return '?' }
            })()

            return (
              <div key={ev.id} className="evento-row">
                {/* Número */}
                <span className="evento-num">{ev.orden}</span>

                {/* Nombre del evento */}
                <div className="evento-nombre">
                  {ev.tipo === 'partido' ? (
                    <>
                      <span>
                        {ev.local} <span className="text-muted">vs</span> {ev.visitante}
                        {ev.condicion && <span className="text-muted" style={{fontSize: 11, marginLeft: 6}}>({ev.condicion})</span>}
                      </span>
                      {ev.condicion && (
                        <div style={{fontSize: 10, color: 'var(--color-primary)', marginTop: 2, opacity: 0.75}}>
                          L:{ev.pts_local} · E:{ev.pts_empate} · V:{ev.pts_visitante} · ★:{ev.pts_exacto}
                        </div>
                      )}
                    </>
                  ) : (
                    <span>❓ {ev.pregunta_texto}</span>
                  )}
                  {(ev.evento || ev.torneo_contexto) && (
                    <div style={{fontSize: 11, color: 'var(--color-muted)'}}>{ev.evento || ev.torneo_contexto}</div>
                  )}
                </div>

                {/* Pronóstico */}
                {ev.tipo === 'partido' ? (
                  editando ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="pronostico-input-group">
                        <input type="number" min="0" max="20"
                          value={pron._glLocal ?? (pron.goles_local ?? '')}
                          onChange={e => onChangePronostico(ev.id, 'goles_local', e.target.value)}
                          style={{width: 48, textAlign: 'center', padding: '4px'}} />
                        <span className="separator">-</span>
                        <input type="number" min="0" max="20"
                          value={pron._glVisitante ?? (pron.goles_visitante ?? '')}
                          onChange={e => onChangePronostico(ev.id, 'goles_visitante', e.target.value)}
                          style={{width: 48, textAlign: 'center', padding: '4px'}} />
                      </div>
                      {/* Botones LEV — auto desde goles pero overridable */}
                      <div style={{ display: 'flex', gap: 3 }}>
                        {['L','E','V'].map(lev => {
                          const levAuto = calcularLEV(
                            pron._glLocal ?? pron.goles_local,
                            pron._glVisitante ?? pron.goles_visitante
                          )
                          const levActual = pron._levOverride ?? levAuto
                          const activo = levActual === lev
                          const esManual = pron._levOverride && pron._levOverride !== levAuto
                          return (
                            <button
                              key={lev}
                              type="button"
                              onClick={() => onChangePronostico(ev.id, '_lev_override', lev)}
                              style={{
                                width: 28, height: 28, border: 'none', borderRadius: 4,
                                cursor: 'pointer', fontSize: 11, fontWeight: 700,
                                background: activo
                                  ? (esManual && activo ? '#7c3aed' : 'var(--color-primary)')
                                  : 'var(--color-surface2)',
                                color: activo ? '#fff' : 'var(--color-muted)',
                                outline: activo ? `2px solid ${esManual ? '#7c3aed' : 'var(--color-primary)'}` : 'none',
                                outlineOffset: 1,
                              }}
                              title={lev === pron._levOverride && lev !== levAuto ? 'LEV manual (diferente al calculado)' : ''}
                            >
                              {lev}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <span className="evento-pronostico">
                      {pron.goles_local !== null && pron.goles_local !== undefined
                        ? `${pron.goles_local}-${pron.goles_visitante}`
                        : <span style={{color: 'var(--color-warning)'}}>sin pronóstico</span>}
                    </span>
                  )
                ) : (
                  editando ? (
                    <div className="pronostico-input-group" style={{flexDirection:'column', gap:4, alignItems:'flex-start'}}>
                      {(subtipo === 'opcion_unica' || subtipo === 'binaria') && (cfg?.opciones || []).map(op => (
                        <label key={op.id} style={{display:'flex', gap:6, alignItems:'center', cursor:'pointer', fontSize:13}}>
                          <input type="radio" name={`preg-${ev.id}`} value={op.id}
                            checked={pron.opcion_elegida === op.id}
                            onChange={() => onChangePronostico(ev.id, 'opcion_elegida', op.id)}
                            style={{width:'auto'}} />
                          {op.label}
                          {subtipo === 'binaria' && <span style={{color:'var(--color-muted)',fontSize:11}}> ({op.pts}pts)</span>}
                        </label>
                      ))}
                      {subtipo === 'multi_select' && (cfg?.opciones || []).map(op => {
                        let elegidas = []; try { elegidas = JSON.parse(pron.opcion_elegida || '[]') } catch {}
                        return (
                          <label key={op.id} style={{display:'flex', gap:6, alignItems:'center', cursor:'pointer', fontSize:13}}>
                            <input type="checkbox" checked={elegidas.includes(op.id)}
                              onChange={() => onChangePronostico(ev.id, '_toggle_multi', op.id)}
                              style={{width:'auto'}} />
                            {op.label}
                          </label>
                        )
                      })}
                      {subtipo === 'abierta' && (
                        <div style={{width:'100%'}}>
                          <textarea
                            value={pron.opcion_elegida || ''}
                            onChange={e => onChangePronostico(ev.id, 'opcion_elegida', e.target.value)}
                            placeholder="Escribí tu respuesta..."
                            rows={3}
                            style={{
                              width: '100%', resize: 'vertical',
                              fontFamily: 'inherit', fontSize: 13,
                              background: 'var(--color-surface2)',
                              border: '1px solid var(--color-border)',
                              borderRadius: 'var(--radius)',
                              color: 'var(--color-text)',
                              padding: '8px 10px'
                            }}
                          />
                          {cfg?.criterio && (
                            <div style={{fontSize: 11, color: 'var(--color-muted)', marginTop: 4}}>
                              📋 {cfg.criterio}
                            </div>
                          )}
                          {cfg?.pts_max && (
                            <div style={{fontSize: 11, color: 'var(--color-muted)', marginTop: 2}}>
                              Puntaje máximo: {cfg.pts_max} pts
                            </div>
                          )}
                        </div>
                      )}
                      {!subtipo && (
                        <span style={{fontSize:12, color:'var(--color-muted)'}}>Pregunta no configurada</span>
                      )}
                    </div>
                  ) : (
                    <span className="evento-pronostico">
                      {/* Abierta en modo lectura: mostrar respuesta enviada */}
                      {subtipo === 'abierta'
                        ? (pron.opcion_elegida
                            ? <em style={{fontSize:12}}>"{pron.opcion_elegida}"</em>
                            : <span style={{color:'var(--color-warning)'}}>sin respuesta</span>)
                        : (labelPronPregunta
                            ? labelPronPregunta
                            : <span style={{color: 'var(--color-warning)'}}>sin pronóstico</span>)}
                    </span>
                  )
                )}

                {/* Resultado real */}
                {subtipo === 'abierta' ? (
                  // Para preguntas abiertas no hay "resultado correcto" — solo corrección manual
                  <span className="text-muted" style={{fontSize: 11}}>
                    {(pron.puntos_obtenidos || 0) > 0 ? '✓ corregido' : '—'}
                  </span>
                ) : tieneResultado ? (
                  <span className="evento-resultado">
                    {ev.tipo === 'partido'
                      ? `${ev.resultado_local}-${ev.resultado_visitante}`
                      : labelResultadoPregunta}
                    {ev.tipo === 'partido' && (
                      <span className="text-muted" style={{fontSize: 11, marginLeft: 4}}>({ev.lev_real})</span>
                    )}
                  </span>
                ) : (
                  <span className="text-muted" style={{fontSize: 11}}>—</span>
                )}

                {/* Puntos */}
                {subtipo === 'abierta' ? (
                  // Abierta: mostrar puntos si ya fueron asignados, o "pendiente" si no
                  (pron.puntos_obtenidos || 0) > 0
                    ? <span className="evento-puntos positivo">{pron.puntos_obtenidos}</span>
                    : <span className="evento-puntos cero" style={{fontSize: 11}}>pend.</span>
                ) : tieneResultado ? (
                  <span className={`evento-puntos ${(pron.puntos_obtenidos || 0) > 0 ? 'positivo' : 'cero'}`}>
                    {pron.puntos_obtenidos || 0}
                    {exacto && <span style={{fontSize: 10, marginLeft: 2}}>★</span>}
                  </span>
                ) : (
                  <span className="evento-puntos cero">—</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function MiFecha() {
  const { fechaId } = useParams()
  const [searchParams] = useSearchParams()
  const modoPreview = searchParams.get('preview') === 'true'
  const { user } = useAuth()
  const [fecha, setFecha] = useState(null)
  const [eventos, setEventos] = useState([])
  const [pronosticos, setPronosticos] = useState({})
  const [cruce, setCruce] = useState(null)
  const [gdtResultado, setGdtResultado] = useState(null)
  const [gdtAbierto, setGdtAbierto] = useState(false)
  const [editando, setEditando] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadFecha()
  }, [fechaId])

  const loadFecha = async () => {
    try {
      setLoading(true)
      setEditando(false) // reset defensivo antes de cargar estado real
      const [f, evs] = await Promise.all([
        api.getFecha(fechaId),
        api.getEventos(fechaId)
      ])
      setFecha(f)
      setEventos(evs)

      // Cargar pronósticos
      try {
        const pronos = await api.getPronosticos(fechaId)
        const pronoMap = {}
        for (const p of pronos) {
          // Restaurar _levOverride desde DB si el usuario había seteado LEV manual antes
          // Sin esto, al recargar y volver a guardar se pierde el override y se pisa con V/L/E calculado del score
          pronoMap[p.evento_id] = {
            ...p,
            _levOverride: p.lev_manual ? p.lev_pronostico : null
          }
        }
        setPronosticos(pronoMap)
      } catch (_) {}

      // Cargar cruce
      let cruceData = null
      try {
        cruceData = await api.getMiCruce(fechaId)
        setCruce(cruceData)
      } catch (_) {}

      // Cargar resultado GDT si hay cruce
      if (cruceData?.id) {
        try {
          const gdt = await api.gdtGetResultado(cruceData.id)
          if (gdt?.disponible) setGdtResultado(gdt)
        } catch (_) {}
      }

      // Superadmin (sin preview) puede editar siempre. Admins y jugadores: solo si fecha abierta.
      const esAdminReal = user.role === 'superadmin' && !modoPreview
      if (f.estado === 'abierta' || esAdminReal) setEditando(true)

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleChangePronostico = (eventoId, campo, valor) => {
    // Caso especial: toggle de opción en multi_select
    if (campo === '_toggle_multi') {
      setPronosticos(prev => {
        const current = prev[eventoId] || { evento_id: eventoId }
        let elegidas = []
        try { elegidas = JSON.parse(current.opcion_elegida || '[]') } catch {}
        if (elegidas.includes(valor)) {
          elegidas = elegidas.filter(id => id !== valor)
        } else {
          elegidas = [...elegidas, valor]
        }
        return { ...prev, [eventoId]: { ...current, opcion_elegida: JSON.stringify(elegidas) } }
      })
      return
    }

    // Caso especial: override manual de LEV
    if (campo === '_lev_override') {
      setPronosticos(prev => ({
        ...prev,
        [eventoId]: { ...(prev[eventoId] || { evento_id: eventoId }), _levOverride: valor }
      }))
      return
    }

    // Al cambiar goles, limpiar el override manual para que vuelva al auto
    if (campo === 'goles_local' || campo === 'goles_visitante') {
      setPronosticos(prev => ({
        ...prev,
        [eventoId]: {
          ...(prev[eventoId] || { evento_id: eventoId }),
          [campo]: valor,
          _levOverride: null
        }
      }))
      return
    }

    setPronosticos(prev => ({
      ...prev,
      [eventoId]: { ...(prev[eventoId] || { evento_id: eventoId }), [campo]: valor }
    }))
  }

  const handleGuardar = async () => {
    setSaving(true); setError(''); setSuccess('')
    try {
      const payload = []

      for (const [eventoIdStr, p] of Object.entries(pronosticos)) {
        const eventoId = parseInt(eventoIdStr)
        // Partido: requiere goles_local y goles_visitante
        if (p.goles_local !== undefined && p.goles_visitante !== undefined) {
          const gl = parseInt(p.goles_local)
          const gv = parseInt(p.goles_visitante)
          if (!isNaN(gl) && !isNaN(gv)) {
            const entry = { evento_id: eventoId, goles_local: gl, goles_visitante: gv }
            // Incluir LEV manual si fue sobreescrito por el usuario
            if (p._levOverride) entry.lev_pronostico = p._levOverride
            payload.push(entry)
          }
        }
        // Pregunta: requiere opcion_elegida no vacía
        else if (p.opcion_elegida !== undefined && p.opcion_elegida !== '' && p.opcion_elegida !== '[]') {
          payload.push({ evento_id: eventoId, opcion_elegida: p.opcion_elegida })
        }
      }

      await api.bulkPronosticos(fechaId, payload)
      await loadFecha()
      setSuccess('Pronósticos guardados correctamente')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading">Cargando fecha...</div>
  if (error && !fecha) return <div className="error-msg">{error}</div>

  // Superadmin (sin ?preview): puede editar siempre. Admin y user: solo si fecha abierta.
  const esAdminReal = user.role === 'superadmin' && !modoPreview
  const puedeEditar = esAdminReal || fecha?.estado === 'abierta'

  const bloque1 = eventos.filter(ev => ev.orden >= 1 && ev.orden <= 15)
  const bloque2 = eventos.filter(ev => ev.orden >= 16 && ev.orden <= 30)

  const ptsTablaA = bloque1.reduce((sum, ev) => sum + (pronosticos[ev.id]?.puntos_obtenidos || 0), 0)
  const ptsTablaB = bloque2.reduce((sum, ev) => sum + (pronosticos[ev.id]?.puntos_obtenidos || 0), 0)
  const totalPts = ptsTablaA + ptsTablaB

  const resultadoFecha = () => {
    if (!cruce) return null
    if (cruce.ganador_fecha === 'empate') return { texto: 'EMPATE', color: 'var(--color-muted)' }
    if (cruce.yo_ganador_fecha === true) return { texto: 'GANANDO', color: 'var(--color-success)' }
    if (cruce.yo_ganador_fecha === false && cruce.ganador_fecha) return { texto: 'PERDIENDO', color: 'var(--color-danger)' }
    return null
  }

  const resTotal = resultadoFecha()

  return (
    <div>
      {/* Header */}
      <div className="flex-between mb-16">
        <div>
          <Link to="/" className="text-muted" style={{fontSize: 13, textDecoration: 'none'}}>
            ← Inicio
          </Link>
          <div className="page-title" style={{marginTop: 4, marginBottom: 2}}>{fecha?.nombre}</div>
          <div style={{fontSize: 13, color: 'var(--color-muted)'}}>
            {fecha?.bloque1_nombre} · {fecha?.bloque2_nombre}
          </div>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
          <Link to={`/fecha/${fechaId}/enfrentamientos`} className="btn btn-secondary btn-sm">
            ⚔️ Enfrentamientos
          </Link>
          {user.role === 'admin' && (
            <Link to={`/admin/fecha/${fechaId}/resultados`} className="btn btn-secondary btn-sm">
              Cargar resultados
            </Link>
          )}
          {puedeEditar && (
            <button
              className="btn btn-primary"
              onClick={handleGuardar}
              disabled={saving}
            >
              {saving ? 'Guardando...' : '💾 Guardar pronósticos'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {success && <div className="success-msg">{success}</div>}

      {/* Cruce: resultado en vivo */}
      {cruce && (
        <div className="card mb-16">
          {/* Header del cruce */}
          <div style={{
            textAlign: 'center',
            fontSize: 13,
            color: 'var(--color-muted)',
            marginBottom: 12
          }}>
            Fecha {fecha?.numero} · Tu cruce
          </div>

          {/* Marcador principal yo vs rival */}
          <div className="resultado-live">
            <div style={{textAlign: 'left'}}>
              <div className="nombre">{cruce.yo_nombre} (vos)</div>
              <div className={`puntos ${cruce.yo_puntos_internos > cruce.rival_puntos_internos ? 'ganando' : cruce.yo_puntos_internos < cruce.rival_puntos_internos ? 'perdiendo' : ''}`}>
                {cruce.yo_puntos_internos}
              </div>
            </div>
            <div className="vs">VS</div>
            <div style={{textAlign: 'right'}}>
              <div className="nombre">{cruce.rival_nombre}</div>
              <div className={`puntos ${cruce.rival_puntos_internos > cruce.yo_puntos_internos ? 'ganando' : cruce.rival_puntos_internos < cruce.yo_puntos_internos ? 'perdiendo' : ''}`}>
                {cruce.rival_puntos_internos}
              </div>
            </div>
          </div>

          {/* Resultado global */}
          {resTotal && (
            <div style={{
              textAlign: 'center',
              fontWeight: 700,
              fontSize: 16,
              color: resTotal.color,
              marginBottom: 12,
              padding: '8px',
              background: 'var(--color-surface2)',
              borderRadius: 'var(--radius)'
            }}>
              {resTotal.texto}
            </div>
          )}

          {/* Desglose por bloque */}
          <div className="resultado-bloque">
            <span className="bloque-nombre">🟩 {fecha?.bloque1_nombre}</span>
            <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
              <span className="marcador">
                {cruce.yo_pts_tabla_a} - {cruce.rival_pts_tabla_a}
              </span>
              {cruce.ganador_tabla_a === 'empate'
                ? <span className="icon-empate">🤝</span>
                : cruce.yo_ganador_tabla_a
                  ? <span className="icon-ganando">✅</span>
                  : <span className="icon-perdiendo">❌</span>
              }
            </div>
          </div>

          <div className="resultado-bloque">
            <span className="bloque-nombre">🟦 {fecha?.bloque2_nombre}</span>
            <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
              <span className="marcador">
                {cruce.yo_pts_tabla_b} - {cruce.rival_pts_tabla_b}
              </span>
              {cruce.ganador_tabla_b === 'empate'
                ? <span className="icon-empate">🤝</span>
                : cruce.yo_ganador_tabla_b
                  ? <span className="icon-ganando">✅</span>
                  : <span className="icon-perdiendo">❌</span>
              }
            </div>
          </div>

          {cruce.gdt_duelos_u1 !== null && cruce.gdt_duelos_u1 !== undefined ? (
            <div className="resultado-bloque">
              <span className="bloque-nombre">🟪 Gran DT</span>
              <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                <span className="marcador">
                  {cruce.yo_gdt_duelos} - {cruce.rival_gdt_duelos}
                </span>
                {cruce.ganador_gdt === 'empate'
                  ? <span className="icon-empate">🤝</span>
                  : cruce.yo_ganador_gdt
                    ? <span className="icon-ganando">✅</span>
                    : <span className="icon-perdiendo">❌</span>
                }
              </div>
            </div>
          ) : (
            <div className="resultado-bloque">
              <span className="bloque-nombre">🟪 Gran DT</span>
              <span className="text-muted" style={{fontSize: 12}}>Pendiente</span>
            </div>
          )}
        </div>
      )}

      {/* Detalle GDT slot a slot */}
      {gdtResultado && (
        <div className="card mb-16">
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setGdtAbierto(!gdtAbierto)}
          >
            <strong style={{ fontSize: 14 }}>🟪 Detalle Gran DT</strong>
            <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>{gdtAbierto ? '▲ ocultar' : '▼ ver duelos'}</span>
          </div>

          {gdtAbierto && (
            <div style={{ marginTop: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th style={gdtThStyle}>Slot</th>
                    <th style={gdtThStyle}>Tu jugador</th>
                    <th style={{ ...gdtThStyle, textAlign: 'center' }}>Pts</th>
                    <th style={{ ...gdtThStyle, textAlign: 'center' }}>—</th>
                    <th style={{ ...gdtThStyle, textAlign: 'center' }}>Pts</th>
                    <th style={gdtThStyle}>Rival</th>
                    <th style={{ ...gdtThStyle, textAlign: 'center' }}>Duelo</th>
                  </tr>
                </thead>
                <tbody>
                  {gdtResultado.duelos.map(d => {
                    const yoEsU1 = cruce?.yo_es_user1
                    const miJug        = yoEsU1 ? d.jugador_u1 : d.jugador_u2
                    const miEquipo     = yoEsU1 ? d.equipo_u1  : d.equipo_u2
                    const rivalJug     = yoEsU1 ? d.jugador_u2 : d.jugador_u1
                    const rivalEquipo  = yoEsU1 ? d.equipo_u2  : d.equipo_u1
                    const miPts        = yoEsU1 ? d.pts_u1 : d.pts_u2
                    const rivalPts     = yoEsU1 ? d.pts_u2 : d.pts_u1
                    const miEliminado  = yoEsU1 ? d.eliminado_u1 : d.eliminado_u2
                    const rivalEliminado = yoEsU1 ? d.eliminado_u2 : d.eliminado_u1
                    const miGanador    = (yoEsU1 && d.ganador === 'a') || (!yoEsU1 && d.ganador === 'b')
                    const rivalGanador = (yoEsU1 && d.ganador === 'b') || (!yoEsU1 && d.ganador === 'a')
                    return (
                      <tr key={d.slot} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ ...gdtTdStyle, color: 'var(--color-primary)', fontWeight: 600 }}>{d.slot}</td>
                        <td style={{ ...gdtTdStyle, color: miEliminado ? 'var(--color-danger)' : 'inherit' }}>
                          {miJug || '—'}
                          {miEquipo && <span style={{color: 'var(--color-muted)', fontSize: 11}}> ({miEquipo})</span>}
                          {miEliminado && ' ❌'}
                        </td>
                        <td style={{ ...gdtTdStyle, textAlign: 'center', fontWeight: 600, color: miGanador ? 'var(--color-success)' : 'inherit' }}>
                          {miPts}
                        </td>
                        <td style={{ ...gdtTdStyle, textAlign: 'center', color: 'var(--color-muted)' }}>vs</td>
                        <td style={{ ...gdtTdStyle, textAlign: 'center', fontWeight: 600, color: rivalGanador ? 'var(--color-danger)' : 'inherit' }}>
                          {rivalPts}
                        </td>
                        <td style={{ ...gdtTdStyle, color: rivalEliminado ? 'var(--color-danger)' : 'var(--color-muted)' }}>
                          {rivalJug || '—'}
                          {rivalEquipo && <span style={{color: 'var(--color-muted)', fontSize: 11}}> ({rivalEquipo})</span>}
                          {rivalEliminado && ' ❌'}
                        </td>
                        <td style={{ ...gdtTdStyle, textAlign: 'center' }}>
                          {d.ganador === 'empate'
                            ? <span style={{ color: 'var(--color-muted)' }}>🤝</span>
                            : miGanador
                              ? <span style={{ color: 'var(--color-success)' }}>✅</span>
                              : <span style={{ color: 'var(--color-danger)' }}>❌</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, padding: '8px 12px', background: 'var(--color-surface2)', borderRadius: 'var(--radius)' }}>
                <span style={{ fontSize: 13 }}>
                  Duelos: <strong style={{ color: 'var(--color-primary)' }}>
                    {cruce?.yo_es_user1 ? gdtResultado.duelos_u1 : gdtResultado.duelos_u2}
                  </strong> — <strong style={{ color: 'var(--color-muted)' }}>
                    {cruce?.yo_es_user1 ? gdtResultado.duelos_u2 : gdtResultado.duelos_u1}
                  </strong>
                </span>
                <span style={{ fontSize: 13, fontWeight: 600,
                  color: gdtResultado.ganador_gdt === 'empate'
                    ? 'var(--color-muted)'
                    : ((cruce?.yo_es_user1 && gdtResultado.ganador_gdt === 'user1') || (!cruce?.yo_es_user1 && gdtResultado.ganador_gdt === 'user2'))
                      ? 'var(--color-success)'
                      : 'var(--color-danger)'
                }}>
                  {gdtResultado.ganador_gdt === 'empate'
                    ? 'GDT: Empate'
                    : ((cruce?.yo_es_user1 && gdtResultado.ganador_gdt === 'user1') || (!cruce?.yo_es_user1 && gdtResultado.ganador_gdt === 'user2'))
                      ? 'GDT: Ganaste ✅'
                      : 'GDT: Perdiste ❌'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mis puntos totales si no hay cruce */}
      {!cruce && (
        <div className="card mb-16">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div>
              <div style={{fontSize: 12, color: 'var(--color-muted)'}}>TUS PUNTOS</div>
              <div style={{fontSize: 28, fontWeight: 800, color: 'var(--color-primary)'}}>{totalPts}</div>
            </div>
            <div style={{textAlign: 'right'}}>
              <div style={{fontSize: 12, color: 'var(--color-muted)'}}>
                {fecha?.bloque1_nombre}: <strong>{ptsTablaA}</strong>
              </div>
              <div style={{fontSize: 12, color: 'var(--color-muted)'}}>
                {fecha?.bloque2_nombre}: <strong>{ptsTablaB}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estado de la fecha */}
      <div className="flex-between mb-12">
        <span className="text-muted" style={{fontSize: 12}}>
          {eventos.filter(tieneResultadoCargado).length} / {eventos.length} resultados cargados
        </span>
        {fecha?.estado === 'abierta' && (
          <span style={{fontSize: 12, color: 'var(--color-success)'}}>
            🟢 Fecha abierta · podés editar tu pronóstico
          </span>
        )}
        {fecha?.estado === 'cerrada' && (
          <span style={{fontSize: 12, color: 'var(--color-warning)'}}>
            🟡 Fecha cerrada · no se aceptan más pronósticos
          </span>
        )}
        {fecha?.estado === 'finalizada' && (
          <span style={{fontSize: 12, color: 'var(--color-muted)'}}>
            ✅ Fecha finalizada
          </span>
        )}
      </div>

      {/* Bloque 1 */}
      <BloquePronos
        nombre={`${fecha?.bloque1_nombre} (eventos 1-15)`}
        eventos={bloque1}
        pronosticos={pronosticos}
        onChangePronostico={handleChangePronostico}
        editando={editando && puedeEditar}
        bloqueNum={1}
      />

      {/* Bloque 2 */}
      <BloquePronos
        nombre={`${fecha?.bloque2_nombre} (eventos 16-30)`}
        eventos={bloque2}
        pronosticos={pronosticos}
        onChangePronostico={handleChangePronostico}
        editando={editando && puedeEditar}
        bloqueNum={2}
      />

      {/* Botón guardar al fondo */}
      {puedeEditar && (
        <div style={{marginTop: 20, textAlign: 'right'}}>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleGuardar}
            disabled={saving}
          >
            {saving ? 'Guardando...' : '💾 Guardar todos los pronósticos'}
          </button>
        </div>
      )}
    </div>
  )
}

const gdtThStyle = {
  textAlign: 'left', padding: '6px 8px',
  color: 'var(--color-muted)', fontSize: 11,
  fontWeight: 600, textTransform: 'uppercase',
}

const gdtTdStyle = {
  padding: '6px 8px', fontSize: 13,
}
