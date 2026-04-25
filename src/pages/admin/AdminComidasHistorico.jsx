import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../../api/index.js'

const MESES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const DEFAULT_ITEMS = ['Comida', 'Precio/Calidad', 'Servicio', 'Ambiente']

export default function AdminComidasHistorico() {
  const { torneoId } = useParams()

  const [torneo,    setTorneo]    = useState(null)
  const [historico, setHistorico] = useState([])
  const [itemNames, setItemNames] = useState(DEFAULT_ITEMS)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [expandido, setExpandido] = useState(new Set())   // Set de comida_ids expandidos

  useEffect(() => {
    Promise.all([
      api.getTorneo(parseInt(torneoId)),
      api.getComidasHistorico(parseInt(torneoId)),
      api.getComidaVotacionConfig(parseInt(torneoId)),
    ])
      .then(([t, h, cfg]) => {
        setTorneo(t)
        setHistorico(h)
        if (Array.isArray(cfg?.items) && cfg.items.length > 0) {
          setItemNames(cfg.items.map(i => i.nombre))
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [torneoId])

  const toggleExpandir = (comidaId) => {
    setExpandido(prev => {
      const next = new Set(prev)
      if (next.has(comidaId)) next.delete(comidaId)
      else next.add(comidaId)
      return next
    })
  }

  if (loading) return <div className="loading">Cargando...</div>

  const torneoCerrado = torneo && !torneo.activo
  const colCount = 4 + 1 + itemNames.length + 1  // mes+lugar+org+vot + resultado + items + expand

  const thStyle = {
    padding: '7px 10px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--color-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '2px solid var(--color-border)',
    background: 'var(--color-surface2)',
    whiteSpace: 'nowrap',
  }

  const tdStyle = {
    padding: '9px 10px',
    borderBottom: '1px solid var(--color-border)',
    fontSize: 13,
    verticalAlign: 'middle',
  }

  const tdNum = {
    ...tdStyle,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  }

  const thNum = { ...thStyle, textAlign: 'right' }

  return (
    <div style={{ maxWidth: '100%' }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 16, display: 'flex', gap: 6, alignItems: 'center' }}>
        <Link to="/admin/comidas" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>Comidas</Link>
        <span>›</span>
        <span>{torneo?.nombre || `Torneo ${torneoId}`}</span>
        <span>›</span>
        <span>Histórico</span>
      </div>

      <div className="flex-between mb-16">
        <div className="page-title">📋 Histórico de comidas</div>
      </div>

      {torneo && (
        <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 16 }}>
          Torneo: <strong>{torneo.nombre}</strong> · {torneo.semestre}
          {torneo.activo ? (
            <span style={{ marginLeft: 10, fontSize: 11, color: 'var(--color-muted)', fontWeight: 600 }}>
              (torneo abierto — resultados ocultos)
            </span>
          ) : (
            <span style={{ marginLeft: 10, fontSize: 11, color: 'var(--color-success)', fontWeight: 600 }}>
              (torneo cerrado — resultados visibles)
            </span>
          )}
        </div>
      )}

      {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
          <thead>
            <tr>
              <th style={thStyle}></th>
              <th style={thStyle}>Mes</th>
              <th style={thStyle}>Lugar</th>
              <th style={thStyle}>Organizador</th>
              <th style={thStyle}>Votación</th>
              <th style={thNum}>Resultado</th>
              {itemNames.map(nombre => (
                <th key={nombre} style={thNum}>{nombre}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {historico.length === 0 && (
              <tr>
                <td colSpan={colCount} style={{ padding: '20px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>
                  No hay comidas registradas para este torneo.
                </td>
              </tr>
            )}

            {historico.map(c => {
              const abierto = expandido.has(c.comida_id)
              const puedeExpandir = torneoCerrado && c.votos?.length > 0

              // Mapa de promedios por ítem para esta comida
              const promedioMap = {}
              ;(c.items || []).forEach(i => { promedioMap[i.item] = i.promedio })

              return [
                /* ——— Fila principal ——— */
                <tr
                  key={`row-${c.comida_id}`}
                  style={{
                    background: abierto ? 'rgba(59,130,246,0.04)' : 'white',
                    cursor: puedeExpandir ? 'pointer' : 'default',
                  }}
                  onClick={() => puedeExpandir && toggleExpandir(c.comida_id)}
                >
                  {/* Toggle */}
                  <td style={{ ...tdStyle, width: 32, textAlign: 'center', color: 'var(--color-muted)', fontSize: 11 }}>
                    {puedeExpandir ? (abierto ? '▲' : '▼') : ''}
                  </td>

                  {/* Mes */}
                  <td style={tdStyle}>
                    <strong>{MESES[c.mes]}</strong>
                    <span style={{ color: 'var(--color-muted)', marginLeft: 4, fontSize: 12 }}>{c.anio}</span>
                  </td>

                  {/* Lugar */}
                  <td style={tdStyle}>
                    {c.lugar || <span style={{ color: 'var(--color-muted)' }}>—</span>}
                  </td>

                  {/* Organizador */}
                  <td style={tdStyle}>
                    {c.organizador || <span style={{ color: 'var(--color-muted)' }}>—</span>}
                  </td>

                  {/* Estado votación */}
                  <td style={tdStyle}>
                    {c.votacion_estado === 'cerrada'
                      ? <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-danger)' }}>🔒 Cerrada</span>
                      : <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-success)' }}>🟢 Abierta</span>
                    }
                  </td>

                  {/* Resultado total */}
                  <td style={tdNum}>
                    {c.puntuacion_total === null
                      ? <span style={{ color: 'var(--color-muted)', fontStyle: 'italic', fontSize: 12 }}>🔒 Oculto</span>
                      : <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-primary)' }}>{c.puntuacion_total}</span>
                    }
                  </td>

                  {/* Promedio por ítem */}
                  {itemNames.map(nombre => (
                    <td key={nombre} style={tdNum}>
                      {c.puntuacion_total === null
                        ? <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>—</span>
                        : <span style={{ color: 'var(--color-text)' }}>
                            {promedioMap[nombre] != null ? promedioMap[nombre] : '—'}
                          </span>
                      }
                    </td>
                  ))}
                </tr>,

                /* ——— Filas de detalle: una por votante, alineadas a columnas principales ——— */
                ...(abierto && puedeExpandir ? c.votos.map((v, i) => {
                  const isLast = i === c.votos.length - 1
                  const detailBorder = isLast
                    ? '2px solid var(--color-border)'
                    : '1px solid rgba(0,0,0,0.06)'
                  const detailTd = {
                    ...tdStyle,
                    background: 'rgba(59,130,246,0.03)',
                    borderBottom: detailBorder,
                    fontSize: 12,
                  }
                  const detailTdNum = {
                    ...tdNum,
                    background: 'rgba(59,130,246,0.03)',
                    borderBottom: detailBorder,
                    fontSize: 12,
                  }
                  return (
                    <tr key={`detail-${c.comida_id}-${i}`}>
                      {/* ↳ Nombre votante */}
                      <td style={{ ...detailTd, paddingLeft: 20 }}>
                        <span style={{ color: 'var(--color-muted)', marginRight: 5, fontWeight: 400 }}>↳</span>
                        <span style={{ fontWeight: 500 }}>{v.votante}</span>
                      </td>
                      {/* Mes — vacío */}
                      <td style={detailTd} />
                      {/* Lugar — vacío */}
                      <td style={detailTd} />
                      {/* Organizador — vacío */}
                      <td style={detailTd} />
                      {/* Votación — vacío */}
                      <td style={detailTd} />
                      {/* Resultado individual */}
                      <td style={{ ...detailTdNum, fontWeight: 700, color: 'var(--color-primary)' }}>
                        {v.resultado_total ?? '—'}
                      </td>
                      {/* Puntajes por ítem */}
                      {itemNames.map(nombre => {
                        const vItem = v.items?.find(vi => vi.item === nombre)
                        return (
                          <td key={nombre} style={detailTdNum}>
                            {vItem?.puntaje != null ? vItem.puntaje : '—'}
                          </td>
                        )
                      })}
                    </tr>
                  )
                }) : []),
              ]
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16 }}>
        <Link to="/admin/comidas" className="btn btn-secondary" style={{ fontSize: 13 }}>
          Volver
        </Link>
      </div>
    </div>
  )
}
