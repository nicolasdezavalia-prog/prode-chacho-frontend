/**
 * Parser puro del Excel del Mundial — Fase 2.3
 *
 * Entry point único: parsearArchivoExcel(file: File): Promise<{ preguntas, advertencias }>
 *
 * Estrategia:
 *   - Lazy-load de SheetJS (xlsx) via dynamic import — no infla el bundle principal.
 *   - Busca hoja "Preguntas" (case-insensitive). Si no existe, usa la primera con warning.
 *   - Itera filas: numero (col B), enunciado (col C), puntos texto (col D), aclaracion (col E).
 *   - Heurística de detección de tipo en `detectarTipo()` con 8 patrones, prioridad de
 *     mayor a menor especificidad. Fallback final a `respuesta_manual`.
 *
 * Sin React, sin DOM. Importable desde browser y testeable como módulo aislado.
 *
 * ParsedPregunta shape:
 *   {
 *     numero:         int,
 *     enunciado:      string,
 *     aclaracion:     string | null,
 *     tipo_pregunta:  string (uno de los 8 tipos válidos del backend),
 *     config_json:    object (shape válido para el tipo),
 *     puntosRaw:      string (texto crudo de la columna D, para debug),
 *     detectorUsado:  string (qué detector matcheó — info para el preview),
 *     incluir:        boolean (default true; el admin puede deshabilitar en preview),
 *   }
 */

// ── Punto de entrada ────────────────────────────────────────────────────────
export async function parsearArchivoExcel(file) {
  const advertencias = []

  // Lazy-load — solo se descarga cuando el admin abre el importer.
  const XLSX = await import('xlsx')
  const buf  = await file.arrayBuffer()
  const wb   = XLSX.read(buf, { type: 'array' })

  // Buscar hoja "Preguntas" case-insensitive.
  const sheetName = wb.SheetNames.find(n => String(n).trim().toLowerCase() === 'preguntas')
  let usedSheet
  if (sheetName) {
    usedSheet = sheetName
  } else {
    usedSheet = wb.SheetNames[0]
    advertencias.push(`No se encontró hoja "Preguntas". Usando la primera hoja: "${usedSheet}".`)
  }
  const sheet = wb.Sheets[usedSheet]
  if (!sheet) {
    return { preguntas: [], advertencias: [`Hoja "${usedSheet}" vacía o ilegible.`] }
  }

  // sheet_to_json con header:1 → array de arrays. defval:'' evita undefined.
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  const preguntas     = []
  const numerosVistos = new Set()
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || []
    // Columnas asumidas: B=1 (numero), C=2 (enunciado), D=3 (pts text), E=4 (aclaracion).
    const numeroRaw  = row[1]
    const enunciado  = String(row[2] || '').trim()
    const puntosRaw  = String(row[3] || '').trim()
    const aclaracion = String(row[4] || '').trim()

    if (numeroRaw === '' || enunciado === '') continue // skip headers/vacías
    const numero = parseInt(numeroRaw, 10)
    if (!Number.isInteger(numero) || numero <= 0) {
      advertencias.push(`Fila ${r + 1}: número inválido "${numeroRaw}". Salteada.`)
      continue
    }
    if (numerosVistos.has(numero)) {
      advertencias.push(`Fila ${r + 1}: número ${numero} duplicado. Salteada.`)
      continue
    }
    numerosVistos.add(numero)

    const detectado = detectarTipo({ enunciado, puntosRaw, aclaracion })
    preguntas.push({
      numero,
      enunciado,
      aclaracion: aclaracion || null,
      tipo_pregunta: detectado.tipo,
      config_json:   detectado.config,
      puntosRaw,
      detectorUsado: detectado.detector,
      incluir: true,
    })
  }

  return { preguntas, advertencias }
}

// ── Heurística de detección de tipo ─────────────────────────────────────────
// Orden de prioridad: del patrón más específico al fallback genérico.
// Cada detector devuelve { tipo, config, detector } o null si no aplica.
function detectarTipo({ enunciado, puntosRaw, aclaracion }) {
  const detectores = [
    detectarNumeroPorBanda,
    detectarInstanciaEliminacion,
    detectarEquipoCategoria,
    detectarMultiEquipo,
    detectarOpcionUnicaAsimetrica,
    detectarNumeroExacto,
    detectarEquipoCategoria1Default,
  ]
  for (const fn of detectores) {
    const r = fn({ enunciado, puntosRaw, aclaracion })
    if (r) return r
  }
  // Fallback: respuesta_manual con pts_max deducido del texto.
  return fallbackRespuestaManual({ puntosRaw })
}

// 1. numero_por_banda — "N o más: X; Menos: Y"
function detectarNumeroPorBanda({ puntosRaw }) {
  const m = puntosRaw.match(/^\s*(\d+)\s*o\s+más\s*:\s*(\d+)\s*;\s*Menos\s*:\s*(\d+)\s*$/i)
  if (!m) return null
  const N        = parseInt(m[1], 10)
  const ptsAlta  = parseInt(m[2], 10)
  const ptsBaja  = parseInt(m[3], 10)
  return {
    tipo: 'numero_por_banda',
    detector: 'numero_por_banda (N o más; Menos)',
    config: {
      bandas: [
        { min: 0, max: N - 1, pts: ptsBaja },
        { min: N, pts: ptsAlta },
      ],
    },
  }
}

// 2. instancia_eliminacion — "Grupos: 50; 16°: 40; 8°/Semis/Final: 30; 4°: 20"
function detectarInstanciaEliminacion({ enunciado, puntosRaw }) {
  if (!/grupos\s*:|16°|8°|semis|final/i.test(puntosRaw)) return null
  const instancias = []
  const pts_por_instancia = {}
  const segments = puntosRaw.split(';').map(s => s.trim()).filter(Boolean)
  for (const seg of segments) {
    const idx = seg.lastIndexOf(':')
    if (idx < 0) continue
    const labels = seg.slice(0, idx).split('/').map(s => s.trim()).filter(Boolean)
    const pts    = parseInt(seg.slice(idx + 1).trim(), 10)
    if (!Number.isInteger(pts)) continue
    for (const label of labels) {
      if (/^otro$/i.test(label)) continue
      if (!instancias.includes(label)) instancias.push(label)
      pts_por_instancia[label] = pts
    }
  }
  if (instancias.length < 2) return null
  const equipo = extraerEquipoDelEnunciado(enunciado)
  return {
    tipo: 'instancia_eliminacion',
    detector: 'instancia_eliminacion (Grupos/16°/8°/4°/Semis/Final)',
    config: { equipo: equipo || '', instancias, pts_por_instancia },
  }
}

// 3. equipo_categoria — códigos con guión o "Otro:" como catch-all.
//    Acepta:
//      - "BRA-ARG-FRA-ESP: 50; ALE-ING-POR-HOL: 75; OTRO: 100"  (codigos)
//      - "Australia: 25; Otro: 10"                              (1 grupo + default)
//      - "Bosnia/Suiza: 20; Otro: 10"                           (slash separator)
//      - "Costa de Marfil/Ecuador: 10; Otro: 25"                (slash + spaces)
function detectarEquipoCategoria({ puntosRaw }) {
  const tieneOtro          = /\botro\s*:/i.test(puntosRaw)
  const tieneCodigosGuiona = /[A-Z]{2,5}(-[A-Z]{2,5})+/.test(puntosRaw)
  if (!tieneOtro && !tieneCodigosGuiona) return null
  const segments = puntosRaw.split(';').map(s => s.trim()).filter(Boolean)
  const categorias = []
  let labelIdx = 0
  for (const seg of segments) {
    const idx = seg.lastIndexOf(':')
    if (idx < 0) continue
    const left   = seg.slice(0, idx).trim()
    const ptsStr = seg.slice(idx + 1).trim()
    const pts    = parseInt(ptsStr, 10)
    if (!Number.isInteger(pts)) continue
    if (/^otro$/i.test(left)) {
      categorias.push({ label: 'otro', pts, default: true })
    } else {
      // Splitear por `-` o `/` (códigos o nombres separados)
      const equipos = left.split(/[-\/]/).map(s => s.trim()).filter(Boolean)
      categorias.push({ label: `cat_${labelIdx++}`, equipos, pts })
    }
  }
  if (categorias.length === 0) return null
  // Si no había "OTRO" detectado, agregar default vacía para cumplir validación backend.
  if (!categorias.some(c => c.default === true)) {
    categorias.push({ label: 'otro', pts: 0, default: true })
  }
  return {
    tipo: 'equipo_categoria',
    detector: 'equipo_categoria (codigos/nombres + OTRO)',
    config: { categorias },
  }
}

// 4. multi_equipo — "N por equipo" + cantidad en enunciado
function detectarMultiEquipo({ enunciado, puntosRaw }) {
  const m = puntosRaw.match(/^\s*(\d+)\s+por\s+equipo\s*$/i)
  if (!m) return null
  const ptsPorAcierto = parseInt(m[1], 10)
  const cantMatch     = enunciado.match(/(\d+)\s+equipos?/i)
  const nEquipos      = cantMatch ? parseInt(cantMatch[1], 10) : 1
  return {
    tipo: 'multi_equipo',
    detector: 'multi_equipo (N por equipo)',
    config: { n_equipos: nEquipos, pts_por_acierto: ptsPorAcierto },
  }
}

// 5. opcion_unica asimétrica — "Label: int; Label: int" sin códigos guionados ni OTRO.
//    Ejemplo: "No: 10; Sí: 15"
function detectarOpcionUnicaAsimetrica({ puntosRaw }) {
  const segments = puntosRaw.split(';').map(s => s.trim()).filter(Boolean)
  if (segments.length < 2) return null
  const opciones = []
  const pts_por_opcion = {}
  for (const seg of segments) {
    const idx = seg.lastIndexOf(':')
    if (idx < 0) return null
    const label  = seg.slice(0, idx).trim()
    const ptsStr = seg.slice(idx + 1).trim()
    const pts    = parseInt(ptsStr, 10)
    if (!label || !Number.isInteger(pts)) return null
    // Excluir patrones que serían equipo_categoria (códigos guionados)
    if (/[A-Z]{2,5}-[A-Z]{2,5}/.test(label)) return null
    // Excluir label "otro" (sería catch-all de equipo_categoria)
    if (/^otro$/i.test(label)) return null
    if (label in pts_por_opcion) return null
    opciones.push(label)
    pts_por_opcion[label] = pts
  }
  if (opciones.length < 2) return null
  return {
    tipo: 'opcion_unica',
    detector: 'opcion_unica (pts_por_opcion asimétrico)',
    config: { opciones, pts_por_opcion },
  }
}

// 6. numero_exacto — aclaración "número exacto" + pts es un solo número
function detectarNumeroExacto({ puntosRaw, aclaracion }) {
  if (!/n[úu]mero\s+exacto/i.test(aclaracion || '')) return null
  if (!/^\s*\d+\s*$/.test(puntosRaw)) return null
  const pts = parseInt(puntosRaw, 10)
  return {
    tipo: 'numero_exacto',
    detector: 'numero_exacto (aclaración + pts único)',
    config: { pts_si_acierta: pts, pts_si_no_acierta: 0 },
  }
}

// 7. equipo_categoria con 1 default — pts único + enunciado menciona equipo/grupo
function detectarEquipoCategoria1Default({ enunciado, puntosRaw }) {
  if (!/^\s*\d+\s*$/.test(puntosRaw)) return null
  if (!mencionaEquipoEnEnunciado(enunciado)) return null
  const pts = parseInt(puntosRaw, 10)
  return {
    tipo: 'equipo_categoria',
    detector: 'equipo_categoria (1 default, pts único)',
    config: { categorias: [{ label: 'cualquiera', pts, default: true }] },
  }
}

// 8. Fallback — respuesta_manual con pts_max deducido
function fallbackRespuestaManual({ puntosRaw }) {
  const numeros = (puntosRaw.match(/\d+/g) || []).map(Number)
  const ptsMax  = numeros.length > 0 ? Math.max(...numeros) : 10
  return {
    tipo: 'respuesta_manual',
    detector: 'respuesta_manual (fallback)',
    config: {
      pts_max: ptsMax,
      instrucciones: puntosRaw || 'Asignar puntos manualmente.',
    },
  }
}

// ── helpers ────────────────────────────────────────────────────────────────
function mencionaEquipoEnEnunciado(enunciado) {
  return /equipo|grupo|segundo|tercero|cuarto|último|mejor|campeón|subcampeón|gana(?:dor)?/i.test(enunciado)
}

function extraerEquipoDelEnunciado(enunciado) {
  // Map nombre → código Spanish. No exhaustivo; el admin lo corrige en el preview
  // si no acertó. Cubre los casos del Excel original.
  const map = {
    'Inglaterra': 'ING', 'Argentina': 'ARG', 'Brasil': 'BRA', 'España': 'ESP',
    'Alemania':   'ALE', 'Francia':   'FRA', 'Portugal': 'POR', 'Italia':  'ITA',
    'Bélgica':    'BEL', 'Holanda':   'HOL', 'Países Bajos': 'HOL', 'Croacia': 'CRO',
    'Uruguay':    'URU', 'Colombia':  'COL', 'México':   'MEX', 'Japón':   'JAP',
    'Corea':      'COR', 'Australia': 'AUS', 'Marruecos': 'MAR',
  }
  for (const [nombre, codigo] of Object.entries(map)) {
    if (enunciado.includes(nombre)) return codigo
  }
  return ''
}
