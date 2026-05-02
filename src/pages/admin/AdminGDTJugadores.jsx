import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api/index.js'

const POSICIONES = ['ARQ', 'DEF', 'MED', 'DEL']
const ESTADOS    = ['aprobado', 'pendiente', 'rechazado']

const ESTADO_STYLE = {
  aprobado:  { color: 'var(--color-success)', label: '✅ aprobado' },
  pendiente: { color: '#a78bfa',              label: '⏳ pendiente' },
  rechazado: { color: 'var(--color-danger)',  label: '🚫 rechazado' },
}

// ─── Componente de encabezado de columna ─────────────────────────────────────
function ColHeader({ label, col, sort, onSort }) {
  const active = sort.col === col
  return (
    <th
      onClick={() => onSort(col)}
      style={{
        ...thStyle,
        cursor: 'pointer',
        userSelect: 'none',
        background: active ? 'var(--color-surface2)' : 'transparent',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      {label}
      <span style={{ marginLeft: 4, opacity: active ? 1 : 0.3, fontSize: 10 }}>
        {active ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
      </span>
    </th>
  )
}

export default function AdminGDTJugadores() {
  const [searchParams] = useSearchParams()
  const ligaIdUrl = searchParams.get('liga_id')   // string | null

  // Liga seleccionada: inicializar desde URL si viene, si no se resuelve al cargar ligas
  const [ligas,              setLigas]              = useState([])
  const [ligaIdSeleccionado, setLigaIdSeleccionado] = useState(ligaIdUrl || null)

  const [jugadores, setJugadores] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [exito, setExito]         = useState(null)
  const [editando, setEditando]   = useState(null)
  const [form, setForm]           = useState({})
  const [guardando, setGuardando] = useState(false)

  // Sort
  const [sort, setSort] = useState({ col: 'equipo_real', dir: 'asc' })

  // Filtros por columna
  const [filtros, setFiltros] = useState({
    nombre: '', equipo_real: '', equipo_pais: '',
    posicion: '', estado: '', en_equipos: '',
  })

  // Modal merge
  const [mergeOrigen, setMergeOrigen]       = useState(null)
  const [mergeBusqueda, setMergeBusqueda]   = useState('')
  const [mergeCandidatos, setMergeCandidatos] = useState([])

  // Cargar ligas al montar. Si no viene liga_id en la URL, pre-seleccionar la default.
  useEffect(() => {
    api.gdtGetLigas()
      .then(ls => {
        const lista = Array.isArray(ls) ? ls : []
        setLigas(lista)
        if (!ligaIdUrl && lista.length > 0) {
          const def = lista.find(l => l.es_default) || lista[0]
          setLigaIdSeleccionado(String(def.id))
        }
      })
      .catch(() => {})
  }, [])

  // Recargar jugadores cada vez que cambia la liga seleccionada
  useEffect(() => {
    if (ligaIdSeleccionado !== null) cargar()
  }, [ligaIdSeleccionado])

  async function cargar() {
    setLoading(true); setError(null)
    try { setJugadores(await api.gdtGetTodosJugadores(ligaIdSeleccionado)) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  function setFiltro(key, val) {
    setFiltros(f => ({ ...f, [key]: val }))
  }

  function limpiarFiltros() {
    setFiltros({ nombre: '', equipo_real: '', equipo_pais: '', posicion: '', estado: '', en_equipos: '' })
  }

  function toggleSort(col) {
    setSort(s => s.col === col
      ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      : { col, dir: 'asc' }
    )
  }

  // Valores únicos para selects de filtro
  const equiposUnicos = useMemo(() => [...new Set(jugadores.map(j => j.equipo_real).filter(Boolean))].sort(), [jugadores])
  const paisesUnicos  = useMemo(() => [...new Set(jugadores.map(j => j.equipo_pais).filter(Boolean))].sort(), [jugadores])

  // Filtrado + ordenado
  const filtrados = useMemo(() => {
    let rows = jugadores.filter(j => {
      if (filtros.nombre     && !j.nombre.toLowerCase().includes(filtros.nombre.toLowerCase())) return false
      if (filtros.equipo_real && j.equipo_real !== filtros.equipo_real) return false
      if (filtros.equipo_pais && j.equipo_pais !== filtros.equipo_pais) return false
      if (filtros.posicion   && j.posicion !== filtros.posicion) return false
      if (filtros.estado     && j.estado !== filtros.estado) return false
      if (filtros.en_equipos !== '') {
        const n = Number(filtros.en_equipos)
        if (!isNaN(n) && j.en_equipos < n) return false
      }
      return true
    })

    rows = [...rows].sort((a, b) => {
      const col = sort.col
      const va  = a[col] ?? ''
      const vb  = b[col] ?? ''
      const cmp = typeof va === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'es', { sensitivity: 'base' })
      return sort.dir === 'asc' ? cmp : -cmp
    })

    return rows
  }, [jugadores, filtros, sort])

  const hayFiltros = Object.values(filtros).some(v => v !== '')

  // Edición
  function iniciarEdicion(j) {
    setEditando(j.id)
    setForm({ nombre: j.nombre_canonico || j.nombre, equipo_real: j.equipo_real || '', pais: j.equipo_pais || '', posicion: j.posicion || '', estado: j.estado || 'aprobado' })
  }

  async function guardarEdicion(id) {
    setGuardando(true)
    try {
      await api.gdtEditarJugador(id, form)
      setExito('Guardado'); setTimeout(() => setExito(null), 2000)
      setEditando(null); cargar()
    } catch (e) { setError(e.message) }
    finally { setGuardando(false) }
  }

  // Merge
  function buscarMerge(texto) {
    setMergeBusqueda(texto)
    if (texto.trim().length < 2) { setMergeCandidatos([]); return }
    const norm = texto.toLowerCase().trim()
    setMergeCandidatos(
      jugadores.filter(j => j.id !== mergeOrigen?.id &&
        (j.nombre.toLowerCase().includes(norm) || (j.equipo_real || '').toLowerCase().includes(norm))
      ).slice(0, 10)
    )
  }

  async function confirmarMerge(keepId) {
    if (!confirm(`¿Unificar "${mergeOrigen.nombre}" con el jugador seleccionado? Irreversible.`)) return
    try {
      await api.gdtMergeJugadores(keepId, mergeOrigen.id)
      setExito('Jugadores unificados'); setMergeOrigen(null); cargar()
    } catch (e) { setError(e.message) }
  }

  async function eliminar(j) {
    if (!confirm(`¿Eliminar a "${j.nombre}" (${j.equipo_real})?`)) return
    try {
      await api.gdtEliminarJugador(j.id)
      setExito(`"${j.nombre}" eliminado`); cargar()
    } catch (e) { setError(e.message) }
  }

  if (loading) return <div className="main-content"><p style={{ color: 'var(--color-muted)' }}>Cargando...</p></div>

  return (
    <div className="main-content">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>⚽ Jugadores GDT <span style={{ color: 'var(--color-muted)', fontWeight: 400, fontSize: 16 }}>({filtrados.length}/{jugadores.length})</span></h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {ligas.length > 1 && (
            <select
              value={ligaIdSeleccionado || ''}
              onChange={e => { setExito(null); setFiltros({ nombre: '', equipo_real: '', equipo_pais: '', posicion: '', estado: '', en_equipos: '' }); setLigaIdSeleccionado(e.target.value || null) }}
              style={{ background: 'var(--color-surface2)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text)', padding: '5px 10px', fontSize: 13 }}
            >
              {ligas.map(l => (
                <option key={l.id} value={l.id}>
                  {l.nombre}{l.es_default ? ' ★' : ''}
                </option>
              ))}
            </select>
          )}
          {hayFiltros && (
            <button className="btn btn-secondary btn-sm" onClick={limpiarFiltros}>✕ Limpiar filtros</button>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              const pais = prompt('¿Qué país asignar a los que no tienen?', 'Argentina')
              if (!pais) return
              try {
                const res = await api.gdtBulkPais(pais)
                setExito(`✅ ${res.actualizados} actualizados con "${pais}"`); cargar()
              } catch (e) { setError(e.message) }
            }}
          >🌍 País masivo</button>
          <button className="btn btn-secondary btn-sm" onClick={cargar}>↻</button>
        </div>
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius)', padding: '8px 12px', marginBottom: 10, color: 'var(--color-danger)' }}>{error}</div>}
      {exito && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid var(--color-success)', borderRadius: 'var(--radius)', padding: '8px 12px', marginBottom: 10, color: 'var(--color-success)' }}>{exito}</div>}

      {/* Tabla con sort + filtros inline */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            {/* Fila de encabezados (sortables) */}
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <ColHeader label="Nombre"    col="nombre"      sort={sort} onSort={toggleSort} />
              <ColHeader label="Original"  col="nombre_raw"  sort={sort} onSort={toggleSort} />
              <ColHeader label="Equipo"    col="equipo_real" sort={sort} onSort={toggleSort} />
              <ColHeader label="País/Cat." col="equipo_pais" sort={sort} onSort={toggleSort} />
              <ColHeader label="Pos."      col="posicion"    sort={sort} onSort={toggleSort} />
              <ColHeader label="Estado"    col="estado"      sort={sort} onSort={toggleSort} />
              <ColHeader label="Equipos"   col="en_equipos"  sort={sort} onSort={toggleSort} />
              <th style={thStyle}></th>
            </tr>

            {/* Fila de filtros */}
            <tr style={{ borderBottom: '2px solid var(--color-border)', background: 'var(--color-surface2)' }}>
              {/* Nombre */}
              <th style={thFilterStyle}>
                <input
                  value={filtros.nombre}
                  onChange={e => setFiltro('nombre', e.target.value)}
                  placeholder="Filtrar..."
                  style={filterInput}
                />
              </th>
              {/* Original — sin filtro */}
              <th style={thFilterStyle}></th>
              {/* Equipo */}
              <th style={thFilterStyle}>
                <select value={filtros.equipo_real} onChange={e => setFiltro('equipo_real', e.target.value)} style={filterInput}>
                  <option value="">Todos</option>
                  {equiposUnicos.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                </select>
              </th>
              {/* País */}
              <th style={thFilterStyle}>
                <select value={filtros.equipo_pais} onChange={e => setFiltro('equipo_pais', e.target.value)} style={filterInput}>
                  <option value="">Todos</option>
                  {paisesUnicos.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </th>
              {/* Posición */}
              <th style={thFilterStyle}>
                <select value={filtros.posicion} onChange={e => setFiltro('posicion', e.target.value)} style={filterInput}>
                  <option value="">Todas</option>
                  {POSICIONES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </th>
              {/* Estado */}
              <th style={thFilterStyle}>
                <select value={filtros.estado} onChange={e => setFiltro('estado', e.target.value)} style={filterInput}>
                  <option value="">Todos</option>
                  {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </th>
              {/* En equipos — filtro >= */}
              <th style={thFilterStyle}>
                <input
                  type="number"
                  min={0}
                  value={filtros.en_equipos}
                  onChange={e => setFiltro('en_equipos', e.target.value)}
                  placeholder="≥"
                  style={{ ...filterInput, width: 44, textAlign: 'center' }}
                />
              </th>
              <th style={thFilterStyle}></th>
            </tr>
          </thead>

          <tbody>
            {filtrados.map(j => {
              const enEdicion = editando === j.id
              return (
                <tr key={j.id} style={{ borderBottom: '1px solid var(--color-border)', background: enEdicion ? 'rgba(59,130,246,0.05)' : 'transparent' }}>

                  {/* Nombre */}
                  <td style={tdStyle}>
                    {enEdicion
                      ? <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} style={{ ...inputStyle, width: '100%' }} autoFocus />
                      : <span style={{ fontWeight: 500 }}>{j.nombre_canonico || j.nombre}</span>
                    }
                  </td>

                  {/* Original */}
                  <td style={{ ...tdStyle, color: 'var(--color-muted)', fontSize: 11 }}>
                    {j.nombre_raw && j.nombre_raw !== j.nombre ? j.nombre_raw : '—'}
                  </td>

                  {/* Equipo */}
                  <td style={tdStyle}>
                    {enEdicion
                      ? <input value={form.equipo_real} onChange={e => setForm(f => ({ ...f, equipo_real: e.target.value }))} style={{ ...inputStyle, width: 80 }} />
                      : j.equipo_real || '—'
                    }
                  </td>

                  {/* País */}
                  <td style={tdStyle}>
                    {enEdicion
                      ? <input value={form.pais} onChange={e => setForm(f => ({ ...f, pais: e.target.value }))} placeholder="Argentina" style={{ ...inputStyle, width: 90 }} />
                      : <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>{j.equipo_pais || '—'}</span>
                    }
                  </td>

                  {/* Posición */}
                  <td style={tdStyle}>
                    {enEdicion
                      ? <select value={form.posicion} onChange={e => setForm(f => ({ ...f, posicion: e.target.value }))} style={{ ...inputStyle, width: 70 }}>
                          <option value="">—</option>
                          {POSICIONES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      : <span style={{ color: 'var(--color-muted)' }}>{j.posicion || '—'}</span>
                    }
                  </td>

                  {/* Estado */}
                  <td style={tdStyle}>
                    {enEdicion
                      ? <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} style={{ ...inputStyle, width: 110 }}>
                          {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      : <span style={{ color: ESTADO_STYLE[j.estado]?.color, fontSize: 12 }}>
                          {ESTADO_STYLE[j.estado]?.label || j.estado}
                        </span>
                    }
                  </td>

                  {/* En equipos */}
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span
                      title={j.usuarios?.join(', ')}
                      style={{ cursor: j.en_equipos > 0 ? 'help' : 'default', color: j.en_equipos >= 4 ? 'var(--color-danger)' : j.en_equipos >= 2 ? 'var(--color-warning)' : 'var(--color-muted)' }}
                    >
                      {j.en_equipos || '—'}
                    </span>
                  </td>

                  {/* Acciones */}
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {enEdicion ? (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-sm btn-primary" onClick={() => guardarEdicion(j.id)} disabled={guardando}>
                          {guardando ? '...' : 'Guardar'}
                        </button>
                        <button className="btn btn-sm btn-secondary" onClick={() => setEditando(null)}>✕</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => iniciarEdicion(j)} title="Editar">✏️</button>
                        <button className="btn btn-sm" style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid #a78bfa', color: '#a78bfa' }} onClick={() => { setMergeOrigen(j); setMergeBusqueda(''); setMergeCandidatos([]) }} title="Unificar">🔗</button>
                        <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--color-danger)', color: 'var(--color-danger)' }} onClick={() => eliminar(j)} title="Eliminar">🗑</button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtrados.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--color-muted)' }}>
                Sin resultados. {hayFiltros && <button className="btn btn-secondary btn-sm" onClick={limpiarFiltros} style={{ marginLeft: 8 }}>Limpiar filtros</button>}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal merge */}
      {mergeOrigen && (
        <div style={overlayStyle} onClick={() => setMergeOrigen(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px 0' }}>🔗 Unificar jugador</h3>
            <p style={{ color: 'var(--color-muted)', fontSize: 13, marginBottom: 16 }}>
              Unificar <strong>{mergeOrigen.nombre}</strong> ({mergeOrigen.equipo_real}) con otro existente.
            </p>
            <input type="text" placeholder="Buscar jugador destino..." value={mergeBusqueda} onChange={e => buscarMerge(e.target.value)}
              style={{ ...inputStyle, width: '100%', marginBottom: 10 }} autoFocus />
            {mergeCandidatos.length > 0 && (
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 12 }}>
                {mergeCandidatos.map((c, i) => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: i < mergeCandidatos.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                    <span><strong>{c.nombre}</strong> <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>({c.equipo_real})</span></span>
                    <button className="btn btn-sm" style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid #a78bfa', color: '#a78bfa' }} onClick={() => confirmarMerge(c.id)}>
                      Conservar este
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setMergeOrigen(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const thStyle       = { textAlign: 'left', padding: '7px 10px', color: 'var(--color-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', transition: 'background 0.1s' }
const thFilterStyle = { padding: '4px 6px' }
const tdStyle       = { padding: '7px 10px', verticalAlign: 'middle' }
const inputStyle    = { background: 'var(--color-surface2)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text)', padding: '4px 8px', fontSize: 13 }
const filterInput   = { background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 3, color: 'var(--color-text)', padding: '3px 6px', fontSize: 11, width: '100%' }
const overlayStyle  = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }
const modalStyle    = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 24, width: '100%', maxWidth: 480 }
