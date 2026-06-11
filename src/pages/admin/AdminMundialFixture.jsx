/**
 * AdminMundialFixture — Sprint Final C2.
 *
 * Tab "📅 Fixture" del AdminMundialHub. FUENTE DE VERDAD de partidos:
 * resultados (goles) y TARJETAS (amarillas/rojas) se cargan en la MISMA fila.
 * No existe otra carga de tarjetas: la matriz legacy queda como fallback (C4).
 *
 * Modelo de edición (decisión de robustez):
 *   - Filas EXISTENTES: (ronda, orden) quedan BLOQUEADOS — son la identidad
 *     del upsert bulk. Todo lo demás se edita inline con dirty-tracking y se
 *     guarda en un solo PUT /partidos/bulk transaccional.
 *   - Filas NUEVAS: ronda/grupo/orden editables hasta el primer guardado.
 *   - Borrar: solo partidos 'pendiente' (el backend lo refuerza con 409).
 *   - Reordenar un partido existente: fuera de scope C2 (se borra y recrea
 *     si está pendiente). Evita duplicados accidentales por upsert.
 *
 * Sin gate de estado del torneo: el fixture es independiente de la máquina.
 * No toca scoring/ranking/respuestas/canonización. Torneo SIEMPRE por prop.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api/index.js'
import EquipoAutocomplete from '../../components/EquipoAutocomplete.jsx'

const RONDA_LABEL = {
  grupos:        'Grupos',
  '16vos':       '16vos de final',
  '8vos':        'Octavos',
  '4tos':        'Cuartos',
  semis:         'Semifinales',
  tercer_puesto: '3er puesto',
  final:         'Final',
}
const ESTADOS = ['pendiente', 'en_juego', 'finalizado', 'suspendido']
const ESTADO_LABEL = { pendiente: 'Pendiente', en_juego: 'En juego', finalizado: 'Finalizado', suspendido: 'Suspendido' }
const ESTADO_COLOR = {
  pendiente:  { bg: 'rgba(0,0,0,0.05)',      fg: 'var(--color-muted)' },
  en_juego:   { bg: 'rgba(59,130,246,0.12)', fg: '#1d4ed8' },
  finalizado: { bg: 'rgba(22,163,74,0.12)',  fg: '#15803d' },
  suspendido: { bg: 'rgba(234,179,8,0.15)',  fg: '#a16207' },
}

// Campos numéricos de la fila ('' en UI ↔ null en API)
const NUMS = ['goles_local', 'goles_visitante', 'amarillas_local', 'amarillas_visitante',
  'rojas_local', 'rojas_visitante', 'penales_local', 'penales_visitante']

function aNum(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = parseInt(v, 10)
  return Number.isInteger(n) && n >= 0 ? n : null
}

function filaDesdePartido(p) {
  const f = {
    key: `id-${p.id}`, id: p.id, existente: true,
    ronda: p.ronda, grupo: p.grupo || '', orden: p.orden,
    fecha: p.fecha || '', equipo_local: p.equipo_local, equipo_visitante: p.equipo_visitante,
    estado: p.estado, observacion: p.observacion || '',
  }
  for (const c of NUMS) f[c] = (p[c] === null || p[c] === undefined) ? '' : String(p[c])
  return f
}

/**
 * modo:
 *   'full'       (default) — tab Fixture del AdminMundialHub: alta de partidos,
 *                seed desde catálogo, edición y borrado de pendientes.
 *   'resultados' — vista "Cargar resultados" (AdminResultadosHub): muestra SOLO
 *                los partidos YA cargados en el Fixture, para completar goles/
 *                tarjetas/estado. Sin alta, sin seed, sin borrar. Mismo guardado
 *                bulk (upsert sobre filas existentes — no puede crear partidos
 *                porque ronda/orden están bloqueados en filas existentes).
 */
export default function AdminMundialFixture({ torneoId, modo = 'full' }) {
  const soloResultados = modo === 'resultados'
  const [filas, setFilas]         = useState([])
  const [meta, setMeta]           = useState(null)
  const [equipos, setEquipos]     = useState([])
  const [dirty, setDirty]         = useState(new Set())   // keys con cambios
  const [filtroRonda, setFiltroRonda] = useState('')
  const [filtroGrupo, setFiltroGrupo] = useState('')
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [seeding, setSeeding]     = useState(false)
  const [error, setError]         = useState('')
  const [info, setInfo]           = useState('')
  const [nuevoSeq, setNuevoSeq]   = useState(1)
  // Ajuste UX (2026-06-11): barra de scroll horizontal SUPERIOR sincronizada
  // con la inferior — la tabla es ancha y larga, y el admin necesita llegar a
  // las columnas de tarjetas/penales sin bajar hasta el final. Solo UX:
  // cero cambios de lógica/datos.
  const topScrollRef  = useRef(null)
  const bodyScrollRef = useRef(null)
  const [anchoTabla, setAnchoTabla] = useState(0)

  useEffect(() => { load() /* eslint-disable-next-line */ }, [torneoId])

  async function load() {
    setLoading(true); setError('')
    try {
      const [data, cat] = await Promise.all([
        api.getMundialPartidos(torneoId),
        api.getMundialEquiposCatalogo(torneoId).catch(() => []),
      ])
      setFilas((data.partidos || []).map(filaDesdePartido))
      setMeta(data.meta || null)
      setEquipos(Array.isArray(cat) ? cat.filter(e => e.activo !== 0) : [])
      setDirty(new Set())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function setCampo(key, campo, valor) {
    setFilas(prev => prev.map(f => (f.key === key ? { ...f, [campo]: valor } : f)))
    setDirty(prev => new Set(prev).add(key))
    setInfo('')
  }

  function agregarFila() {
    const ronda = filtroRonda || 'grupos'
    const maxOrden = filas.filter(f => f.ronda === ronda)
      .reduce((m, f) => Math.max(m, Number(f.orden) || 0), -1)
    const key = `nuevo-${nuevoSeq}`
    setNuevoSeq(n => n + 1)
    const f = {
      key, id: null, existente: false,
      ronda, grupo: ronda === 'grupos' ? (filtroGrupo || '') : '', orden: maxOrden + 1,
      fecha: '', equipo_local: '', equipo_visitante: '',
      estado: 'pendiente', observacion: '',
    }
    for (const c of NUMS) f[c] = ''
    setFilas(prev => [...prev, f])
    setDirty(prev => new Set(prev).add(key))
  }

  function descartarNueva(key) {
    setFilas(prev => prev.filter(f => f.key !== key))
    setDirty(prev => { const s = new Set(prev); s.delete(key); return s })
  }

  // Pre-chequeos rápidos en cliente (el backend re-valida TODO igual).
  function validarFilaUX(f) {
    if (!f.equipo_local || !f.equipo_visitante) return 'falta equipo'
    if (f.equipo_local === f.equipo_visitante) return 'mismo equipo dos veces'
    if (f.ronda === 'grupos' && !String(f.grupo).trim()) return 'falta grupo'
    if (f.estado === 'finalizado' && (aNum(f.goles_local) === null || aNum(f.goles_visitante) === null)) {
      return 'finalizado sin goles'
    }
    return null
  }

  async function guardar() {
    if (saving || dirty.size === 0) return
    const aGuardar = filas.filter(f => dirty.has(f.key))
    for (const f of aGuardar) {
      const err = validarFilaUX(f)
      if (err) {
        setError(`Fila ${RONDA_LABEL[f.ronda] || f.ronda} #${f.orden} (${f.equipo_local || '?'} vs ${f.equipo_visitante || '?'}): ${err}.`)
        return
      }
    }
    setSaving(true); setError(''); setInfo('')
    try {
      const partidos = aGuardar.map(f => ({
        ronda: f.ronda,
        grupo: f.ronda === 'grupos' ? String(f.grupo).trim().toUpperCase() : undefined,
        orden: Number(f.orden),
        fecha: f.fecha || undefined,
        equipo_local: f.equipo_local,
        equipo_visitante: f.equipo_visitante,
        goles_local: aNum(f.goles_local), goles_visitante: aNum(f.goles_visitante),
        penales_local: aNum(f.penales_local), penales_visitante: aNum(f.penales_visitante),
        amarillas_local: aNum(f.amarillas_local), amarillas_visitante: aNum(f.amarillas_visitante),
        rojas_local: aNum(f.rojas_local), rojas_visitante: aNum(f.rojas_visitante),
        estado: f.estado,
        observacion: f.observacion || undefined,
      }))
      const data = await api.saveMundialPartidosBulk(torneoId, partidos)
      setFilas((data.partidos || []).map(filaDesdePartido))
      setMeta(data.meta || null)
      setDirty(new Set())
      setInfo(`${partidos.length} partido(s) guardado(s).`)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function borrar(f) {
    if (!f.existente) { descartarNueva(f.key); return }
    if (!confirm(`¿Borrar partido ${f.equipo_local} vs ${f.equipo_visitante} (${RONDA_LABEL[f.ronda]} #${f.orden})? Solo se permite si está pendiente.`)) return
    setError(''); setInfo('')
    try {
      await api.deleteMundialPartido(torneoId, f.id)
      setInfo('Partido borrado.')
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function seed() {
    if (seeding) return
    if (!confirm('Genera el fixture de FASE DE GRUPOS desde el catálogo (todos contra todos por grupo, sin goles ni fechas). Los grupos que ya tienen partidos se saltean. ¿Continuar?')) return
    setSeeding(true); setError(''); setInfo('')
    try {
      const r = await api.seedMundialPartidos2026(torneoId)
      setInfo(`Fixture generado: ${r.partidos_creados} partidos${r.grupos_salteados?.length ? ` (grupos salteados: ${r.grupos_salteados.join(', ')})` : ''}.`)
      setFilas((r.partidos || []).map(filaDesdePartido))
      setMeta(r.meta || null)
      setDirty(new Set())
    } catch (e) {
      setError(e.message)
    } finally {
      setSeeding(false)
    }
  }

  const rondasPresentes = useMemo(() => [...new Set(filas.map(f => f.ronda))], [filas])
  const gruposPresentes = useMemo(
    () => [...new Set(filas.filter(f => f.grupo).map(f => f.grupo))].sort(),
    [filas]
  )
  const visibles = filas.filter(f =>
    (!filtroRonda || f.ronda === filtroRonda) &&
    (!filtroGrupo || f.grupo === filtroGrupo)
  )
  const hayPartidosGrupos = filas.some(f => f.ronda === 'grupos' && f.existente)
  const getEq = (codigo) => equipos.find(e => e.codigo === codigo)

  // Medir el ancho real de la tabla para que la barra superior tenga el mismo
  // recorrido que la inferior. Se re-mide cuando cambia lo visible.
  useEffect(() => {
    const el = bodyScrollRef.current
    if (el) setAnchoTabla(el.scrollWidth)
  }, [visibles.length, filtroRonda, filtroGrupo, loading])

  function syncDesdeTop() {
    if (topScrollRef.current && bodyScrollRef.current) {
      bodyScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft
    }
  }
  function syncDesdeBody() {
    if (topScrollRef.current && bodyScrollRef.current) {
      topScrollRef.current.scrollLeft = bodyScrollRef.current.scrollLeft
    }
  }

  if (loading) return <div className="loading">Cargando fixture...</div>

  return (
    <div>
      {/* Header: meta + acciones */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>
          <strong>{meta?.total ?? 0}</strong> partidos · <strong>{meta?.finalizados ?? 0}</strong> finalizados ·
          fuente de tarjetas: <strong>{meta?.fuente_tarjetas === 'fixture' ? '📅 fixture' : 'matriz (legacy)'}</strong>
        </span>
        <span style={{ flex: 1 }} />
        {!hayPartidosGrupos && !soloResultados && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={seed} disabled={seeding}>
            {seeding ? 'Generando...' : '⚙️ Generar fixture de grupos'}
          </button>
        )}
        {!soloResultados && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={agregarFila}>
            ➕ Agregar partido
          </button>
        )}
        <button
          type="button" className="btn btn-primary btn-sm"
          onClick={guardar} disabled={saving || dirty.size === 0}
          title={dirty.size === 0 ? 'Sin cambios pendientes' : `Guarda ${dirty.size} fila(s) en una transacción`}
        >
          {saving ? 'Guardando...' : `💾 Guardar cambios${dirty.size > 0 ? ` (${dirty.size})` : ''}`}
        </button>
      </div>

      <div style={{
        fontSize: 12, color: 'var(--color-muted)', marginBottom: 10, lineHeight: 1.45,
        padding: '8px 12px', background: 'rgba(99,102,241,0.05)', borderRadius: 6,
      }}>
        🟨🟥 <strong>Las tarjetas se cargan acá</strong>, en la misma fila del partido. Solo los partidos
        <strong> finalizados</strong> cuentan para datos útiles y sugerencias. Tarjetas vacías = sin cargar
        (distinto de 0 = no hubo). El fixture nunca toca el ranking: los puntos se mueven solo al guardar
        resultados en el tab Resultados, con preview.
      </div>

      {error && <div className="error-msg" style={{ marginBottom: 10 }}>{error}</div>}
      {info && (
        <div style={{ padding: '8px 12px', background: 'rgba(22,163,74,0.10)', color: 'var(--color-success)', borderRadius: 6, marginBottom: 10, fontSize: 13 }}>
          {info}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <select value={filtroRonda} onChange={e => setFiltroRonda(e.target.value)} style={selectFiltro}>
          <option value="">Todas las rondas</option>
          {(meta?.rondas || rondasPresentes).map(r => (
            <option key={r} value={r}>{RONDA_LABEL[r] || r}</option>
          ))}
        </select>
        <select value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)} style={selectFiltro}>
          <option value="">Todos los grupos</option>
          {gruposPresentes.map(g => <option key={g} value={g}>Grupo {g}</option>)}
        </select>
        {(filtroRonda || filtroGrupo) && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setFiltroRonda(''); setFiltroGrupo('') }}>
            Limpiar filtros
          </button>
        )}
        <span style={{ fontSize: 12, color: 'var(--color-muted)', alignSelf: 'center' }}>
          {visibles.length} de {filas.length} partidos
        </span>
      </div>

      {visibles.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 14 }}>
          {filas.length === 0
            ? (soloResultados
              ? 'Sin partidos cargados en el Fixture. Cargalos primero desde Admin → Mundial → 📅 Fixture.'
              : 'Sin partidos cargados. Generá el fixture de grupos desde el catálogo o agregá partidos a mano.')
            : 'Ningún partido coincide con los filtros.'}
        </div>
      ) : (
        <>
          {/* Barra de scroll horizontal SUPERIOR (sincronizada con la tabla):
              permite moverse a tarjetas/penales sin bajar al final. */}
          <div
            ref={topScrollRef}
            onScroll={syncDesdeTop}
            style={{ overflowX: 'auto', overflowY: 'hidden', marginBottom: 4, height: 14 }}
            title="Scroll horizontal de la tabla"
          >
            <div style={{ width: anchoTabla || '100%', height: 1 }} />
          </div>
          <div
            ref={bodyScrollRef}
            onScroll={syncDesdeBody}
            style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 8, background: 'white' }}
          >
          <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: 1080, width: '100%' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.03)', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={th}>Ronda</th>
                <th style={th}>Gr.</th>
                <th style={th}>#</th>
                <th style={th}>Fecha</th>
                <th style={{ ...th, minWidth: 170 }}>Local</th>
                <th style={th} title="Goles local">GL</th>
                <th style={th} title="Goles visitante">GV</th>
                <th style={{ ...th, minWidth: 170 }}>Visitante</th>
                <th style={th} title="Amarillas local">🟨L</th>
                <th style={th} title="Amarillas visitante">🟨V</th>
                <th style={th} title="Rojas local">🟥L</th>
                <th style={th} title="Rojas visitante">🟥V</th>
                <th style={th} title="Penales (solo eliminación directa)">Pen.</th>
                <th style={th}>Estado</th>
                <th style={{ ...th, minWidth: 120 }}>Obs.</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(f => {
                const esKO = f.ronda !== 'grupos'
                const sucia = dirty.has(f.key)
                const ec = ESTADO_COLOR[f.estado] || ESTADO_COLOR.pendiente
                const uxErr = sucia ? validarFilaUX(f) : null
                return (
                  <tr key={f.key} style={{
                    borderTop: '1px solid var(--color-border)',
                    background: uxErr ? 'rgba(220,38,38,0.05)' : sucia ? 'rgba(234,179,8,0.06)' : undefined,
                  }}>
                    {/* Identidad del upsert: bloqueada en filas existentes */}
                    <td style={td}>
                      {f.existente ? (
                        <span title="La ronda identifica la fila — no se edita">{RONDA_LABEL[f.ronda] || f.ronda}</span>
                      ) : (
                        <select value={f.ronda} onChange={e => setCampo(f.key, 'ronda', e.target.value)} style={inputMini}>
                          {(meta?.rondas || Object.keys(RONDA_LABEL)).map(r => (
                            <option key={r} value={r}>{RONDA_LABEL[r] || r}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td style={td}>
                      {f.ronda !== 'grupos' ? '—' : f.existente ? f.grupo : (
                        <input type="text" maxLength={2} value={f.grupo}
                          onChange={e => setCampo(f.key, 'grupo', e.target.value.toUpperCase())}
                          style={{ ...inputMini, width: 34, textAlign: 'center' }} placeholder="A" />
                      )}
                    </td>
                    <td style={td}>
                      {f.existente ? f.orden : (
                        <input type="number" min="0" value={f.orden}
                          onChange={e => setCampo(f.key, 'orden', e.target.value)}
                          style={{ ...inputMini, width: 52 }} />
                      )}
                    </td>
                    <td style={td}>
                      <input type="text" value={f.fecha} placeholder="opcional"
                        onChange={e => setCampo(f.key, 'fecha', e.target.value)}
                        style={{ ...inputMini, width: 86 }} />
                    </td>
                    <td style={td}>
                      <CeldaEquipo equipos={equipos} valor={f.equipo_local} getEq={getEq}
                        onChange={c => setCampo(f.key, 'equipo_local', c)} />
                    </td>
                    <CeldaNum f={f} campo="goles_local" setCampo={setCampo} destacada />
                    <CeldaNum f={f} campo="goles_visitante" setCampo={setCampo} destacada />
                    <td style={td}>
                      <CeldaEquipo equipos={equipos} valor={f.equipo_visitante} getEq={getEq}
                        onChange={c => setCampo(f.key, 'equipo_visitante', c)} />
                    </td>
                    <CeldaNum f={f} campo="amarillas_local" setCampo={setCampo} />
                    <CeldaNum f={f} campo="amarillas_visitante" setCampo={setCampo} />
                    <CeldaNum f={f} campo="rojas_local" setCampo={setCampo} />
                    <CeldaNum f={f} campo="rojas_visitante" setCampo={setCampo} />
                    <td style={td}>
                      {esKO ? (
                        <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
                          <input type="number" min="0" value={f.penales_local} placeholder="–"
                            onChange={e => setCampo(f.key, 'penales_local', e.target.value)}
                            style={{ ...inputMini, width: 36, textAlign: 'center' }} />
                          <span style={{ color: 'var(--color-muted)' }}>:</span>
                          <input type="number" min="0" value={f.penales_visitante} placeholder="–"
                            onChange={e => setCampo(f.key, 'penales_visitante', e.target.value)}
                            style={{ ...inputMini, width: 36, textAlign: 'center' }} />
                        </span>
                      ) : <span style={{ color: 'var(--color-muted)' }}>—</span>}
                    </td>
                    <td style={td}>
                      <select value={f.estado} onChange={e => setCampo(f.key, 'estado', e.target.value)}
                        style={{ ...inputMini, background: ec.bg, color: ec.fg, fontWeight: 600, border: '1px solid transparent', borderRadius: 99, padding: '3px 8px' }}>
                        {ESTADOS.map(s => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}
                      </select>
                    </td>
                    <td style={td}>
                      <input type="text" value={f.observacion} placeholder="—"
                        onChange={e => setCampo(f.key, 'observacion', e.target.value)}
                        style={{ ...inputMini, width: 110 }} />
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {uxErr && <span title={uxErr} style={{ marginRight: 4 }}>⚠️</span>}
                      {(f.estado === 'pendiente' || !f.existente) && !soloResultados && (
                        <button type="button" onClick={() => borrar(f)}
                          title={f.existente ? 'Borrar partido pendiente' : 'Descartar fila nueva'}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-muted)' }}>
                          🗑
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  )
}

// ── celdas auxiliares ───────────────────────────────────────────────────────

function CeldaNum({ f, campo, setCampo, destacada }) {
  return (
    <td style={td}>
      <input
        type="number" min="0" step="1"
        value={f[campo]}
        placeholder="–"
        onChange={e => setCampo(f.key, campo, e.target.value)}
        style={{
          ...inputMini, width: 40, textAlign: 'center',
          fontWeight: destacada ? 700 : 400,
          background: destacada ? 'rgba(59,130,246,0.05)' : undefined,
        }}
      />
    </td>
  )
}

/** Selector de equipo: muestra emoji+código compacto; abre autocomplete al editar. */
function CeldaEquipo({ equipos, valor, onChange, getEq }) {
  const [editando, setEditando] = useState(!valor)
  const eq = getEq(valor)
  if (!editando && valor) {
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        title={`${eq?.nombre || valor} — click para cambiar`}
        style={{
          background: 'none', border: '1px solid transparent', cursor: 'pointer',
          fontSize: 12, padding: '3px 4px', borderRadius: 4, width: '100%', textAlign: 'left',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}
      >
        {eq?.emoji ? `${eq.emoji} ` : ''}{eq?.nombre || valor}
      </button>
    )
  }
  return (
    <EquipoAutocomplete
      equipos={equipos}
      valor={valor}
      onChange={c => { onChange(c); setEditando(false) }}
    />
  )
}

const th = {
  padding: '6px 6px', textAlign: 'left', fontSize: 10, fontWeight: 700,
  color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em',
  whiteSpace: 'nowrap', background: 'var(--color-surface2, #f5f6f8)',
}
const td = { padding: '4px 6px', verticalAlign: 'middle' }
const inputMini = {
  padding: '4px 6px', fontSize: 12, border: '1px solid var(--color-border)',
  borderRadius: 4, background: 'white', outline: 'none',
}
const selectFiltro = {
  padding: '6px 10px', fontSize: 13, border: '1px solid var(--color-border)',
  borderRadius: 6, background: 'white',
}
