/**
 * mundial-cascada-ko.js — Copia FE de R32_BRACKET y CASCADA_KO del backend.
 *
 * Permite renderear placeholders "Ganador R32-1" / "Perdedor SF-2" en la UI
 * cuando una ronda futura aún no tiene partidos creados (porque la anterior
 * no se finalizó). NO duplica la generación real, solo el SLOT-MAPPING para
 * la UI. Si cambia el backend, también hay que sincronizar este archivo.
 *
 * Fuente: backend/src/logic/mundial-bracket.js
 */

export const R32_BRACKET = [
  { orden: 1,  local: { tipo: 'pos', pos: 2, grupo: 'A' }, visitante: { tipo: 'pos', pos: 2, grupo: 'B' } },
  { orden: 2,  local: { tipo: 'pos', pos: 1, grupo: 'C' }, visitante: { tipo: 'pos', pos: 2, grupo: 'F' } },
  { orden: 3,  local: { tipo: 'pos', pos: 1, grupo: 'E' }, visitante: { tipo: 'third', vs: '1E' } },
  { orden: 4,  local: { tipo: 'pos', pos: 1, grupo: 'F' }, visitante: { tipo: 'pos', pos: 2, grupo: 'C' } },
  { orden: 5,  local: { tipo: 'pos', pos: 2, grupo: 'E' }, visitante: { tipo: 'pos', pos: 2, grupo: 'I' } },
  { orden: 6,  local: { tipo: 'pos', pos: 1, grupo: 'I' }, visitante: { tipo: 'third', vs: '1I' } },
  { orden: 7,  local: { tipo: 'pos', pos: 1, grupo: 'A' }, visitante: { tipo: 'third', vs: '1A' } },
  { orden: 8,  local: { tipo: 'pos', pos: 1, grupo: 'L' }, visitante: { tipo: 'third', vs: '1L' } },
  { orden: 9,  local: { tipo: 'pos', pos: 1, grupo: 'G' }, visitante: { tipo: 'third', vs: '1G' } },
  { orden: 10, local: { tipo: 'pos', pos: 1, grupo: 'D' }, visitante: { tipo: 'third', vs: '1D' } },
  { orden: 11, local: { tipo: 'pos', pos: 1, grupo: 'H' }, visitante: { tipo: 'pos', pos: 2, grupo: 'J' } },
  { orden: 12, local: { tipo: 'pos', pos: 2, grupo: 'K' }, visitante: { tipo: 'pos', pos: 2, grupo: 'L' } },
  { orden: 13, local: { tipo: 'pos', pos: 1, grupo: 'B' }, visitante: { tipo: 'third', vs: '1B' } },
  { orden: 14, local: { tipo: 'pos', pos: 2, grupo: 'D' }, visitante: { tipo: 'pos', pos: 2, grupo: 'G' } },
  { orden: 15, local: { tipo: 'pos', pos: 1, grupo: 'J' }, visitante: { tipo: 'pos', pos: 2, grupo: 'H' } },
  { orden: 16, local: { tipo: 'pos', pos: 1, grupo: 'K' }, visitante: { tipo: 'third', vs: '1K' } },
]

// FIX bracket-fifa-oficial (2026-06-27): sincronizado con backend.
// La cascada anterior cruzaba R32-2 (1°C vs 2°F) con R32-4 (1°F vs 2°C)
// en 8vos — eso permitia Brasil vs Marruecos (mismo grupo C) en 8vos,
// violando la regla FIFA. Cascada actualizada segun bracket oficial.
// Mapping FIFA Match -> R32 interno:
//   M89=R32-3+R32-6 M90=R32-1+R32-4 M91=R32-2+R32-5 M92=R32-7+R32-8
//   M93=R32-12+R32-11 M94=R32-10+R32-9 M95=R32-15+R32-14 M96=R32-13+R32-16
// Fuente: https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage
export const CASCADA_KO = [
  { ronda: '8vos', orden: 1, local: { from: '16vos', orden: 3,  lado: 'ganador' }, visitante: { from: '16vos', orden: 6,  lado: 'ganador' } },
  { ronda: '8vos', orden: 2, local: { from: '16vos', orden: 1,  lado: 'ganador' }, visitante: { from: '16vos', orden: 4,  lado: 'ganador' } },
  { ronda: '8vos', orden: 3, local: { from: '16vos', orden: 2,  lado: 'ganador' }, visitante: { from: '16vos', orden: 5,  lado: 'ganador' } },
  { ronda: '8vos', orden: 4, local: { from: '16vos', orden: 7,  lado: 'ganador' }, visitante: { from: '16vos', orden: 8,  lado: 'ganador' } },
  { ronda: '8vos', orden: 5, local: { from: '16vos', orden: 12, lado: 'ganador' }, visitante: { from: '16vos', orden: 11, lado: 'ganador' } },
  { ronda: '8vos', orden: 6, local: { from: '16vos', orden: 10, lado: 'ganador' }, visitante: { from: '16vos', orden: 9,  lado: 'ganador' } },
  { ronda: '8vos', orden: 7, local: { from: '16vos', orden: 15, lado: 'ganador' }, visitante: { from: '16vos', orden: 14, lado: 'ganador' } },
  { ronda: '8vos', orden: 8, local: { from: '16vos', orden: 13, lado: 'ganador' }, visitante: { from: '16vos', orden: 16, lado: 'ganador' } },
  { ronda: '4tos', orden: 1, local: { from: '8vos', orden: 1, lado: 'ganador' }, visitante: { from: '8vos', orden: 2, lado: 'ganador' } },
  { ronda: '4tos', orden: 2, local: { from: '8vos', orden: 5, lado: 'ganador' }, visitante: { from: '8vos', orden: 6, lado: 'ganador' } },
  { ronda: '4tos', orden: 3, local: { from: '8vos', orden: 3, lado: 'ganador' }, visitante: { from: '8vos', orden: 4, lado: 'ganador' } },
  { ronda: '4tos', orden: 4, local: { from: '8vos', orden: 7, lado: 'ganador' }, visitante: { from: '8vos', orden: 8, lado: 'ganador' } },
  { ronda: 'semis', orden: 1, local: { from: '4tos', orden: 1, lado: 'ganador' }, visitante: { from: '4tos', orden: 2, lado: 'ganador' } },
  { ronda: 'semis', orden: 2, local: { from: '4tos', orden: 3, lado: 'ganador' }, visitante: { from: '4tos', orden: 4, lado: 'ganador' } },
  { ronda: 'tercer_puesto', orden: 1, local: { from: 'semis', orden: 1, lado: 'perdedor' }, visitante: { from: 'semis', orden: 2, lado: 'perdedor' } },
  { ronda: 'final',         orden: 1, local: { from: 'semis', orden: 1, lado: 'ganador' },  visitante: { from: 'semis', orden: 2, lado: 'ganador' } },
]

// Label corto por ronda para placeholders ("R32-3", "8vos-1", etc.).
const RONDA_PREFIJO = {
  '16vos': 'R32',
  '8vos':  '8vos',
  '4tos':  'QF',
  'semis': 'SF',
  'tercer_puesto': '3°P',
  'final': 'Final',
}

// Label legible para "Ganador R32-3" / "Perdedor SF-1".
export function labelGanador(ronda, orden) {
  const pfx = RONDA_PREFIJO[ronda] || ronda
  return `Ganador ${pfx}-${orden}`
}
export function labelPerdedor(ronda, orden) {
  const pfx = RONDA_PREFIJO[ronda] || ronda
  return `Perdedor ${pfx}-${orden}`
}

// Etiqueta de partido futuro a partir de su fuente (local/visitante).
// origen = { from, orden, lado: 'ganador'|'perdedor' }.
export function labelSlotKO(origen) {
  if (!origen) return '—'
  return origen.lado === 'perdedor'
    ? labelPerdedor(origen.from, origen.orden)
    : labelGanador(origen.from, origen.orden)
}

// Etiqueta de slot R32 (1°A, 2°B, 3°vs1A según matriz, etc.).
export function labelSlotR32(slot) {
  if (!slot) return '—'
  if (slot.tipo === 'pos') return `${slot.pos}°${slot.grupo}`
  if (slot.tipo === 'third') return `3° vs ${slot.vs}`
  return '—'
}

export const RONDAS_BRACKET = ['16vos', '8vos', '4tos', 'semis', 'tercer_puesto', 'final']

export const RONDA_LABEL = {
  '16vos': '16vos',
  '8vos':  '8vos',
  '4tos':  'Cuartos',
  'semis': 'Semis',
  'tercer_puesto': '3er puesto',
  'final': 'Final',
}
