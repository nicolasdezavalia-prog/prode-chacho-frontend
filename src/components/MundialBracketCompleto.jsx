/**
 * MundialBracketCompleto — vista bracket FIFA con grupos al costado.
 *
 * Layout:
 *   Desktop: 3 columnas (Grupos A-F | Bracket | Grupos G-L)
 *   Mobile: stack vertical (Grupos | Bracket)
 *
 * Bracket: 5 columnas con todas las rondas KO. Cuando un partido futuro no
 * existe todavía (ronda anterior sin finalizar), se muestran placeholders
 * "Ganador R32-1 vs Ganador R32-2" desde la cascada local. Para R32 sin
 * partidos generados, slots "1°A vs 2°B" del bracket oficial.
 */

import { useMemo } from 'react'
import {
  CASCADA_KO, RONDAS_BRACKET, RONDA_LABEL,
  R32_BRACKET, labelSlotR32, labelSlotKO,
} from '../data/mundial-cascada-ko.js'

export default function MundialBracketCompleto({ tablaGrupos = [], partidos = [], catalogo = {} }) {
  const porRondaOrden = useMemo(() => {
    const m = new Map()
    for (const p of partidos) {
      if (p.ronda === 'grupos') continue
      m.set(p.ronda + ':' + p.orden, p)
    }
    return m
  }, [partidos])

  function partidoOPlaceholder(ronda, orden) {
    const p = porRondaOrden.get(ronda + ':' + orden)
    if (p) {
      return {
        local: equipoLabel(p.equipo_local, catalogo),
        visitante: equipoLabel(p.equipo_visitante, catalogo),
        goles_local: p.goles_local, goles_visitante: p.goles_visitante,
        estado: p.estado,
        ganador_codigo: ganadorCodigo(p),
      }
    }
    if (ronda === '16vos') {
      const cruce = R32_BRACKET.find(r => r.orden === orden)
      if (!cruce) return null
      return {
        local:     { label: labelSlotR32(cruce.local),     placeholder: true },
        visitante: { label: labelSlotR32(cruce.visitante), placeholder: true },
      }
    }
    const casc = CASCADA_KO.find(c => c.ronda === ronda && c.orden === orden)
    if (!casc) return null
    return {
      local: { label: labelSlotKO(casc.local), placeholder: true },
      visitante: { label: labelSlotKO(casc.visitante), placeholder: true },
    }
  }

  const partidosPorRonda = useMemo(() => {
    const por = {}
    for (const ronda of RONDAS_BRACKET) {
      const cuantos = ronda === '16vos' ? 16 : ronda === '8vos' ? 8 : ronda === '4tos' ? 4 : ronda === 'semis' ? 2 : 1
      por[ronda] = Array.from({ length: cuantos }, (_, i) => ({
        orden: i + 1,
        ...partidoOPlaceholder(ronda, i + 1),
      }))
    }
    return por
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [porRondaOrden, catalogo])

  const gruposIzq = tablaGrupos.filter(g => ['A','B','C','D','E','F'].includes(g.grupo))
  const gruposDer = tablaGrupos.filter(g => ['G','H','I','J','K','L'].includes(g.grupo))

  return (
    <div className="card" style={{ padding: 14, overflowX: 'auto' }}>
      <div className="mundial-bracket-grid">
        <div className="mundial-bracket-grupos">
          {gruposIzq.map(g => <GrupoCard key={g.grupo} grupo={g} />)}
        </div>
        <div className="mundial-bracket-centro">
          <BracketColumna ronda="16vos" partidos={partidosPorRonda['16vos']} />
          <BracketColumna ronda="8vos"  partidos={partidosPorRonda['8vos']}  />
          <BracketColumna ronda="4tos"  partidos={partidosPorRonda['4tos']}  />
          <BracketColumna ronda="semis" partidos={partidosPorRonda['semis']} />
          <BracketColumnaFinal
            final={partidosPorRonda['final'][0]}
            tercerPuesto={partidosPorRonda['tercer_puesto'][0]}
          />
        </div>
        <div className="mundial-bracket-grupos">
          {gruposDer.map(g => <GrupoCard key={g.grupo} grupo={g} />)}
        </div>
      </div>
      <style>{`
        .mundial-bracket-grid { display: grid; grid-template-columns: 180px 1fr 180px; gap: 12px; align-items: start; }
        .mundial-bracket-grupos { display: flex; flex-direction: column; gap: 8px; }
        .mundial-bracket-centro { display: grid; grid-template-columns: repeat(5, minmax(120px, 1fr)); gap: 8px; min-width: 0; }
        @media (max-width: 900px) {
          .mundial-bracket-grid { grid-template-columns: 1fr; }
          .mundial-bracket-grupos { flex-direction: row; flex-wrap: wrap; }
          .mundial-bracket-grupos > * { flex: 1 1 140px; min-width: 140px; }
          .mundial-bracket-centro { grid-template-columns: 1fr; gap: 12px; }
        }
      `}</style>
    </div>
  )
}

function GrupoCard({ grupo }) {
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, background: 'white', overflow: 'hidden' }}>
      <div style={{ padding: '4px 8px', background: 'rgba(0,0,0,0.04)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted)', letterSpacing: '0.04em' }}>
        Grupo {grupo.grupo}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {grupo.equipos.map(e => (
          <div key={e.equipo_codigo} style={{
            padding: '4px 8px', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 6,
            borderTop: '1px solid rgba(0,0,0,0.05)',
            opacity: e.eliminado_en === 'grupos' ? 0.55 : 1,
          }}>
            <span style={{ width: 14, textAlign: 'right', color: 'var(--color-muted)', fontSize: 10 }}>{e.posicion || ''}</span>
            <span>{e.emoji || ''}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {e.nombre || e.equipo_codigo}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BracketColumna({ ronda, partidos }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', marginBottom: 4 }}>
        {RONDA_LABEL[ronda]}
      </div>
      {partidos.map((p, i) => (
        <PartidoCard key={ronda + '-' + i} ronda={ronda} orden={p.orden} partido={p} />
      ))}
    </div>
  )
}

function BracketColumnaFinal({ final, tercerPuesto }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', marginBottom: 4 }}>Final</div>
        <PartidoCard ronda="final" orden={1} partido={final} destacado />
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', marginBottom: 4 }}>3er puesto</div>
        <PartidoCard ronda="tercer_puesto" orden={1} partido={tercerPuesto} />
      </div>
    </div>
  )
}

function PartidoCard({ ronda, orden, partido, destacado = false }) {
  if (!partido) return null
  const ganL = partido.ganador_codigo && partido.local?.codigo === partido.ganador_codigo
  const ganV = partido.ganador_codigo && partido.visitante?.codigo === partido.ganador_codigo
  const finalizado = partido.estado === 'finalizado'
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, background: destacado ? 'rgba(124,58,237,0.05)' : 'white', padding: 4, fontSize: 11 }}>
      <div style={{ fontSize: 9, color: 'var(--color-muted)', textAlign: 'center', marginBottom: 2 }}>
        {labelPartidoCorto(ronda, orden)}
      </div>
      <LinkEquipo lado={partido.local}     gan={ganL} finalizado={finalizado} goles={partido.goles_local} />
      <LinkEquipo lado={partido.visitante} gan={ganV} finalizado={finalizado} goles={partido.goles_visitante} />
    </div>
  )
}

function LinkEquipo({ lado, gan, finalizado, goles }) {
  if (!lado) return null
  const esPlaceholder = !!lado.placeholder
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '2px 4px', borderRadius: 4,
      background: gan ? 'rgba(22,163,74,0.10)' : 'transparent',
      opacity: (finalizado && !gan) || esPlaceholder ? 0.6 : 1,
      fontWeight: gan ? 700 : 500,
      fontStyle: esPlaceholder ? 'italic' : undefined,
      color: esPlaceholder ? 'var(--color-muted)' : undefined,
    }}>
      <span>{lado.emoji || ''}</span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {lado.label || lado.nombre || lado.codigo || '—'}
      </span>
      {finalizado && goles != null && (
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{goles}</span>
      )}
    </div>
  )
}

function equipoLabel(codigo, catalogo) {
  if (!codigo) return { label: '—' }
  const c = catalogo[codigo]
  if (!c) return { label: codigo, codigo }
  return { codigo, nombre: c.nombre, emoji: c.emoji, label: (c.emoji ? c.emoji + ' ' : '') + c.nombre }
}

function ganadorCodigo(p) {
  if (p.estado !== 'finalizado') return null
  const gl = Number(p.goles_local), gv = Number(p.goles_visitante)
  if (gl > gv) return p.equipo_local
  if (gv > gl) return p.equipo_visitante
  const pl = Number(p.penales_local), pv = Number(p.penales_visitante)
  if (pl > pv) return p.equipo_local
  if (pv > pl) return p.equipo_visitante
  return null
}

function labelPartidoCorto(ronda, orden) {
  if (ronda === '16vos') return 'R32-' + orden
  if (ronda === '8vos')  return '8vos-' + orden
  if (ronda === '4tos')  return 'QF-' + orden
  if (ronda === 'semis') return 'SF-' + orden
  if (ronda === 'final') return 'Final'
  if (ronda === 'tercer_puesto') return '3er P.'
  return ronda
}
