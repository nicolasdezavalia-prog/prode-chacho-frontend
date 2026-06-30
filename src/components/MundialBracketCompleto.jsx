/**
 * MundialBracketCompleto — vista bracket FIFA con grupos al costado.
 *
 * Rediseño visual estilo FIFA oficial:
 *   - Fondo dark navy con gradiente sutil.
 *   - Header "WORLD CHAMPIONS" arriba en dorado.
 *   - Grupos con barra de color identitario lateral.
 *   - Bracket KO con slots oscuros, ganador resaltado verde menta.
 *   - Copa al centro (CopaMundial SVG inline) y "BRONZE WINNER" abajo.
 *   - Banderas reales desde flagcdn.com via <Bandera> con fallback a emoji.
 *
 * Layout:
 *   Desktop: 3 columnas (Grupos A-F | Bracket simétrico | Grupos G-L)
 *   Mobile (<900px): stack vertical (Grupos grid 2-col, Bracket con scroll horizontal)
 *
 * Bracket simétrico:
 *   R32-i | 8-i | QF-i | SF-i |  COPA  | SF-d | QF-d | 8-d | R32-d
 *   El orden vertical de cada columna se calcula a partir de CASCADA_KO
 *   (no es 1..N, sino el orden visual que respeta los cruces).
 *
 * Placeholders: si un partido futuro no existe todavía se muestra "Ganador
 * R32-3" / "1°A vs 2°B" en cursiva gris.
 */

import { useMemo } from 'react'
import {
  CASCADA_KO, RONDA_LABEL,
  R32_BRACKET, labelSlotR32, labelSlotKO,
} from '../data/mundial-cascada-ko.js'
import CopaMundial from './CopaMundial.jsx'
import Bandera from './Bandera.jsx'

// Paleta FIFA-style oscura.
const C = {
  bg:        '#0a1628',
  bgGrad:    '#142847',
  panel:     '#0f1f3a',
  border:    '#1e3a5f',
  borderHi:  '#3b82f6',
  text:      '#e2e8f0',
  muted:     '#7d8ba6',
  gold:      '#fbbf24',
  bronze:    '#cd7f32',
  win:       '#10b981',
  winBg:     'rgba(16,185,129,0.15)',
}

// Color identitario por grupo (paleta 12 tonos balanceada).
const COLOR_GRUPO = {
  A: '#ef4444', B: '#f97316', C: '#eab308', D: '#84cc16',
  E: '#22c55e', F: '#14b8a6', G: '#06b6d4', H: '#3b82f6',
  I: '#6366f1', J: '#a855f7', K: '#ec4899', L: '#f43f5e',
}

const RONDAS_BRACKET_LOCAL = ['16vos', '8vos', '4tos', 'semis', 'tercer_puesto', 'final']

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
    // Fix ganador-parcial (2026-06-27): si el partido fuente ya esta finalizado,
    // mostramos el ganador real (con bandera) en lugar del placeholder generico.
    // Cubre el caso "Paraguay gano R32-3 pero R32-6 sigue pendiente -> 8vos-1
    // existe conceptualmente pero el backend no lo creo todavia".
    return {
      local:     resolverSlotKO(casc.local,     porRondaOrden, catalogo),
      visitante: resolverSlotKO(casc.visitante, porRondaOrden, catalogo),
    }
  }

  const partidosPorRonda = useMemo(() => {
    const por = {}
    for (const ronda of RONDAS_BRACKET_LOCAL) {
      const cuantos = ronda === '16vos' ? 16 : ronda === '8vos' ? 8 : ronda === '4tos' ? 4 : ronda === 'semis' ? 2 : 1
      por[ronda] = Array.from({ length: cuantos }, (_, i) => ({
        orden: i + 1,
        ...partidoOPlaceholder(ronda, i + 1),
      }))
    }
    return por
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [porRondaOrden, catalogo])

  // Reordenamiento visual del bracket: usamos CASCADA_KO para que cada
  // columna se muestre arriba→abajo en el orden simétrico clásico.
  const ordenVisual = useMemo(() => {
    const expandirR32 = (ronda, orden) => {
      if (ronda === '16vos') return [orden]
      const casc = CASCADA_KO.find(c => c.ronda === ronda && c.orden === orden)
      if (!casc) return [orden]
      return [
        ...expandirR32(casc.local.from, casc.local.orden),
        ...expandirR32(casc.visitante.from, casc.visitante.orden),
      ]
    }
    const r32Izq = expandirR32('semis', 1)
    const r32Der = expandirR32('semis', 2)
    const buscarOctavoPara = r32orden => {
      const c = CASCADA_KO.find(x => x.ronda === '8vos' &&
        ((x.local.from === '16vos' && x.local.orden === r32orden) ||
         (x.visitante.from === '16vos' && x.visitante.orden === r32orden)))
      return c ? c.orden : null
    }
    const buscarCuartoPara = ottoOrden => {
      const c = CASCADA_KO.find(x => x.ronda === '4tos' &&
        ((x.local.from === '8vos' && x.local.orden === ottoOrden) ||
         (x.visitante.from === '8vos' && x.visitante.orden === ottoOrden)))
      return c ? c.orden : null
    }
    const dedup = arr => Array.from(new Set(arr))
    const ottoIzq = dedup(r32Izq.map(buscarOctavoPara).filter(Boolean))
    const ottoDer = dedup(r32Der.map(buscarOctavoPara).filter(Boolean))
    const qfIzq   = dedup(ottoIzq.map(buscarCuartoPara).filter(Boolean))
    const qfDer   = dedup(ottoDer.map(buscarCuartoPara).filter(Boolean))
    return { r32Izq, r32Der, ottoIzq, ottoDer, qfIzq, qfDer }
  }, [])

  function porOrden(ronda, ordenes) {
    return ordenes.map(o => partidosPorRonda[ronda].find(p => p.orden === o)).filter(Boolean)
  }

  const gruposIzq = tablaGrupos.filter(g => ['A','B','C','D','E','F'].includes(g.grupo))
  const gruposDer = tablaGrupos.filter(g => ['G','H','I','J','K','L'].includes(g.grupo))

  const finalP = partidosPorRonda['final'][0]
  const campeon = (() => {
    if (!finalP || !finalP.ganador_codigo) return null
    return finalP.local?.codigo === finalP.ganador_codigo ? finalP.local : finalP.visitante
  })()

  return (
    <div className="mbc-root">
      <div className="mbc-headline">
        <div className="mbc-headline-line" />
        <div className="mbc-headline-text">WORLD CHAMPIONS 2026</div>
        <div className="mbc-headline-line" />
      </div>

      <div className="mbc-scroll">
        <div className="mbc-grid">
          <div className="mbc-grupos">
            {gruposIzq.map(g => <GrupoCard key={g.grupo} grupo={g} />)}
          </div>

          <div className="mbc-centro">
            <BracketColumna ronda="16vos" partidos={porOrden('16vos', ordenVisual.r32Izq)} />
            <BracketColumna ronda="8vos"  partidos={porOrden('8vos',  ordenVisual.ottoIzq)} />
            <BracketColumna ronda="4tos"  partidos={porOrden('4tos',  ordenVisual.qfIzq)} />
            <BracketColumna ronda="semis" partidos={porOrden('semis', [1])} />

            <ColumnaCentralFinal final={finalP} campeon={campeon} />

            <BracketColumna ronda="semis" partidos={porOrden('semis', [2])} />
            <BracketColumna ronda="4tos"  partidos={porOrden('4tos',  ordenVisual.qfDer)} />
            <BracketColumna ronda="8vos"  partidos={porOrden('8vos',  ordenVisual.ottoDer)} />
            <BracketColumna ronda="16vos" partidos={porOrden('16vos', ordenVisual.r32Der)} />
          </div>

          <div className="mbc-grupos">
            {gruposDer.map(g => <GrupoCard key={g.grupo} grupo={g} />)}
          </div>
        </div>
      </div>

      <div className="mbc-tercer-wrap">
        <div className="mbc-tercer-titulo">
          <span className="mbc-tercer-badge">BRONZE WINNER · 3er PUESTO</span>
        </div>
        <div className="mbc-tercer-card">
          <PartidoCard ronda="tercer_puesto" orden={1} partido={partidosPorRonda['tercer_puesto'][0]} variant="bronze" />
        </div>
      </div>

      <style>{`
        .mbc-root {
          background: radial-gradient(ellipse at top, ${C.bgGrad} 0%, ${C.bg} 55%, #050d1c 100%);
          border-radius: 14px;
          padding: 20px 14px 24px;
          color: ${C.text};
          font-family: inherit;
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.04);
        }
        .mbc-root::before {
          content: '';
          position: absolute; inset: 0;
          background: repeating-linear-gradient(135deg, rgba(255,255,255,0.012) 0 2px, transparent 2px 12px);
          pointer-events: none;
        }
        .mbc-headline {
          display: flex; align-items: center; gap: 14px;
          margin-bottom: 18px;
          position: relative; z-index: 1;
        }
        .mbc-headline-line {
          flex: 1; height: 1px;
          background: linear-gradient(90deg, transparent, ${C.gold}aa, transparent);
        }
        .mbc-headline-text {
          font-size: clamp(14px, 2.2vw, 22px);
          font-weight: 900;
          letter-spacing: 0.28em;
          color: ${C.gold};
          text-shadow: 0 0 18px rgba(251,191,36,0.35);
          padding: 0 6px;
          text-transform: uppercase;
        }
        .mbc-scroll { overflow-x: auto; overflow-y: hidden; position: relative; z-index: 1; }
        .mbc-grid {
          display: grid;
          grid-template-columns: 168px 1fr 168px;
          gap: 14px; align-items: start;
          /* FIX layout-bracket (2026-06-27): las 9 cols del centro requieren
             ~1020px minimo. Con grupos 168*2 + gap 28, el grid necesita
             >=1380px para no colapsar y dejar los grupos derechos
             intercalados con el bracket. */
          min-width: 1400px;
        }
        .mbc-grupos { display: flex; flex-direction: column; gap: 6px; }
        .mbc-centro {
          display: grid;
          grid-template-columns: minmax(108px,1fr) minmax(108px,1fr) minmax(104px,1fr) minmax(104px,1fr) minmax(160px,1.5fr) minmax(104px,1fr) minmax(104px,1fr) minmax(108px,1fr) minmax(108px,1fr);
          gap: 6px; min-width: 0; align-items: stretch;
        }
        .mbc-grupo {
          background: ${C.panel};
          border: 1px solid ${C.border};
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 6px rgba(0,0,0,0.25);
        }
        .mbc-grupo-hdr {
          display: flex; align-items: center; gap: 6px;
          padding: 5px 8px;
          font-size: 11px; font-weight: 800; letter-spacing: 0.12em;
          color: #fff;
          text-transform: uppercase;
        }
        .mbc-grupo-dot {
          width: 10px; height: 10px; border-radius: 50%;
          box-shadow: 0 0 6px currentColor;
        }
        .mbc-grupo-row {
          display: flex; align-items: center; gap: 6px;
          padding: 4px 8px;
          font-size: 11.5px;
          border-top: 1px solid rgba(255,255,255,0.04);
          color: ${C.text};
        }
        .mbc-grupo-row.eliminado { opacity: 0.42; text-decoration: line-through; }
        .mbc-grupo-pos {
          width: 14px; text-align: right;
          color: ${C.muted}; font-size: 10px; font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .mbc-grupo-nombre {
          flex: 1; min-width: 0;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .mbc-col { display: flex; flex-direction: column; min-width: 0; }
        .mbc-col-hdr {
          font-size: 9.5px; font-weight: 800;
          color: ${C.muted}; text-transform: uppercase; letter-spacing: 0.18em;
          text-align: center;
          padding-bottom: 4px;
          border-bottom: 1px solid ${C.border};
          margin-bottom: 4px;
        }
        .mbc-col-list {
          display: flex; flex-direction: column;
          gap: 6px; flex: 1;
          justify-content: space-around;
        }
        .mbc-match {
          background: linear-gradient(180deg, ${C.panel} 0%, #0a1830 100%);
          border: 1px solid ${C.border};
          border-radius: 6px;
          padding: 4px 0 5px;
          font-size: 11px;
          position: relative;
          transition: border-color 120ms, transform 120ms;
        }
        .mbc-match:hover { border-color: ${C.borderHi}; }
        .mbc-match.destacado {
          background: linear-gradient(180deg, #1a2f5e 0%, #0a1830 100%);
          border-color: ${C.gold};
          box-shadow: 0 0 14px rgba(251,191,36,0.25);
        }
        .mbc-match.bronze {
          background: linear-gradient(180deg, #2a1810 0%, #0a1830 100%);
          border-color: ${C.bronze};
          box-shadow: 0 0 12px rgba(205,127,50,0.20);
        }
        .mbc-match-tag {
          font-size: 8.5px; color: ${C.muted}; text-align: center;
          letter-spacing: 0.10em; padding: 1px 4px 3px;
          font-weight: 700;
        }
        .mbc-match-tag.bronze { color: ${C.bronze}; }
        .mbc-match-tag.gold  { color: ${C.gold}; }
        .mbc-team {
          display: flex; align-items: center; gap: 5px;
          padding: 4px 7px;
          border-top: 1px solid rgba(255,255,255,0.05);
          color: ${C.text};
          font-weight: 600;
        }
        .mbc-team.placeholder { color: ${C.muted}; font-style: italic; font-weight: 400; }
        .mbc-team.loser       { color: ${C.muted}; opacity: 0.55; }
        .mbc-team.winner {
          background: ${C.winBg};
          color: ${C.win};
          font-weight: 800;
          box-shadow: inset 3px 0 0 ${C.win};
        }
        .mbc-team-emoji { font-size: 13px; line-height: 1; }
        .mbc-team-name {
          flex: 1; min-width: 0;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .mbc-team-goles {
          font-variant-numeric: tabular-nums;
          font-weight: 800;
          color: inherit;
          min-width: 14px; text-align: right;
        }
        .mbc-copa-col {
          display: flex; flex-direction: column;
          align-items: stretch;
          gap: 10px;
          padding: 0 4px;
          justify-content: center;
        }
        .mbc-copa-icon {
          display: flex; justify-content: center; align-items: center;
          padding: 6px 0;
          filter: drop-shadow(0 0 20px rgba(251,191,36,0.45));
        }
        .mbc-final-label {
          text-align: center;
          font-size: 10px; font-weight: 800;
          letter-spacing: 0.22em;
          color: ${C.gold};
          text-transform: uppercase;
        }
        .mbc-campeon {
          text-align: center;
          padding: 6px 8px;
          background: linear-gradient(180deg, rgba(251,191,36,0.18), rgba(180,83,9,0.05));
          border: 1px solid ${C.gold};
          border-radius: 6px;
          color: ${C.gold};
          font-weight: 900;
          font-size: 13px;
          letter-spacing: 0.04em;
          box-shadow: 0 0 18px rgba(251,191,36,0.30);
        }
        .mbc-tercer-wrap {
          margin-top: 18px;
          display: flex; flex-direction: column; align-items: center;
          gap: 6px;
          position: relative; z-index: 1;
        }
        .mbc-tercer-titulo { display: flex; align-items: center; gap: 10px; }
        .mbc-tercer-badge {
          font-size: 11px; font-weight: 900;
          color: ${C.bronze};
          letter-spacing: 0.22em;
          text-transform: uppercase;
          text-shadow: 0 0 10px rgba(205,127,50,0.45);
        }
        .mbc-tercer-card { width: 280px; max-width: 92%; }
        @media (max-width: 900px) {
          .mbc-root { padding: 14px 8px 18px; }
          .mbc-grid {
            grid-template-columns: 1fr;
            min-width: 0;
            gap: 10px;
          }
          .mbc-grupos {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
          }
          .mbc-centro {
            grid-template-columns: repeat(9, 130px);
            overflow-x: auto;
            gap: 5px;
            padding-bottom: 6px;
          }
          .mbc-headline-text { letter-spacing: 0.15em; }
        }
      `}</style>
    </div>
  )
}

function GrupoCard({ grupo }) {
  const color = COLOR_GRUPO[grupo.grupo] || '#64748b'
  return (
    <div className="mbc-grupo" style={{ borderTop: '2px solid ' + color }}>
      <div className="mbc-grupo-hdr" style={{
        background: 'linear-gradient(90deg, ' + color + '33, transparent)',
      }}>
        <span className="mbc-grupo-dot" style={{ background: color, color }} />
        <span>Grupo {grupo.grupo}</span>
      </div>
      <div>
        {grupo.equipos.map(e => (
          <div
            key={e.equipo_codigo}
            className={'mbc-grupo-row' + (e.eliminado_en === 'grupos' ? ' eliminado' : '')}
          >
            <span className="mbc-grupo-pos">{e.posicion || ''}</span>
            <Bandera codigo={e.equipo_codigo} emoji={e.emoji} width={18} height={12} />
            <span className="mbc-grupo-nombre">{e.nombre || e.equipo_codigo}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BracketColumna({ ronda, partidos }) {
  return (
    <div className="mbc-col">
      <div className="mbc-col-hdr">{RONDA_LABEL[ronda] || ronda}</div>
      <div className="mbc-col-list">
        {partidos.map((p, i) => (
          <PartidoCard
            key={ronda + '-' + (p?.orden ?? i)}
            ronda={ronda}
            orden={p?.orden}
            partido={p}
          />
        ))}
      </div>
    </div>
  )
}

function ColumnaCentralFinal({ final, campeon }) {
  return (
    <div className="mbc-copa-col">
      <div className="mbc-final-label">FINAL</div>
      <PartidoCard ronda="final" orden={1} partido={final} variant="gold" />
      <div className="mbc-copa-icon">
        <CopaMundial size={110} />
      </div>
      {campeon ? (
        <div className="mbc-campeon">
          <div style={{ fontSize: 9, letterSpacing: '0.2em', opacity: 0.9, marginBottom: 2 }}>CAMPEÓN</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            <Bandera codigo={campeon.codigo} emoji={campeon.emoji} width={22} height={14} />
            <span>{campeon.nombre || campeon.codigo}</span>
          </div>
        </div>
      ) : (
        <div className="mbc-campeon" style={{ opacity: 0.55, borderStyle: 'dashed' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.2em', marginBottom: 2 }}>CAMPEÓN</div>
          <div style={{ fontStyle: 'italic', fontSize: 11 }}>Por definir</div>
        </div>
      )}
    </div>
  )
}

function PartidoCard({ ronda, orden, partido, variant }) {
  if (!partido) return null
  const ganL = partido.ganador_codigo && partido.local?.codigo === partido.ganador_codigo
  const ganV = partido.ganador_codigo && partido.visitante?.codigo === partido.ganador_codigo
  const finalizado = partido.estado === 'finalizado'
  const cls = 'mbc-match' + (variant === 'gold' ? ' destacado' : variant === 'bronze' ? ' bronze' : '')
  const tagCls = 'mbc-match-tag' + (variant === 'gold' ? ' gold' : variant === 'bronze' ? ' bronze' : '')
  return (
    <div className={cls}>
      <div className={tagCls}>{labelPartidoCorto(ronda, orden)}</div>
      <LinkEquipo lado={partido.local}     gan={ganL} finalizado={finalizado} goles={partido.goles_local} />
      <LinkEquipo lado={partido.visitante} gan={ganV} finalizado={finalizado} goles={partido.goles_visitante} />
    </div>
  )
}

function LinkEquipo({ lado, gan, finalizado, goles }) {
  if (!lado) return null
  const esPlaceholder = !!lado.placeholder
  let cls = 'mbc-team'
  if (esPlaceholder) cls += ' placeholder'
  else if (gan)        cls += ' winner'
  else if (finalizado) cls += ' loser'
  return (
    <div className={cls}>
      {!esPlaceholder && lado.codigo ? (
        <Bandera codigo={lado.codigo} emoji={lado.emoji} width={16} height={11} />
      ) : (
        <span className="mbc-team-emoji" style={{ width: 16, display: 'inline-block' }} />
      )}
      <span className="mbc-team-name">
        {esPlaceholder ? (lado.label || '—') : (lado.nombre || lado.codigo || lado.label || '—')}
      </span>
      {finalizado && goles != null && (
        <span className="mbc-team-goles">{goles}</span>
      )}
    </div>
  )
}

// Fix ganador-parcial (2026-06-27): si el partido origen (R32/8vos/etc.) esta
// finalizado, devolvemos el equipo ganador real (o perdedor para 3er puesto);
// si no, fallback al label "Ganador R32-X" / "Perdedor SF-Y".
function resolverSlotKO(origen, porRondaOrden, catalogo) {
  if (!origen) return { label: '-', placeholder: true }
  const p = porRondaOrden.get(origen.from + ':' + origen.orden)
  if (p && p.estado === 'finalizado') {
    const gan = ganadorCodigo(p)
    if (gan) {
      const codigoBuscado = origen.lado === 'perdedor'
        ? (gan === p.equipo_local ? p.equipo_visitante : p.equipo_local)
        : gan
      const eq = equipoLabel(codigoBuscado, catalogo)
      return { ...eq, placeholder: false }
    }
  }
  return { label: labelSlotKO(origen), placeholder: true }
}

function equipoLabel(codigo, catalogo) {
  if (!codigo) return { label: '—' }
  const c = catalogo[codigo]
  if (!c) return { label: codigo, codigo }
  return { codigo, nombre: c.nombre, emoji: c.emoji }
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
  if (ronda === 'final') return 'FINAL'
  if (ronda === 'tercer_puesto') return '3er PUESTO'
  return ronda
}
