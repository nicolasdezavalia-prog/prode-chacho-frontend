import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/index.js'

function formatARS(importe) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(importe)
}

const TIPO_LABEL = {
  empate_pozo: 'Empate → POZO',
  deuda_rival: 'Deuda rival',
  manual: 'Manual',
}

export default function AdminDeudores() {
  const [deudores, setDeudores] = useState([])
  const [torneos, setTorneos] = useState([])
  const [torneoId, setTorneoId] = useState('')
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(null)
  const [expandidos, setExpandidos] = useState({})
  const [filtro, setFiltro] = useState('pendientes') // 'pendientes' | 'todos'
  const [error, setError] = useState('')

  useEffect(() => {
    loadTorneos()
  }, [])

  useEffect(() => {
    loadDeudores()
  }, [torneoId])

  const loadTorneos = async () => {
    try {
      const ts = await api.getTorneos()
      setTorneos(ts)
      const activo = ts.find(t => t.activo === 1) || ts[0]
      if (activo) setTorneoId(String(activo.id))
    } catch (e) { setError(e.message) }
  }

  const loadDeudores = async () => {
    setLoading(true)
    try {
      const data = await api.getDeudores(torneoId || null)
      // Ordenar: primero con deuda pendiente mayor
      const sorted = [...(data.porUsuario || [])].sort((a, b) => b.pendiente - a.pendiente)
      setDeudores(sorted)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const handleTogglePago = async (movId) => {
    setToggling(movId)
    try {
      await api.togglePagadoMovimiento(movId)
      await loadDeudores()
    } catch (e) {
      alert(e.message)
    } finally {
      setToggling(null)
    }
  }

  const handleEliminar = async (movId) => {
    if (!confirm('¿Eliminar este movimiento manual?')) return
    try {
      await api.eliminarMovimiento(movId)
      await loadDeudores()
    } catch (e) { alert(e.message) }
  }

  const toggleExpandido = (userId) => {
    setExpandidos(prev => ({ ...prev, [userId]: !prev[userId] }))
  }

  const totalPendiente = deudores.reduce((s, d) => s + d.pendiente, 0)
  const totalPagado = deudores.reduce((s, d) => s + d.pagado, 0)

  const deudoresFiltrados = filtro === 'pendientes'
    ? deudores.filter(d => d.pendiente > 0)
    : deudores

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <Link to="/" className="text-muted" style={{ fontSize: 13, textDecoration: 'none' }}>
            ← Inicio
          </Link>
          <div className="page-title" style={{ marginTop: 4 }}>📊 Cuadro de Deudores</div>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* Controles */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-muted)', marginRight: 6 }}>Torneo:</label>
            <select
              value={torneoId}
              onChange={e => setTorneoId(e.target.value)}
              style={{ fontSize: 13 }}
            >
              <option value="">Todos</option>
              {torneos.map(t => (
                <option key={t.id} value={t.id}>{t.nombre} ({t.semestre})</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[['pendientes', 'Solo con deuda'], ['todos', 'Todos']].map(([val, lbl]) => (
              <button
                key={val}
                className={`btn btn-sm ${filtro === val ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFiltro(val)}
              >
                {lbl}
              </button>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={loadDeudores}>
            🔄 Actualizar
          </button>
        </div>
      </div>

      {/* Resumen global */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Total pendiente', value: totalPendiente, color: '#b45309', bg: '#fffbeb' },
            { label: 'Total pagado', value: totalPagado, color: 'var(--color-success)', bg: '#f0fdf4' },
            { label: 'Con deuda', value: deudores.filter(d => d.pendiente > 0).length + ' jugador' + (deudores.filter(d => d.pendiente > 0).length !== 1 ? 'es' : ''), color: 'var(--color-primary)', bg: 'var(--color-surface2)', isText: true },
          ].map(({ label, value, color, bg, isText }) => (
            <div key={label} className="card" style={{ background: bg, textAlign: 'center', padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: isText ? 18 : 20, fontWeight: 800, color }}>
                {isText ? value : formatARS(value)}
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="loading">Cargando...</div>
      ) : deudoresFiltrados.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p className="text-muted">
            {filtro === 'pendientes' ? 'Nadie tiene deudas pendientes 🎉' : 'Sin movimientos registrados'}
          </p>
        </div>
      ) : (
        <div className="card">
          {deudoresFiltrados.map((d, idx) => {
            const abierto = expandidos[d.user_id]
            const itemsFiltrados = filtro === 'pendientes'
              ? d.items.filter(m => !m.pagado)
              : d.items
            return (
              <div key={d.user_id} style={{ borderBottom: idx < deudoresFiltrados.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                {/* Cabecera del usuario */}
                <div
                  onClick={() => toggleExpandido(d.user_id)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 0', cursor: 'pointer', userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{d.user_nombre}</div>
                    {d.pendiente > 0 && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                        background: '#fef9ec', color: '#b45309', border: '1px solid #fcd34d'
                      }}>
                        Debe {formatARS(d.pendiente)}
                      </span>
                    )}
                    {d.pagado > 0 && (
                      <span style={{
                        fontSize: 11, color: 'var(--color-muted)',
                      }}>
                        Pagado: {formatARS(d.pagado)}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                      {itemsFiltrados.length} mov.
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{abierto ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Detalle colapsable */}
                {abierto && (
                  <div style={{ paddingBottom: 12 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--color-surface2)', borderBottom: '1px solid var(--color-border)' }}>
                          {['Fecha', 'Concepto', 'Tipo', 'Importe', 'A quién', 'Estado', ''].map((h, i) => (
                            <th key={i} style={{
                              padding: '5px 8px', fontWeight: 600, fontSize: 11,
                              textAlign: i >= 3 ? 'center' : 'left',
                              color: 'var(--color-muted)', textTransform: 'uppercase'
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {itemsFiltrados.map(m => (
                          <tr key={m.id} style={{
                            borderBottom: '1px solid var(--color-border)',
                            background: m.pagado ? '#f0fdf4' : 'inherit',
                            opacity: m.pagado ? 0.75 : 1,
                          }}>
                            <td style={{ padding: '5px 8px', color: 'var(--color-muted)' }}>
                              {m.fecha_nombre || '—'}
                            </td>
                            <td style={{ padding: '5px 8px' }}>{m.concepto}</td>
                            <td style={{ padding: '5px 8px', color: 'var(--color-muted)', fontSize: 11 }}>
                              {TIPO_LABEL[m.tipo] || m.tipo}
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700,
                              color: m.pagado ? 'var(--color-success)' : '#b45309'
                            }}>
                              {formatARS(m.importe)}
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'center', fontSize: 11 }}>
                              {m.acreedor_nombre || <strong>POZO</strong>}
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                              {m.pagado ? (
                                <span style={{ fontSize: 11, color: 'var(--color-success)', fontWeight: 600 }}>
                                  ✓ Pagado
                                </span>
                              ) : (
                                <span style={{ fontSize: 11, color: '#b45309', fontWeight: 600 }}>
                                  Pendiente
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  style={{ fontSize: 11 }}
                                  disabled={toggling === m.id}
                                  onClick={() => handleTogglePago(m.id)}
                                >
                                  {toggling === m.id ? '...' : m.pagado ? 'Desmarcar' : '✓ Pagado'}
                                </button>
                                {m.tipo === 'manual' && (
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    style={{ fontSize: 11, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                                    onClick={() => handleEliminar(m.id)}
                                  >
                                    🗑
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
