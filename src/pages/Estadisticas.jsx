import { useState, useEffect } from 'react'
import { api } from '../api/index.js'
import { useAuth } from '../App.jsx'

const thS = { padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', color: 'var(--color-muted)' }
const tdS = { padding: '10px 10px', verticalAlign: 'middle' }

function BloqueStats({ g, e, p }) {
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: 1, fontSize: 12 }}>
      <span style={{ color: 'var(--color-success)' }}>{g}</span>
      <span style={{ color: 'var(--color-muted)' }}>-</span>
      <span style={{ color: 'var(--color-muted)' }}>{e}</span>
      <span style={{ color: 'var(--color-muted)' }}>-</span>
      <span style={{ color: 'var(--color-danger)' }}>{p}</span>
    </span>
  )
}

function ResultadoBadge({ r }) {
  if (!r || r === '—') return <span style={{ color: 'var(--color-muted)', fontSize: 11 }}>—</span>
  const cfg = {
    G: { bg: 'rgba(34,197,94,0.15)',  color: 'var(--color-success)', label: 'G' },
    E: { bg: 'rgba(234,179,8,0.15)',  color: 'var(--color-warning)', label: 'E' },
    P: { bg: 'rgba(239,68,68,0.15)',  color: 'var(--color-danger)',  label: 'P' },
  }[r] || {}
  return (
    <span style={{ background: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: 11, padding: '2px 7px', borderRadius: 4, display: 'inline-block' }}>
      {cfg.label}
    </span>
  )
}

function PctBadge({ pg, pj, style: extraStyle = {} }) {
  if (!pj) return null
  const pct = Math.round((pg / pj) * 100)
  const color = pct >= 60 ? 'var(--color-success)' : pct >= 40 ? 'var(--color-warning)' : 'var(--color-danger)'
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, background: pct >= 60 ? 'rgba(34,197,94,0.1)' : pct >= 40 ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.1)', padding: '2px 7px', borderRadius: 4, marginLeft: 6, ...extraStyle }}>
      {pct}%
    </span>
  )
}

function agruparPorTorneo(fechas) {
  const map = {}
  for (const f of fechas) {
    const key = f.torneo_id
    if (!map[key]) map[key] = { torneo_id: f.torneo_id, torneo_nombre: f.torneo_nombre, torneo_semestre: f.torneo_semestre, fechas: [] }
    map[key].fechas.push(f)
  }
  return Object.values(map)
}

// ─── Tab H2H ──────────────────────────────────────────────────────────────────

function TabH2H({ user }) {
  const [usuarios, setUsuarios] = useState([])
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [h2hData, setH2hData] = useState([])
  const [h2hLoading, setH2hLoading] = useState(false)
  const [expandido, setExpandido] = useState(null)

  useEffect(() => {
    api.getUsuarios().then(data => {
      setUsuarios(data)
      const uid = user?.id
      if (uid) { setSelectedUserId(uid); loadH2H(uid) }
    }).catch(console.error)
  }, [user])

  const loadH2H = async (uid) => {
    if (!uid) return
    setH2hLoading(true); setH2hData([]); setExpandido(null)
    try { setH2hData(await api.getH2HGlobal(uid)) }
    catch (err) { console.error(err) }
    finally { setH2hLoading(false) }
  }

  const handleUserChange = (uid) => { const id = parseInt(uid); setSelectedUserId(id); loadH2H(id) }

  const totales = h2hData.reduce(
    (acc, r) => ({ pj: acc.pj + r.pj, pg: acc.pg + r.pg, pe: acc.pe + r.pe, pp: acc.pp + r.pp }),
    { pj: 0, pg: 0, pe: 0, pp: 0 }
  )

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">Jugador</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>Ver estadísticas de:</span>
          <select value={selectedUserId || ''} onChange={e => handleUserChange(e.target.value)} style={{ minWidth: 200, fontSize: 14 }}>
            {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
          {!h2hLoading && h2hData.length > 0 && (
            <div style={{ display: 'flex', gap: 16, marginLeft: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13 }}><span style={{ color: 'var(--color-muted)' }}>PJ </span><strong>{totales.pj}</strong></span>
              <span style={{ fontSize: 13 }}><span style={{ color: 'var(--color-success)' }}>PG </span><strong style={{ color: 'var(--color-success)' }}>{totales.pg}</strong></span>
              <span style={{ fontSize: 13 }}><span style={{ color: 'var(--color-muted)' }}>PE </span><strong>{totales.pe}</strong></span>
              <span style={{ fontSize: 13 }}><span style={{ color: 'var(--color-danger)' }}>PP </span><strong style={{ color: 'var(--color-danger)' }}>{totales.pp}</strong></span>
              <PctBadge pg={totales.pg} pj={totales.pj} />
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">⚔️ Head to Head — Histórico</div>
        {h2hLoading && <p style={{ color: 'var(--color-muted)', textAlign: 'center', padding: 32 }}>Cargando...</p>}
        {!h2hLoading && h2hData.length === 0 && (
          <p style={{ color: 'var(--color-muted)', textAlign: 'center', padding: 32 }}>Sin enfrentamientos finalizados para este jugador.</p>
        )}
        {!h2hLoading && h2hData.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                <th style={thS}>Rival</th>
                <th style={{ ...thS, textAlign: 'center' }}>PJ</th>
                <th style={{ ...thS, textAlign: 'center', color: 'var(--color-success)' }}>PG</th>
                <th style={{ ...thS, textAlign: 'center', color: 'var(--color-muted)' }}>PE</th>
                <th style={{ ...thS, textAlign: 'center', color: 'var(--color-danger)' }}>PP</th>
                <th style={{ ...thS, textAlign: 'center', color: 'var(--color-primary)' }}>Bloque A</th>
                <th style={{ ...thS, textAlign: 'center', color: '#a78bfa' }}>Bloque B</th>
                <th style={{ ...thS, textAlign: 'center', color: 'var(--color-warning)' }}>GDT</th>
                <th style={{ ...thS, textAlign: 'center' }}>Pts</th>
                <th style={{ ...thS, textAlign: 'center', width: 28 }}></th>
              </tr>
            </thead>
            <tbody>
              {h2hData.map(r => {
                const abierto = expandido === r.rival_id
                const torneos = agruparPorTorneo(r.fechas)
                return (
                  <>
                    <tr key={r.rival_id} style={{ borderBottom: abierto ? 'none' : '1px solid var(--color-border)', background: abierto ? 'rgba(99,102,241,0.05)' : 'transparent', cursor: 'pointer' }} onClick={() => setExpandido(abierto ? null : r.rival_id)}>
                      <td style={tdS}><strong>{r.rival_nombre}</strong><PctBadge pg={r.pg} pj={r.pj} /></td>
                      <td style={{ ...tdS, textAlign: 'center' }}>{r.pj}</td>
                      <td style={{ ...tdS, textAlign: 'center', color: 'var(--color-success)', fontWeight: 700 }}>{r.pg}</td>
                      <td style={{ ...tdS, textAlign: 'center', color: 'var(--color-muted)' }}>{r.pe}</td>
                      <td style={{ ...tdS, textAlign: 'center', color: 'var(--color-danger)' }}>{r.pp}</td>
                      <td style={{ ...tdS, textAlign: 'center' }}><BloqueStats g={r.bloque_a.g} e={r.bloque_a.e} p={r.bloque_a.p} /></td>
                      <td style={{ ...tdS, textAlign: 'center' }}><BloqueStats g={r.bloque_b.g} e={r.bloque_b.e} p={r.bloque_b.p} /></td>
                      <td style={{ ...tdS, textAlign: 'center' }}><BloqueStats g={r.gdt.g} e={r.gdt.e} p={r.gdt.p} /></td>
                      <td style={{ ...tdS, textAlign: 'center', fontWeight: 700 }}>{r.pts_total}</td>
                      <td style={{ ...tdS, textAlign: 'center', color: 'var(--color-muted)', fontSize: 11 }}>{abierto ? '▲' : '▼'}</td>
                    </tr>
                    {abierto && (
                      <tr key={r.rival_id + '-det'} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td colSpan={10} style={{ padding: '0 12px 14px' }}>
                          {torneos.map(t => (
                            <div key={t.torneo_id} style={{ marginTop: 12 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-primary)', letterSpacing: '0.5px', padding: '4px 0', borderBottom: '1px solid var(--color-border)', marginBottom: 2 }}>
                                🏆 {t.torneo_nombre}{t.torneo_semestre && <span style={{ color: 'var(--color-muted)', fontWeight: 400, marginLeft: 6 }}>· {t.torneo_semestre}</span>}
                              </div>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead>
                                  <tr>
                                    <th style={{ ...thS, fontSize: 10 }}>Fecha</th>
                                    <th style={{ ...thS, textAlign: 'center', fontSize: 10 }}>Resultado</th>
                                    <th style={{ ...thS, textAlign: 'center', fontSize: 10, color: 'var(--color-primary)' }}>Bloque A</th>
                                    <th style={{ ...thS, textAlign: 'center', fontSize: 10, color: '#a78bfa' }}>Bloque B</th>
                                    <th style={{ ...thS, textAlign: 'center', fontSize: 10, color: 'var(--color-warning)' }}>GDT</th>
                                    <th style={{ ...thS, textAlign: 'center', fontSize: 10 }}>Pts int.</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {t.fechas.map((f, i) => (
                                    <tr key={i} style={{ borderTop: '1px solid var(--color-border)' }}>
                                      <td style={{ padding: '5px 8px' }}>{f.fecha_nombre}</td>
                                      <td style={{ ...tdS, textAlign: 'center', padding: '5px 8px' }}><ResultadoBadge r={f.resultado} /></td>
                                      <td style={{ ...tdS, textAlign: 'center', padding: '5px 8px' }}><ResultadoBadge r={f.bloque_a} /></td>
                                      <td style={{ ...tdS, textAlign: 'center', padding: '5px 8px' }}><ResultadoBadge r={f.bloque_b} /></td>
                                      <td style={{ ...tdS, textAlign: 'center', padding: '5px 8px' }}><ResultadoBadge r={f.gdt} /></td>
                                      <td style={{ ...tdS, textAlign: 'center', padding: '5px 8px', color: 'var(--color-muted)' }}>{f.pi_yo} — {f.pi_rival}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

// ─── Records helpers ──────────────────────────────────────────────────────────

function MiniRanking({ items, valueKey, label, renderValue, emoji }) {
  const [open, setOpen] = useState(false)
  const visible = open ? items : items.slice(0, 3)
  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="card-header" style={{ fontSize: 13 }}>{emoji} {label}</div>
      {items.length === 0
        ? <p style={{ color: 'var(--color-muted)', fontSize: 12, padding: '8px 0' }}>Sin datos.</p>
        : <>
          {visible.map((item, i) => (
            <div key={item.id ?? i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < visible.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
              <span style={{ fontSize: 13 }}>
                <span style={{ color: 'var(--color-muted)', marginRight: 8, fontSize: 11 }}>{i + 1}°</span>
                <strong>{item.nombre}</strong>
              </span>
              <span style={{ fontWeight: 700, fontSize: 13, background: 'var(--color-surface2)', padding: '2px 10px', borderRadius: 6 }}>
                {renderValue ? renderValue(item) : item[valueKey]}
              </span>
            </div>
          ))}
          {items.length > 3 && (
            <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--color-primary)', padding: '6px 0 2px', width: '100%', textAlign: 'center' }}>
              {open ? '▲ Ver menos' : '▼ Ver ' + (items.length - 3) + ' más'}
            </button>
          )}
        </>
      }
    </div>
  )
}

function TopDesafioCol({ title, color, items }) {
  const [open, setOpen] = useState(false)
  const visible = open ? items : items.slice(0, 3)
  return (
    <div style={{ flex: 1, minWidth: 200 }}>
      <div style={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', color, letterSpacing: '0.5px', marginBottom: 8, paddingBottom: 6, borderBottom: '2px solid ' + color }}>{title}</div>
      {items.length === 0
        ? <p style={{ color: 'var(--color-muted)', fontSize: 12 }}>Sin datos.</p>
        : visible.map((r, i) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 16 }}>{['🥇','🥈','🥉'][i] || (i + 1) + '°'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}</div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{r.efect}% efectividad</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>PG <span style={{ color: 'var(--color-success)' }}>{r.pg}</span></div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>PTS {r.pts}</div>
            </div>
          </div>
        ))
      }
      {items.length > 3 && (
        <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--color-primary)', padding: '6px 0 2px', width: '100%', textAlign: 'center' }}>
          {open ? '▲ Ver menos' : '▼ Ver ' + (items.length - 3) + ' más'}
        </button>
      )}
    </div>
  )
}

// ─── Tab Records ──────────────────────────────────────────────────────────────

function TabRecords() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getRecords().then(setData).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <p style={{ color: 'var(--color-muted)', textAlign: 'center', padding: 40 }}>Cargando records...</p>
  if (!data) return <p style={{ color: 'var(--color-danger)', textAlign: 'center', padding: 40 }}>Error cargando datos.</p>

  const { tabla_acumulada, top_desafio, campeones, ultimos, eficiencia, bonus_top,
          comidas_ganadas, organizadores, rachas, prom_puntos, top_cruces, rivalidades,
          asistencia, comida_mas_concurrida } = data

  const rachaEmoji = (tipo) => tipo === 'V' ? '🔥' : tipo === 'D' ? '🥶' : '😐'
  const rachaColor = (tipo) => tipo === 'V' ? 'var(--color-success)' : tipo === 'D' ? 'var(--color-danger)' : 'var(--color-muted)'
  const rachaLabel = (tipo) => tipo === 'V' ? 'victorias' : tipo === 'D' ? 'derrotas' : 'empates'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Racha actual */}
      {rachas.length > 0 && (
        <div className="card">
          <div className="card-header">🔥 Racha Actual</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {rachas.map(r => (
              <div key={r.id} style={{ background: 'var(--color-surface2)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>{rachaEmoji(r.tipo)}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{r.nombre}</div>
                  <div style={{ fontSize: 12, color: rachaColor(r.tipo), fontWeight: 600 }}>
                    {r.count} {rachaLabel(r.tipo)} {r.count >= 3 ? '🔥' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabla Acumulada General */}
      <div className="card">
        <div className="card-header">🏅 Tabla Acumulada General</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
              <th style={{ ...thS, width: 32 }}>#</th>
              <th style={thS}>Jugador</th>
              <th style={{ ...thS, textAlign: 'center' }}>P1</th>
              <th style={{ ...thS, textAlign: 'center', color: 'var(--color-warning)' }}>B</th>
              <th style={{ ...thS, textAlign: 'center', background: 'rgba(99,102,241,0.07)', color: 'var(--color-primary)' }}>P2</th>
              <th style={{ ...thS, textAlign: 'center' }}>PJ</th>
              <th style={{ ...thS, textAlign: 'center', color: 'var(--color-success)' }}>G</th>
              <th style={{ ...thS, textAlign: 'center' }}>E</th>
              <th style={{ ...thS, textAlign: 'center', color: 'var(--color-danger)' }}>P</th>
            </tr>
          </thead>
          <tbody>
            {tabla_acumulada.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)', background: i === 0 ? 'rgba(234,179,8,0.04)' : 'transparent' }}>
                <td style={{ ...tdS, color: 'var(--color-muted)', fontSize: 12 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
                <td style={tdS}><strong>{r.nombre}</strong></td>
                <td style={{ ...tdS, textAlign: 'center', color: 'var(--color-muted)' }}>{r.p1}</td>
                <td style={{ ...tdS, textAlign: 'center', color: 'var(--color-warning)', fontWeight: r.bonus > 0 ? 700 : 400 }}>{r.bonus > 0 ? '+' + r.bonus : '—'}</td>
                <td style={{ ...tdS, textAlign: 'center', fontWeight: 700, background: 'rgba(99,102,241,0.05)', color: 'var(--color-primary)', fontSize: 14 }}>{r.p2}</td>
                <td style={{ ...tdS, textAlign: 'center' }}>{r.pj}</td>
                <td style={{ ...tdS, textAlign: 'center', color: 'var(--color-success)', fontWeight: 700 }}>{r.pg}</td>
                <td style={{ ...tdS, textAlign: 'center', color: 'var(--color-muted)' }}>{r.pe}</td>
                <td style={{ ...tdS, textAlign: 'center', color: 'var(--color-danger)' }}>{r.pp}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 8, padding: '0 4px' }}>P1 = puntos base · B = bonus · P2 = total</p>
      </div>

      {/* Top por Desafío */}
      <div className="card">
        <div className="card-header">⭐ Top por Desafío</div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <TopDesafioCol title="GDT" color="var(--color-warning)" items={top_desafio.gdt} />
          <TopDesafioCol title="Bloque A" color="var(--color-primary)" items={top_desafio.bloque_a} />
          <TopDesafioCol title="Bloque B" color="#a78bfa" items={top_desafio.bloque_b} />
        </div>
      </div>

      {/* Rivalidad más disputada */}
      {rivalidades.length > 0 && (
        <div className="card">
          <div className="card-header">⚡ Rivalidades más Disputadas</div>
          {rivalidades.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < rivalidades.length - 1 ? '1px solid var(--color-border)' : 'none', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{i === 0 ? '⚡' : '🤝'}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    <span style={{ color: 'var(--color-success)' }}>{r.jugador1.nombre}</span>
                    <span style={{ color: 'var(--color-muted)', margin: '0 6px' }}>vs</span>
                    <span style={{ color: 'var(--color-primary)' }}>{r.jugador2.nombre}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{r.pj} partidos · diferencia de {r.diferencia} {r.diferencia === 0 ? '— ¡Igualados!' : ''}</div>
                </div>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, background: 'var(--color-surface2)', padding: '4px 12px', borderRadius: 6 }}>
                {r.wins1} — {r.wins2}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Récord en un solo cruce */}
      {top_cruces.length > 0 && (
        <div className="card">
          <div className="card-header">💥 Partidos más Goleados (pts internos)</div>
          {top_cruces.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < top_cruces.length - 1 ? '1px solid var(--color-border)' : 'none', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {c.jugador1.nombre} <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>{c.jugador1.pts}</span>
                  <span style={{ color: 'var(--color-muted)', margin: '0 6px' }}>—</span>
                  <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>{c.jugador2.pts}</span> {c.jugador2.nombre}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{c.fecha_nombre} · {c.torneo_nombre}{c.torneo_semestre ? ' ' + c.torneo_semestre : ''}</div>
              </div>
              <span style={{ fontWeight: 700, background: 'var(--color-surface2)', padding: '3px 10px', borderRadius: 6, fontSize: 13 }}>
                {c.total} pts totales
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Campeones + Últimos puestos */}
      {(campeones.length > 0 || ultimos.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <div className="card-header">🏆 Campeones</div>
            {campeones.map((c, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: i < campeones.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>🥇 {c.jugador.nombre}</div>
                <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{c.torneo_nombre}{c.torneo_semestre ? ' · ' + c.torneo_semestre : ''} · {c.jugador.pts} pts</div>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card-header">💀 Últimos Puestos</div>
            {ultimos.map((c, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: i < ultimos.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-danger)' }}>🪦 {c.jugador.nombre}</div>
                <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{c.torneo_nombre}{c.torneo_semestre ? ' · ' + c.torneo_semestre : ''} · {c.jugador.pts} pts</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid de mini-rankings */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <MiniRanking emoji="📈" label="Promedio Pts Internos/Fecha" items={prom_puntos}
          renderValue={r => r.promedio + ' pts'}
        />
        <MiniRanking emoji="🔥" label="Top Eficiencia" items={eficiencia.slice(0, 10)}
          renderValue={r => <span><PctBadge pg={r.pg} pj={r.pj} style={{ marginLeft: 0 }} /><span style={{ fontSize: 10, color: 'var(--color-muted)', marginLeft: 6 }}>PG {r.pg} / PE {r.pe} / PP {r.pp}</span></span>}
        />
        <MiniRanking emoji="🐢" label="Top Ineficiencia" items={[...eficiencia].reverse().slice(0, 10)}
          renderValue={r => <span><PctBadge pg={r.pg} pj={r.pj} style={{ marginLeft: 0 }} /><span style={{ fontSize: 10, color: 'var(--color-muted)', marginLeft: 6 }}>PG {r.pg} / PE {r.pe} / PP {r.pp}</span></span>}
        />
        {bonus_top.length > 0 && (
          <MiniRanking emoji="⭐" label="Coleccionista de Bonus" items={bonus_top} renderValue={r => '+' + r.bonus} />
        )}
        {asistencia.length > 0 && (
          <MiniRanking emoji="🍽️" label="Asistencia a Comidas" items={asistencia} valueKey="count" />
        )}
        {comidas_ganadas.length > 0 && (
          <MiniRanking emoji="🏅" label="Comidas Ganadas (votación)" items={comidas_ganadas} valueKey="count" />
        )}
        {organizadores.length > 0 && (
          <MiniRanking emoji="👨‍🍳" label="Organizadores de Comidas" items={organizadores} valueKey="count" />
        )}
      </div>

      {/* Comida más concurrida */}
      {comida_mas_concurrida && (
        <div className="card">
          <div className="card-header">🎉 Comida más Concurrida</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {comida_mas_concurrida.lugar || 'Sin lugar registrado'}
            <span style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 400, marginLeft: 8 }}>
              {new Date(2000, comida_mas_concurrida.mes - 1).toLocaleString('es', { month: 'long' })} {comida_mas_concurrida.anio}
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-primary)', marginTop: 4 }}>
            {comida_mas_concurrida.asistentes} asistentes
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Estadisticas() {
  const { user } = useAuth()
  const [tab, setTab] = useState('h2h')

  const tabs = [
    { key: 'h2h', label: '⚔️ H2H' },
    { key: 'records', label: '🏅 Records' },
  ]

  return (
    <div>
      <div className="flex-between mb-16">
        <div className="page-title">📊 Estadísticas Históricas</div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid var(--color-border)' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.key ? 700 : 400, color: tab === t.key ? 'var(--color-primary)' : 'var(--color-muted)', padding: '8px 16px', borderBottom: tab === t.key ? '2px solid var(--color-primary)' : '2px solid transparent', marginBottom: -2, transition: 'color 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'h2h' && <TabH2H user={user} />}
      {tab === 'records' && <TabRecords />}
    </div>
  )
}
