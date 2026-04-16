import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../../api/index.js'

export default function AdminGDTPuntajes() {
  const { fechaId } = useParams()
  const [fecha, setFecha]       = useState(null)
  const [jugadores, setJugadores] = useState([])
  const [editados, setEditados]   = useState({})
  const [loading, setLoading]     = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito]         = useState(null)
  const [error, setError]         = useState(null)
  const gridRef = useRef(null)

  // Sort
  const [sort, setSort] = useState({ col: 'nombre', dir: 'asc' })

  // Filtros
  const [filtros, setFiltros] = useState({ nombre: '', equipo: '', cargado: '', jugo: '' })

  useEffect(() => { cargar() }, [fechaId])

  async function cargar() {
    setLoading(true); setError(null)
    try {
      const [fechaRes, puntajesRes] = await Promise.all([
        api.getFecha(fechaId),
        api.gdtGetPuntajes(fechaId),
      ])
      setFecha(fechaRes)
      const jugs = puntajesRes.jugadores || []
      setJugadores(jugs)
      const init = {}
      for (const j of jugs) {
        init[j.jugador_id] = {
          puntos: j.puntos !== null ? String(j.puntos) : '',
          jugo:   j.jugo   !== null ? j.jugo : true,
        }
      }
      setEditados(init)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  function handlePuntos(id, val) { setEditados(p => ({ ...p, [id]: { ...p[id], puntos: val } })); setExito(null) }
  function handleJugo(id, val)   { setEditados(p => ({ ...p, [id]: { ...p[id], jugo: val } }));  setExito(null) }

  function toggleSort(col) {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }

  // Equipos únicos para el select
  const equiposUnicos = useMemo(() =>
    [...new Set(jugadores.map(j => j.equipo_real).filter(Boolean))].sort()
  , [jugadores])

  // Filtrado + ordenado
  const filas = useMemo(() => {
    let rows = jugadores.filter(j => {
      const ed = editados[j.jugador_id] || {}
      if (filtros.nombre  && !j.nombre.toLowerCase().includes(filtros.nombre.toLowerCase())) return false
      if (filtros.equipo  && j.equipo_real !== filtros.equipo) return false
      if (filtros.cargado === 'si'  && !j.cargado) return false
      if (filtros.cargado === 'no'  &&  j.cargado) return false
      if (filtros.jugo    === 'si'  && !ed.jugo)  return false
      if (filtros.jugo    === 'no'  &&  ed.jugo)  return false
      return true
    })

    rows = [...rows].sort((a, b) => {
      let va, vb
      if (sort.col === 'puntaje') {
        va = Number(editados[a.jugador_id]?.puntos ?? -Infinity)
        vb = Number(editados[b.jugador_id]?.puntos ?? -Infinity)
      } else if (sort.col === 'jugo') {
        va = editados[a.jugador_id]?.jugo ? 1 : 0
        vb = editados[b.jugador_id]?.jugo ? 1 : 0
      } else {
        va = a[sort.col === 'nombre' ? 'nombre' : 'equipo_real'] ?? ''
        vb = b[sort.col === 'nombre' ? 'nombre' : 'equipo_real'] ?? ''
      }
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es')
      return sort.dir === 'asc' ? cmp : -cmp
    })

    return rows
  }, [jugadores, editados, filtros, sort])

  // Navegación teclado
  function handleKeyDown(e, rowIdx) {
    if (!gridRef.current) return
    const inputs = Array.from(gridRef.current.querySelectorAll('input[data-row]'))
    const idx    = inputs.indexOf(e.target)
    if (idx === -1) return
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const next = e.shiftKey ? inputs[idx - 1] : inputs[idx + 1]
      if (next) { next.focus(); next.select?.() }
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const col     = e.target.dataset.col
      const colRows = inputs.filter(i => i.dataset.col === col)
      const ci      = colRows.indexOf(e.target)
      const target  = e.key === 'ArrowDown' ? colRows[ci + 1] : colRows[ci - 1]
      if (target) { target.focus(); target.select?.() }
    }
  }

  async function handleGuardar() {
    setGuardando(true); setError(null); setExito(null)
    try {
      const puntajes = jugadores
        .filter(j => editados[j.jugador_id]?.puntos !== '')
        .map(j => {
          const ed  = editados[j.jugador_id]
          const pts = parseInt(ed?.puntos, 10)
          return { jugador_id: j.jugador_id, puntos: isNaN(pts) ? 0 : pts, jugo: ed?.jugo ?? true }
        })
        .filter(p => p.puntos !== null)

      await api.gdtGuardarPuntajes(fechaId, puntajes)
      setExito(`Puntajes guardados y GDT recalculado (${puntajes.length} jugadores)`)
      await cargar()
    } catch (e) { setError(e.message) }
    finally { setGuardando(false) }
  }

  if (loading) return <div className="main-content"><p style={{ color: 'var(--color-muted)' }}>Cargando...</p></div>

  const totalCargados = jugadores.filter(j => j.cargado).length
  const hayFiltros    = Object.values(filtros).some(v => v !== '')

  const SortTh = ({ col, label, center }) => (
    <th
      onClick={() => toggleSort(col)}
      style={{ ...thStyle, cursor: 'pointer', userSelect: 'none', textAlign: center ? 'center' : 'left', background: sort.col === col ? 'var(--color-surface2)' : 'transparent', whiteSpace: 'nowrap' }}
    >
      {label}
      <span style={{ marginLeft: 4, opacity: sort.col === col ? 1 : 0.3, fontSize: 10 }}>
        {sort.col === col ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
      </span>
    </th>
  )

  return (
    <div className="main-content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Link to={`/admin/fecha/${fechaId}`} style={{ color: 'var(--color-muted)', fontSize: 13 }}>
            ← {fecha?.nombre || `Fecha ${fechaId}`}
          </Link>
          <h2 style={{ margin: '4px 0 0' }}>🏆 Puntajes GDT</h2>
        </div>
        <button className="btn btn-primary" onClick={handleGuardar} disabled={guardando || !jugadores.length}>
          {guardando ? 'Guardando...' : 'Guardar y recalcular'}
        </button>
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 12, color: 'var(--color-danger)' }}>{error}</div>}
      {exito && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid var(--color-success)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 12, color: 'var(--color-success)' }}>{exito}</div>}

      {!jugadores.length ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-muted)' }}>
          <p>No hay jugadores GDT en este torneo todavía.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, fontSize: 13, color: 'var(--color-muted)' }}>
            <span>{totalCargados}/{jugadores.length} cargados · {filas.length} visibles · Tab/Enter/↑↓ para navegar</span>
            {hayFiltros && (
              <button className="btn btn-secondary btn-sm" onClick={() => setFiltros({ nombre: '', equipo: '', cargado: '', jugo: '' })}>
                ✕ Limpiar filtros
              </button>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }} ref={gridRef}>
              <thead>
                {/* Headers sortables */}
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ ...thStyle, width: 36 }}>#</th>
                  <SortTh col="nombre"   label="Jugador" />
                  <SortTh col="equipo"   label="Equipo" />
                  <SortTh col="puntaje"  label="Puntaje" center />
                  <SortTh col="jugo"     label="¿Jugó?" center />
                </tr>

                {/* Fila de filtros */}
                <tr style={{ borderBottom: '2px solid var(--color-border)', background: 'var(--color-surface2)' }}>
                  <th style={thF}></th>
                  <th style={thF}>
                    <input value={filtros.nombre} onChange={e => setFiltros(f => ({ ...f, nombre: e.target.value }))}
                      placeholder="Filtrar..." style={fi} />
                  </th>
                  <th style={thF}>
                    <select value={filtros.equipo} onChange={e => setFiltros(f => ({ ...f, equipo: e.target.value }))} style={fi}>
                      <option value="">Todos</option>
                      {equiposUnicos.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                    </select>
                  </th>
                  <th style={{ ...thF, textAlign: 'center' }}>
                    <select value={filtros.cargado} onChange={e => setFiltros(f => ({ ...f, cargado: e.target.value }))} style={{ ...fi, width: 90 }}>
                      <option value="">Todos</option>
                      <option value="si">Cargado</option>
                      <option value="no">Sin cargar</option>
                    </select>
                  </th>
                  <th style={{ ...thF, textAlign: 'center' }}>
                    <select value={filtros.jugo} onChange={e => setFiltros(f => ({ ...f, jugo: e.target.value }))} style={{ ...fi, width: 80 }}>
                      <option value="">Todos</option>
                      <option value="si">Jugó</option>
                      <option value="no">No jugó</option>
                    </select>
                  </th>
                </tr>
              </thead>

              <tbody>
                {filas.map((j, idx) => {
                  const ed     = editados[j.jugador_id] || { puntos: '', jugo: true }
                  const cargado = j.cargado
                  return (
                    <tr key={j.jugador_id} style={{ borderBottom: '1px solid var(--color-border)', background: cargado ? 'rgba(34,197,94,0.04)' : 'transparent' }}>
                      <td style={{ ...tdStyle, color: 'var(--color-muted)', width: 36 }}>{idx + 1}</td>
                      <td style={tdStyle}>{j.nombre}</td>
                      <td style={{ ...tdStyle, color: 'var(--color-muted)' }}>{j.equipo_real}</td>
                      <td style={{ ...tdStyle, textAlign: 'center', width: 100 }}>
                        <input
                          type="number"
                          value={ed.puntos}
                          onChange={e => handlePuntos(j.jugador_id, e.target.value)}
                          onKeyDown={e => handleKeyDown(e, idx)}
                          data-row={idx} data-col="puntos"
                          style={{ ...inputStyle, width: 70, textAlign: 'center', color: Number(ed.puntos) < 0 ? 'var(--color-danger)' : 'var(--color-text)' }}
                          placeholder="—"
                        />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center', width: 80 }}>
                        <input
                          type="checkbox"
                          checked={!!ed.jugo}
                          onChange={e => handleJugo(j.jugador_id, e.target.checked)}
                          data-row={idx} data-col="jugo"
                          style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                        />
                      </td>
                    </tr>
                  )
                })}
                {filas.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--color-muted)' }}>
                    Sin resultados con los filtros actuales.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleGuardar} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar y recalcular'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

const thStyle = { textAlign: 'left', padding: '7px 12px', color: 'var(--color-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', transition: 'background 0.1s' }
const thF     = { padding: '4px 6px' }
const tdStyle = { padding: '6px 12px' }
const inputStyle = { background: 'var(--color-surface2)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text)', padding: '5px 8px', fontSize: 13 }
const fi      = { background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 3, color: 'var(--color-text)', padding: '3px 6px', fontSize: 11, width: '100%' }
