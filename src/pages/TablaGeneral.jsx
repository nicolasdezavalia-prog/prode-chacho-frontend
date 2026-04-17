import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/index.js'
import { useAuth } from '../App.jsx'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

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
  if (r === '—') return <span style={{ color: 'var(--color-muted)' }}>—</span>
  const cfg = {
    G: { bg: 'rgba(34,197,94,0.15)',  color: 'var(--color-success)', label: 'G' },
    E: { bg: 'rgba(234,179,8,0.15)',  color: 'var(--color-warning)', label: 'E' },
    P: { bg: 'rgba(239,68,68,0.15)',  color: 'var(--color-danger)',  label: 'P' },
  }[r] || {}
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      fontWeight: 700, fontSize: 11,
      padding: '2px 7px', borderRadius: 4,
    }}>{cfg.label}</span>
  )
}

export default function TablaGeneral() {
  const { torneoId } = useParams()
  const { user } = useAuth()
  const [tabla, setTabla] = useState([])
  const [tablaMensual, setTablaMensual] = useState([])
  const [torneo, setTorneo] = useState(null)
  const [vista, setVista] = useState('general')
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth() + 1)
  const [anioSeleccionado, setAnioSeleccionado] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [recalculando, setRecalculando] = useState(false)
  const [h2hUserId, setH2hUserId] = useState(null)
  const [h2hData, setH2hData] = useState([])
  const [h2hLoading, setH2hLoading] = useState(false)
  const [h2hExpandido, setH2hExpandido] = useState(null)

  useEffect(() => {
    loadData()
  }, [torneoId])

  useEffect(() => {
    if (vista === 'mensual') loadMensual()
  }, [vista, mesSeleccionado, anioSeleccionado])

  const loadData = async () => {
    try {
      const [t, tb] = await Promise.all([
        api.getTorneo(torneoId),
        api.getTablaGeneral(torneoId)
      ])
      setTorneo(t)
      setTabla(tb)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadH2H = async (uid) => {
    if (!uid) return
    setH2hLoading(true)
    setH2hExpandido(null)
    try {
      const data = await api.getH2H(torneoId, uid)
      setH2hData(data)
    } catch (err) { console.error(err) }
    finally { setH2hLoading(false) }
  }

  const handleH2hUser = (uid) => {
    setH2hUserId(uid)
    loadH2H(uid)
  }

  const handleRecalcular = async () => {
    setRecalculando(true)
    try {
      await api.recalcularTabla(torneoId)
      await loadData()
      if (vista === 'mensual') await loadMensual()
    } catch (err) {
      console.error(err)
    } finally {
      setRecalculando(false)
    }
  }

  const loadMensual = async () => {
    try {
      const tm = await api.getTablaMensual(torneoId, mesSeleccionado, anioSeleccionado)
      setTablaMensual(tm)
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) return <div className="loading">Cargando tabla...</div>

  const renderTabla = (data, esMensual = false) => (
    <table className="liga-table" style={{width: '100%'}}>
      <thead>
        <tr>
          <th style={{width: 36}}>#</th>
          <th>Jugador</th>
          <th>PJ</th>
          <th>V</th>
          <th>E</th>
          <th>D</th>
          {!esMensual && <th title="Victorias perfectas">Bonus</th>}
          <th>Pts</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => {
          const esYo = row.user_id === user.id
          const esUltimo = i === data.length - 1 && esMensual
          const esTop4 = i < 4 && esMensual
          const clsRow = esMensual
            ? esUltimo ? 'highlight-last' : esTop4 ? 'highlight-top' : ''
            : esYo ? 'highlight-top' : ''

          return (
            <tr key={row.user_id} className={clsRow}>
              <td className="pos">
                {esMensual && i === 0 && <span style={{marginRight: 4}}>🍖</span>}
                {esMensual && i === data.length - 1 && data.length > 1 && <span style={{marginRight: 4}}>💸</span>}
                {i + 1}
              </td>
              <td style={{fontWeight: esYo ? 700 : 400}}>
                {row.nombre}
              </td>
              <td>{row.pj}</td>
              <td className="text-success">{row.victorias}</td>
              <td className="text-muted">{row.empates}</td>
              <td className="text-danger">{row.derrotas}</td>
              {!esMensual && <td style={{color: 'var(--color-warning)'}}>{row.bonus || 0}</td>}
              <td className="pts">{row.puntos}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <Link to="/" className="text-muted" style={{fontSize: 13, textDecoration: 'none'}}>
            ← Inicio
          </Link>
          <div className="page-title" style={{marginTop: 4}}>{torneo?.nombre}</div>
        </div>
        {user?.role === 'admin' && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleRecalcular}
            disabled={recalculando}
            title="Recalcula la tabla desde cero si hay puntos incorrectos"
            style={{ fontSize: 12 }}
          >
            {recalculando ? '⏳ Recalculando...' : '🔄 Recalcular tabla'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{display: 'flex', gap: 8, marginBottom: 16}}>
        <button
          className={`btn ${vista === 'general' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setVista('general')}
        >
          📊 Tabla General
        </button>
        <button
          className={`btn ${vista === 'mensual' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setVista('mensual'); loadMensual() }}
        >
          🍖 Tabla Mensual
        </button>
        <button
          className={`btn ${vista === 'h2h' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setVista('h2h')
            if (!h2hUserId && torneo?.jugadores?.length) {
              const uid = torneo.jugadores[0].id
              setH2hUserId(uid)
              loadH2H(uid)
            }
          }}
        >
          ⚔️ H2H
        </button>
      </div>

      {vista === 'general' && (
        <div className="card">
          <div className="card-header">
            Tabla General del Semestre
            <span className="text-muted" style={{fontSize: 12}}>
              {torneo?.semestre}
            </span>
          </div>
          {tabla.length === 0
            ? <p className="text-muted" style={{textAlign: 'center', padding: 24}}>Sin partidos jugados aún</p>
            : renderTabla(tabla, false)
          }
        </div>
      )}

      {vista === 'h2h' && (
        <div>
          {/* Selector de jugador */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">⚔️ Head to Head</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
              <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>Ver estadísticas de:</span>
              <select
                value={h2hUserId || ''}
                onChange={e => handleH2hUser(parseInt(e.target.value))}
                style={{ minWidth: 180 }}
              >
                {(torneo?.jugadores || []).map(j => (
                  <option key={j.id} value={j.id}>{j.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {h2hLoading && <p style={{ color: 'var(--color-muted)', textAlign: 'center', padding: 24 }}>Cargando...</p>}

          {!h2hLoading && h2hData.length === 0 && (
            <p style={{ color: 'var(--color-muted)', textAlign: 'center', padding: 24 }}>Sin enfrentamientos registrados</p>
          )}

          {!h2hLoading && h2hData.length > 0 && (
            <div className="card">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                    <th style={thS}>Rival</th>
                    <th style={{ ...thS, textAlign: 'center' }}>PJ</th>
                    <th style={{ ...thS, textAlign: 'center', color: 'var(--color-success)' }}>PG</th>
                    <th style={{ ...thS, textAlign: 'center', color: 'var(--color-muted)' }}>PE</th>
                    <th style={{ ...thS, textAlign: 'center', color: 'var(--color-danger)' }}>PP</th>
                    <th style={{ ...thS, textAlign: 'center', color: 'var(--color-primary)' }}>Liga Arg.</th>
                    <th style={{ ...thS, textAlign: 'center', color: '#a78bfa' }}>Juanmar</th>
                    <th style={{ ...thS, textAlign: 'center', color: 'var(--color-warning)' }}>GDT</th>
                    <th style={{ ...thS, textAlign: 'center' }}>Pts</th>
                    <th style={{ ...thS, textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {h2hData.map(r => (
                    <>
                      <tr
                        key={r.rival_id}
                        style={{
                          borderBottom: h2hExpandido === r.rival_id ? 'none' : '1px solid var(--color-border)',
                          background: h2hExpandido === r.rival_id ? 'rgba(99,102,241,0.05)' : 'transparent',
                          cursor: 'pointer',
                        }}
                        onClick={() => setH2hExpandido(h2hExpandido === r.rival_id ? null : r.rival_id)}
                      >
                        <td style={tdS}><strong>{r.rival_nombre}</strong></td>
                        <td style={{ ...tdS, textAlign: 'center' }}>{r.pj}</td>
                        <td style={{ ...tdS, textAlign: 'center', color: 'var(--color-success)', fontWeight: 700 }}>{r.pg}</td>
                        <td style={{ ...tdS, textAlign: 'center', color: 'var(--color-muted)' }}>{r.pe}</td>
                        <td style={{ ...tdS, textAlign: 'center', color: 'var(--color-danger)' }}>{r.pp}</td>
                        <td style={{ ...tdS, textAlign: 'center' }}><BloqueStats g={r.bloque_a.g} e={r.bloque_a.e} p={r.bloque_a.p} /></td>
                        <td style={{ ...tdS, textAlign: 'center' }}><BloqueStats g={r.bloque_b.g} e={r.bloque_b.e} p={r.bloque_b.p} /></td>
                        <td style={{ ...tdS, textAlign: 'center' }}><BloqueStats g={r.gdt.g} e={r.gdt.e} p={r.gdt.p} /></td>
                        <td style={{ ...tdS, textAlign: 'center', fontWeight: 700 }}>{r.pts_torneo}</td>
                        <td style={{ ...tdS, textAlign: 'center', color: 'var(--color-muted)', fontSize: 11 }}>
                          {h2hExpandido === r.rival_id ? '▲' : '▼'}
                        </td>
                      </tr>

                      {/* Detalle fecha a fecha */}
                      {h2hExpandido === r.rival_id && (
                        <tr key={`${r.rival_id}-det`} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td colSpan={10} style={{ padding: '0 12px 12px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 4 }}>
                              <thead>
                                <tr style={{ color: 'var(--color-muted)' }}>
                                  <th style={{ ...thS, fontSize: 11 }}>Fecha</th>
                                  <th style={{ ...thS, textAlign: 'center', fontSize: 11 }}>Resultado</th>
                                  <th style={{ ...thS, textAlign: 'center', fontSize: 11, color: 'var(--color-primary)' }}>Liga Arg.</th>
                                  <th style={{ ...thS, textAlign: 'center', fontSize: 11, color: '#a78bfa' }}>Juanmar</th>
                                  <th style={{ ...thS, textAlign: 'center', fontSize: 11, color: 'var(--color-warning)' }}>GDT</th>
                                  <th style={{ ...thS, textAlign: 'center', fontSize: 11 }}>Pts int.</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.fechas.map((f, i) => (
                                  <tr key={i} style={{ borderTop: '1px solid var(--color-border)' }}>
                                    <td style={{ padding: '5px 8px' }}>{f.fecha_nombre}</td>
                                    <td style={{ ...tdS, textAlign: 'center' }}><ResultadoBadge r={f.resultado} /></td>
                                    <td style={{ ...tdS, textAlign: 'center' }}><ResultadoBadge r={f.bloque_a} /></td>
                                    <td style={{ ...tdS, textAlign: 'center' }}><ResultadoBadge r={f.bloque_b} /></td>
                                    <td style={{ ...tdS, textAlign: 'center' }}><ResultadoBadge r={f.gdt} /></td>
                                    <td style={{ ...tdS, textAlign: 'center', color: 'var(--color-muted)' }}>
                                      {f.pi_yo} — {f.pi_rival}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {vista === 'mensual' && (
        <div className="card">
          <div className="card-header">
            <div>
              Tabla Mensual
              <div style={{fontSize: 11, color: 'var(--color-muted)', marginTop: 2}}>
                🍖 Último paga la comida · 🥇 Top 4 comen gratis
              </div>
            </div>
            <div style={{display: 'flex', gap: 8}}>
              <select
                value={mesSeleccionado}
                onChange={e => setMesSeleccionado(parseInt(e.target.value))}
                style={{width: 130}}
              >
                {MESES.map((m, i) => (
                  <option key={i+1} value={i+1}>{m}</option>
                ))}
              </select>
              <select
                value={anioSeleccionado}
                onChange={e => setAnioSeleccionado(parseInt(e.target.value))}
                style={{width: 80}}
              >
                {[2024, 2025, 2026].map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>
          {tablaMensual.length === 0
            ? <p className="text-muted" style={{textAlign: 'center', padding: 24}}>
                Sin partidos en {MESES[mesSeleccionado-1]} {anioSeleccionado}
              </p>
            : renderTabla(tablaMensual, true)
          }
        </div>
      )}
    </div>
  )
}
