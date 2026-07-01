/**
 * MundialFixtureImpacto — "¿Qué se juega?" landing (v2 colapsable).
 *
 * Todas las cards de partido son colapsables (default cerrado). El header
 * cerrado muestra: chip ronda, equipos con banderas, fecha, chip "+N max pts".
 * Expandido muestra los 2 escenarios completos.
 *
 * Lista de beneficiados con "Ver todos (N)" que expande.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/index.js'
import Bandera from '../components/Bandera.jsx'
import MundialIcon from '../components/MundialIcon.jsx'

const RONDA_LABEL = {
  '16vos': '16avos',
  '8vos':  '8vos',
  '4tos':  'Cuartos',
  'semis': 'Semis',
  'tercer_puesto': '3er puesto',
  'final': 'Final',
}

const RONDA_CHIP = {
  '16vos': '16AVOS',
  '8vos':  'OCTAVOS',
  '4tos':  'CUARTOS',
  'semis': 'SEMIS',
  'tercer_puesto': '3ER P.',
  'final': 'FINAL',
}

export default function MundialFixtureImpacto() {
  const { torneoId } = useParams()
  const [torneo, setTorneo]   = useState(null)
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => { load() /* eslint-disable-next-line */ }, [torneoId])

  async function load() {
    setLoading(true); setError('')
    try {
      const [torneos, d] = await Promise.all([
        api.getMundialTorneos(),
        api.getMundialFixtureImpacto(torneoId),
      ])
      const t = (torneos || []).find(x => x.id === parseInt(torneoId, 10))
      if (!t) throw new Error('Torneo no encontrado')
      setTorneo(t)
      setData(d)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const partidoDestacado = useMemo(() => {
    if (!data?.por_venir?.length) return null
    let best = data.por_venir[0]
    let bestMax = 0
    for (const p of data.por_venir) {
      const m = Math.max(p.escenarios.gana_local.delta_yo, p.escenarios.gana_visitante.delta_yo)
      if (m > bestMax) { bestMax = m; best = p }
    }
    return best
  }, [data])

  if (loading) return <div className="loading">Cargando fixture...</div>
  if (error)   return <div className="error-msg" style={{ margin: 24 }}>{error}</div>
  if (!data)   return null

  const otros = (data.por_venir || []).filter(p => p !== partidoDestacado)
  const enGrupos = data.ronda_actual === 'grupos'
  const sinRonda = !data.ronda_actual

  return (
    <div style={{ maxWidth: 720, margin: '24px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <MundialIcon width={60} height={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
            Fixture — {torneo?.nombre}
          </h1>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
            ¿Qué se juega hoy? Los próximos partidos y qué podés sumar.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Link to={`/mundial/${torneoId}/mi-mundial`} className="btn btn-secondary btn-sm">
            Mi Mundial
          </Link>
          <Link to={`/mundial/${torneoId}/ranking`} className="btn btn-secondary btn-sm">
            Ranking
          </Link>
        </div>
      </div>

      <HeroTuJornada data={data} />

      {enGrupos && (
        <div style={emptyStyle}>
          ⚽ El torneo está en fase de grupos. Esta vista se activa cuando arrancan los 16avos.
        </div>
      )}
      {sinRonda && !enGrupos && (
        <div style={emptyStyle}>
          🎉 No hay más partidos pendientes. ¡Terminó el Mundial!
        </div>
      )}

      {partidoDestacado && (
        <>
          <SeparadorFecha texto="EL MÁS CALIENTE PARA VOS" />
          <PartidoCard partido={partidoDestacado} data={data} destacado defaultAbierto={false} />
        </>
      )}
      {otros.length > 0 && (
        <>
          <SeparadorFecha texto={`OTROS ${RONDA_LABEL[data.ronda_actual] || 'PARTIDOS'} POR VENIR`} />
          {otros.map(p => <PartidoCard key={p.partido_id} partido={p} data={data} destacado={false} defaultAbierto={false} />)}
        </>
      )}

      {(data.jugados_hoy || []).length > 0 && (
        <JugadosHoy items={data.jugados_hoy} />
      )}

      <div style={{
        marginTop: 20, padding: '12px 14px',
        background: 'white', border: '1px solid var(--color-border)',
        borderRadius: 8, textAlign: 'center',
        fontSize: 11, color: 'var(--color-muted)',
      }}>
        {data.jornada.max_pts_posible > 0 ? (
          <>
            Total posible hoy: <strong style={{ color: '#059669' }}>+{data.jornada.max_pts_posible} pts</strong>
            {' · '}Podrías quedar <strong style={{ color: '#b45309' }}>#{data.jornada.posicion_optimista}</strong>
          </>
        ) : (
          <>Los puntos solo se suman. Cargá tus respuestas antes del deadline.</>
        )}
      </div>
    </div>
  )
}

// ── Componentes ─────────────────────────────────────────────────────────────

function HeroTuJornada({ data }) {
  const u = data.user_actual
  const j = data.jornada
  return (
    <div style={{
      background: 'white', border: '1px solid var(--color-border)',
      borderRadius: 12, padding: 16, marginBottom: 22,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 20,
          background: '#fbbf24', color: '#78350f',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 800,
        }}>
          {(u?.nombre || 'Y').charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: 'var(--color-muted)', letterSpacing: 1.5, fontWeight: 700 }}>
            TU JORNADA
          </div>
          <div style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 600, marginTop: 2 }}>
            Hola {u?.nombre || 'user'} · {j.partidos_por_venir} partidos por venir · {j.partidos_jugados_hoy} jugados hoy
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <HeroMetric label="HOY ESTÁS" valor={u ? `#${u.posicion}` : '—'} sub={u ? `${u.pts} pts` : ''} />
        <HeroMetric label="PODÉS SUMAR" valor={`+${j.max_pts_posible}`} sub={`${j.partidos_por_venir} partidos`} color="#059669" tint="rgba(16,185,129,0.10)" />
        <HeroMetric label="PODRÍAS QUEDAR" valor={j.posicion_optimista ? `#${j.posicion_optimista}` : '—'} sub={j.explicacion_optimista ? 'con aciertos' : ''} color="#b45309" tint="rgba(251,191,36,0.14)" />
      </div>
      {j.explicacion_optimista && (
        <div style={{
          marginTop: 12, padding: '9px 12px', background: '#fef3c7',
          borderLeft: '3px solid #fbbf24', borderRadius: 6,
          fontSize: 11, color: '#78350f', lineHeight: 1.5,
        }}>
          <strong>Ojo:</strong> otros users también suman con los mismos resultados. {j.explicacion_optimista}
        </div>
      )}
    </div>
  )
}

function HeroMetric({ label, valor, sub, color, tint }) {
  return (
    <div style={{
      background: tint || '#f1f5f9', borderRadius: 8, padding: '10px 8px',
      textAlign: 'center',
      border: color ? `1px solid ${color}55` : 'none',
    }}>
      <div style={{ fontSize: 9, color: 'var(--color-muted)', letterSpacing: 1, fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || 'var(--color-text)', lineHeight: 1, marginTop: 4 }}>
        {valor}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: 'var(--color-muted)', marginTop: 4 }}>{sub}</div>
      )}
    </div>
  )
}

function SeparadorFecha({ texto }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 12px' }}>
      <div style={{ height: 1, background: 'var(--color-border)', flex: 1 }} />
      <div style={{ fontSize: 10, color: 'var(--color-muted)', letterSpacing: 2, fontWeight: 700 }}>
        {texto}
      </div>
      <div style={{ height: 1, background: 'var(--color-border)', flex: 1 }} />
    </div>
  )
}

// Card unificada: header siempre visible + contenido colapsable.
function PartidoCard({ partido, data, destacado, defaultAbierto }) {
  const [abierto, setAbierto] = useState(!!defaultAbierto)
  const gL = partido.escenarios.gana_local
  const gV = partido.escenarios.gana_visitante
  const maxD = Math.max(gL.delta_yo, gV.delta_yo)

  return (
    <div style={{
      background: 'white',
      border: destacado ? '1px solid rgba(180,83,9,0.35)' : '1px solid var(--color-border)',
      borderRadius: 12, overflow: 'hidden', marginBottom: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* Header clickeable */}
      <div
        role="button" tabIndex={0}
        onClick={() => setAbierto(a => !a)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAbierto(a => !a) } }}
        style={{
          padding: '10px 14px', cursor: 'pointer', userSelect: 'none',
          background: destacado ? 'rgba(251,191,36,0.06)' : '#f8fafc',
          borderBottom: abierto ? '1px solid var(--color-border)' : 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 11 }}>
          <span style={{ color: '#b45309', fontWeight: 700, letterSpacing: 1 }}>
            {RONDA_CHIP[partido.ronda] || partido.ronda} · #{partido.orden}
          </span>
          <span style={{ color: 'var(--color-muted)' }}>
            {partido.fecha || 'sin fecha'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            {abierto ? '▼' : '▶'}
          </span>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            <Bandera codigo={partido.equipo_local} width={26} height={17} />
            <span style={{ fontSize: 14, fontWeight: 700, minWidth: 40 }}>{partido.equipo_local}</span>
            <span style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 700 }}>VS</span>
            <span style={{ fontSize: 14, fontWeight: 700, minWidth: 40, textAlign: 'right' }}>{partido.equipo_visitante}</span>
            <Bandera codigo={partido.equipo_visitante} width={26} height={17} />
          </div>
          <span style={{
            fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 12,
            background: maxD > 0 ? 'rgba(16,185,129,0.14)' : '#f1f5f9',
            color: maxD > 0 ? '#059669' : 'var(--color-muted)',
            whiteSpace: 'nowrap',
          }}>
            +{maxD} máx
          </span>
        </div>
      </div>

      {abierto && (
        <div style={{ padding: '14px' }}>
          <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--color-muted)', letterSpacing: 1, fontWeight: 500, marginBottom: 10 }}>
            EL QUE PIERDE ES ELIMINADO EN {RONDA_CHIP[partido.ronda]}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <EscenarioCard
              equipo={partido.equipo_local}
              equipoElim={partido.equipo_visitante}
              escenario={gL}
              userIdActual={data.user_actual?.user_id}
              ronda={partido.ronda}
            />
            <EscenarioCard
              equipo={partido.equipo_visitante}
              equipoElim={partido.equipo_local}
              escenario={gV}
              userIdActual={data.user_actual?.user_id}
              ronda={partido.ronda}
            />
          </div>
          {partido.preguntas_en_juego?.length > 0 && (
            <div style={{
              marginTop: 10, padding: '8px 10px',
              background: '#fef3c7', borderRadius: 6,
              fontSize: 11, color: '#78350f', lineHeight: 1.4,
            }}>
              <strong>Preguntas en juego:</strong> {partido.preguntas_en_juego.map(n => 'P' + n).join(', ')}.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EscenarioCard({ equipo, equipoElim, escenario, userIdActual, ronda }) {
  const [verTodos, setVerTodos] = useState(false)
  const positivo = escenario.delta_yo > 0
  const bg = positivo ? 'rgba(16,185,129,0.06)' : '#f8fafc'
  const border = positivo ? 'rgba(16,185,129,0.40)' : 'var(--color-border)'
  const color = positivo ? '#059669' : 'var(--color-muted)'
  const total = (escenario.deltas_beneficiados || []).length
  const beneficiados = verTodos
    ? (escenario.deltas_beneficiados || [])
    : (escenario.deltas_beneficiados || []).slice(0, 3)
  const restoBenef = Math.max(0, total - 3)

  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '12px 10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 10, color, letterSpacing: 1, fontWeight: 700 }}>
          SI GANA {equipo}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color }}>
          {escenario.delta_yo > 0 ? `+${escenario.delta_yo}` : '+0'}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text)', marginBottom: 8, lineHeight: 1.4 }}>
        <strong>{equipoElim}</strong> queda eliminado en {RONDA_LABEL[ronda] || ronda}
      </div>
      {beneficiados.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {beneficiados.map(b => {
            const esVos = b.user_id === userIdActual
            return (
              <span key={b.user_id} style={{
                background: esVos ? '#fef3c7' : 'rgba(16,185,129,0.14)',
                color: esVos ? '#78350f' : '#059669',
                border: esVos ? '1px solid #fbbf24' : 'none',
                fontSize: 10, padding: '2px 7px', borderRadius: 10,
                fontWeight: 700, whiteSpace: 'nowrap',
              }}>
                {esVos ? '✓ VOS' : `${b.nombre} +${b.delta_pts}`}
              </span>
            )
          })}
          {!verTodos && restoBenef > 0 && (
            <button
              type="button"
              onClick={() => setVerTodos(true)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#b45309', fontSize: 10, fontWeight: 700, padding: '2px 4px',
                textDecoration: 'underline',
              }}
            >
              +{restoBenef} más ▼
            </button>
          )}
          {verTodos && total > 3 && (
            <button
              type="button"
              onClick={() => setVerTodos(false)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--color-muted)', fontSize: 10, fontWeight: 700, padding: '2px 4px',
                textDecoration: 'underline',
              }}
            >
              ver menos ▲
            </button>
          )}
        </div>
      )}
      {!beneficiados.length && (
        <div style={{ fontSize: 10, color: 'var(--color-muted)', fontStyle: 'italic', marginBottom: 8 }}>
          Nadie sumaría en este escenario.
        </div>
      )}
      {escenario.nueva_posicion_yo != null && (
        <div style={{ fontSize: 10, color: 'var(--color-muted)', paddingTop: 6, borderTop: '1px solid var(--color-border)' }}>
          Nuevo puesto: <strong style={{ color: positivo ? '#b45309' : 'var(--color-text)' }}>#{escenario.nueva_posicion_yo}</strong>
        </div>
      )}
    </div>
  )
}

function JugadosHoy({ items }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <div style={{ marginTop: 22 }}>
      <div
        role="button" tabIndex={0}
        onClick={() => setAbierto(a => !a)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAbierto(a => !a) } }}
        style={{
          padding: '10px 14px', background: 'white', border: '1px solid var(--color-border)',
          borderRadius: 8, cursor: 'pointer', userSelect: 'none',
          display: 'flex', alignItems: 'center', gap: 10,
        }}
      >
        <span style={{ transform: abierto ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', fontSize: 11, color: 'var(--color-muted)' }}>▶</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Ya jugados hoy</div>
          <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{items.length} partido{items.length === 1 ? '' : 's'} · resultado + puntos que sumaste</div>
        </div>
      </div>
      {abierto && (
        <div style={{ marginTop: 8 }}>
          {items.map(p => (
            <div key={p.partido_id} style={{
              background: 'white', border: '1px solid var(--color-border)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 6,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 10, color: '#b45309', fontWeight: 700, letterSpacing: 1, width: 60 }}>
                {RONDA_CHIP[p.ronda]}
              </span>
              <Bandera codigo={p.equipo_local} width={22} height={14} />
              <span style={{ fontSize: 13, fontWeight: 600, minWidth: 40 }}>{p.equipo_local}</span>
              <span style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {p.goles_local ?? '-'} - {p.goles_visitante ?? '-'}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, minWidth: 40, textAlign: 'right' }}>{p.equipo_visitante}</span>
              <Bandera codigo={p.equipo_visitante} width={22} height={14} />
              {p.pts_sumaste_yo != null && (
                <span style={{
                  marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '3px 10px',
                  borderRadius: 12, whiteSpace: 'nowrap',
                  background: p.pts_sumaste_yo > 0 ? 'rgba(16,185,129,0.14)' : '#f1f5f9',
                  color: p.pts_sumaste_yo > 0 ? '#059669' : 'var(--color-muted)',
                }}>
                  {p.pts_sumaste_yo > 0 ? '+' + p.pts_sumaste_yo + ' pts' : '+0'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const emptyStyle = {
  padding: '16px 18px', textAlign: 'center',
  background: 'rgba(0,0,0,0.04)', color: 'var(--color-muted)',
  borderRadius: 8, fontSize: 14, lineHeight: 1.5,
  marginBottom: 12,
}
