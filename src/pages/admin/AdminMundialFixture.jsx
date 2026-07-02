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
import ModalPartido from '../../components/ModalPartido.jsx'

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
  // Sprint goleadores-por-partido (2026-06-25): modal de carga full.
  // Estado: el partido actualmente abierto en el modal, o null.
  const [partidoModal, setPartidoModal] = useState(null)
  // Sprint feedback: stats.tabla_grupos + KO finalizados -> equipos clasificados
  // que aun no tienen partido en la ronda siguiente ("esperando rival"). Si
  // falla la carga, queda en null y el componente degrada silenciosamente.
  const [stats, setStats] = useState(null)
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
      const [data, cat, statsRes] = await Promise.all([
        api.getMundialPartidos(torneoId),
        api.getMundialEquiposCatalogo(torneoId).catch(() => []),
        // Stats opcional: si falla no rompe el fixture editor (solo se pierde
        // la card de "Equipos esperando rival"). Por eso .catch(() => null).
        api.getMundialStatsCalculadas(torneoId).catch(() => null),
      ])
      setFilas((data.partidos || []).map(filaDesdePartido))
      setMeta(data.meta || null)
      setEquipos(Array.isArray(cat) ? cat.filter(e => e.activo !== 0) : [])
      setStats(statsRes || null)
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

      {/* Card "Equipos esperando rival" — sprint feedback. Se renderea solo
          si filtroRonda es una ronda KO (16vos..final) y hay equipos clasificados
          que aun no aparecen en partidos de esa ronda. */}
      <EquiposEsperandoRival
        ronda={filtroRonda}
        filas={filas}
        stats={stats}
        equipos={equipos}
      />

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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <CeldaEquipo equipos={equipos} valor={f.equipo_visitante} getEq={getEq}
                            onChange={c => setCampo(f.key, 'equipo_visitante', c)} />
                        </div>
                        {/* Sprint reorden-modal (2026-06-27): ⚽ inline aquí, antes de tarjetas */}
                        {f.existente && f.equipo_local && f.equipo_visitante && (
                          <button type="button" onClick={() => setPartidoModal({
                            /* Sprint A fix-modal (2026-06-27): pasar solo identidad */
                            id: f.id, ronda: f.ronda, grupo: f.grupo, orden: f.orden,
                            equipo_local: f.equipo_local, equipo_visitante: f.equipo_visitante,
                          })}
                            title="Abrir modal de carga completa (goleadores, tarjetas, estado)"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '2px 4px', flexShrink: 0 }}>
                            ⚽
                          </button>
                        )}
                      </div>
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
                      {/* Sprint reorden-modal (2026-06-27): el ⚽ se movió a la celda del visitante */}
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

      {partidoModal && (
        <ModalPartido
          torneoId={torneoId}
          partido={partidoModal}
          equiposCatalogo={equipos}
          onClose={() => setPartidoModal(null)}
          onSaved={() => load()}
        />
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

// ─────────────────────────────────────────────────────────────────────────
// EquiposEsperandoRival — sprint feedback (2026-06-25)
//
// Cuando el admin filtra por una ronda KO (16vos..final) y ve "Ningún partido
// coincide con los filtros" (porque el bracket aun no se materializo), esta
// card le muestra los EQUIPOS QUE YA ESTAN CLASIFICADOS y esperan que el
// rival se defina.
//
// Reglas por ronda:
//   - 16vos: top 1 y top 2 de cada grupo COMPLETO (6 finalizados) cuyo
//     codigo no aparece en partidos de 16vos.
//   - 8vos, 4tos, semis, final, tercer_puesto: ganadores (goles, sino penales)
//     de partidos de la ronda anterior finalizados, cuyo codigo no aparece
//     en partidos de la ronda filtrada.
//
// Sin stats, no renderea (degradacion silenciosa).
// ─────────────────────────────────────────────────────────────────────────

const RONDA_ANTERIOR_KO = {
  '8vos':           '16vos',
  '4tos':           '8vos',
  'semis':          '4tos',
  'final':          'semis',
  'tercer_puesto':  'semis',
}
// Que lado avanza desde la ronda anterior: 'final' y rondas intermedias usan
// el ganador; 'tercer_puesto' usa los PERDEDORES de semis.
const RONDA_LADO_KO = {
  '8vos':           'ganador',
  '4tos':           'ganador',
  'semis':          'ganador',
  'final':          'ganador',
  'tercer_puesto':  'perdedor',
}

// Devuelve { ganador, perdedor } o null si KO indefinido (empate sin penales,
// no finalizado, o goles null).
function resolverKOFront(p) {
  if (p.estado !== 'finalizado') return null
  const gl = p.goles_local, gv = p.goles_visitante
  if (gl == null || gv == null) return null
  if (gl > gv) return { ganador: p.equipo_local,    perdedor: p.equipo_visitante }
  if (gv > gl) return { ganador: p.equipo_visitante, perdedor: p.equipo_local    }
  const pl = p.penales_local, pv = p.penales_visitante
  if (Number.isInteger(pl) && Number.isInteger(pv) && pl !== pv) {
    return pl > pv
      ? { ganador: p.equipo_local,    perdedor: p.equipo_visitante }
      : { ganador: p.equipo_visitante, perdedor: p.equipo_local    }
  }
  return null
}

function EquiposEsperandoRival({ ronda, filas, stats, equipos }) {
  // Si no hay filtro o filtra grupos, no aplica.
  if (!ronda || ronda === 'grupos') return null

  const getEq = (codigo) => equipos.find(e => e.codigo === codigo)
  const codigosEnRonda = new Set(
    filas.filter(f => f.ronda === ronda).flatMap(f => [f.equipo_local, f.equipo_visitante]).filter(Boolean)
  )

  let clasificados = []
  let detalleContexto = ''

  if (ronda === '16vos') {
    if (!stats || !Array.isArray(stats.tabla_grupos)) return null
    const gruposCompletos = stats.tabla_grupos.filter(tg => tg.completo)
    if (gruposCompletos.length === 0) return null
    for (const tg of gruposCompletos) {
      const top2 = (tg.equipos || []).slice(0, 2)
      for (const e of top2) {
        if (codigosEnRonda.has(e.equipo_codigo)) continue
        clasificados.push({
          codigo: e.equipo_codigo,
          origen: `${e.posicion}° Grupo ${tg.grupo}`,
        })
      }
    }
    detalleContexto = `${gruposCompletos.length}/${stats.tabla_grupos.length} grupos completos`
  } else {
    // KO siguientes: ganadores de la ronda anterior finalizados
    const rondaPrev = RONDA_ANTERIOR_KO[ronda]
    if (!rondaPrev) return null
    const partidosPrev = filas.filter(f => f.ronda === rondaPrev && f.estado === 'finalizado')
    if (partidosPrev.length === 0) return null
    // tercer_puesto: perdedores de semis. Resto: ganadores.
    const lado = RONDA_LADO_KO[ronda] || 'ganador'
    for (const p of partidosPrev) {
      const r = resolverKOFront(p)
      if (!r) continue
      const codigo = r[lado]
      if (!codigo) continue
      if (codigosEnRonda.has(codigo)) continue
      const labelLado = lado === 'perdedor' ? 'Perdedor' : 'Ganador'
      clasificados.push({ codigo, origen: `${labelLado} ${rondaPrev} #${p.orden}` })
    }
    detalleContexto = `${partidosPrev.length} partidos ${rondaPrev} finalizados`
  }

  if (clasificados.length === 0) return null

  // Sort alfabetico por nombre (mas amigable para el admin).
  clasificados.sort((a, b) => {
    const na = getEq(a.codigo)?.nombre || a.codigo
    const nb = getEq(b.codigo)?.nombre || b.codigo
    return na.localeCompare(nb, 'es', { sensitivity: 'base' })
  })

  return (
    <div className="card" style={{ marginBottom: 12, padding: '12px 14px', borderColor: 'rgba(99,102,241,0.35)' }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span>⏳ Equipos esperando rival en {RONDA_LABEL[ronda] || ronda}</span>
        <span style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 400 }}>
          ({clasificados.length} esperando · {detalleContexto})
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {clasificados.map(c => {
          const eq = getEq(c.codigo)
          return (
            <span key={c.codigo} style={{
              fontSize: 12, padding: '4px 10px', borderRadius: 99,
              background: 'rgba(99,102,241,0.10)', color: 'var(--color-text)',
              border: '1px solid rgba(99,102,241,0.25)',
            }} title={c.origen}>
              {eq?.emoji ? `${eq.emoji} ` : ''}
              <strong>{eq?.nombre || c.codigo}</strong>
              <span style={{ color: 'var(--color-muted)', marginLeft: 6, fontSize: 11 }}>· {c.origen}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
