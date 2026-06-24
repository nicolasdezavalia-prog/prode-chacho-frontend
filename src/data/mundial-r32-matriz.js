/**
 * MATRIZ_TERCEROS — Mundial 2026, asignación oficial de los 8 mejores
 * terceros a sus cruces de Round of 32. Tomada del reglamento FIFA,
 * Anexo C / "Combinations for eight best third-placed teams".
 *
 * Estructura:
 *   key   = 8 letras de grupo (los grupos cuyos terceros clasifican)
 *           ordenadas alfabéticamente y unidas por "-".
 *           Ejemplo: "A-C-D-E-F-H-I-J"
 *   value = objeto con la asignación específica de cada slot del fixture.
 *
 *   {
 *     THIRD_SLOT_vs_1E: '3D',
 *     THIRD_SLOT_vs_1I: '3C',
 *     THIRD_SLOT_vs_1A: '3F',
 *     THIRD_SLOT_vs_1L: '3E',
 *     THIRD_SLOT_vs_1G: '3A',
 *     THIRD_SLOT_vs_1D: '3J',
 *     THIRD_SLOT_vs_1B: '3I',
 *     THIRD_SLOT_vs_1K: '3H',
 *   }
 *
 * Total: 495 combinaciones (C(12,8) = 12! / (8! 4!)).
 *
 * Mapeo Anexo C → slot interno:
 *   Anexo C lista 8 columnas con encabezado 1A, 1B, 1D, 1E, 1G, 1I, 1K, 1L.
 *   El valor de cada columna es el "3X" rival de ese 1°. Mapeo directo:
 *     1A → THIRD_SLOT_vs_1A
 *     1B → THIRD_SLOT_vs_1B
 *     1D → THIRD_SLOT_vs_1D
 *     1E → THIRD_SLOT_vs_1E
 *     1G → THIRD_SLOT_vs_1G
 *     1I → THIRD_SLOT_vs_1I
 *     1K → THIRD_SLOT_vs_1K
 *     1L → THIRD_SLOT_vs_1L
 *
 * ⚠️ PENDIENTE: cargar las 495 entradas oficiales del Anexo C.
 * Usar `scripts/cargar-matriz-r32-fifa.js` (carpeta backend) para convertir
 * el CSV oficial a este shape de forma determinística.
 */

const MATRIZ_TERCEROS = {
  // 1ª combinación cargada manualmente para validar el flujo end-to-end.
  // Referencia 2026-06-22. Cuando llegue el Anexo C completo, las 494
  // restantes se cargan vía backend/scripts/cargar-matriz-r32-fifa.js.
  // 1ª combinación cargada manualmente para validar el flujo end-to-end.
  // Referencia 2026-06-22. Cuando llegue el Anexo C completo, las 494
  // restantes se cargan vía backend/scripts/cargar-matriz-r32-fifa.js.
  'A-C-D-F-G-H-J-L': {
    THIRD_SLOT_vs_1E: '3D',
    THIRD_SLOT_vs_1I: '3F',
    THIRD_SLOT_vs_1A: '3C',
    THIRD_SLOT_vs_1L: '3H',
    THIRD_SLOT_vs_1G: '3A',
    THIRD_SLOT_vs_1D: '3J',
    THIRD_SLOT_vs_1B: '3G',
    THIRD_SLOT_vs_1K: '3L',
  },
}

export default MATRIZ_TERCEROS
