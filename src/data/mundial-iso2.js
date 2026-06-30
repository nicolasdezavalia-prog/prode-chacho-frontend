/**
 * mundial-iso2.js — Mapeo código equipo (interno 3 letras) → ISO 3166-1 alpha-2
 * para servir banderas desde flagcdn.com.
 *
 * Casos especiales:
 *   - SCO (Escocia) → 'gb-sct'  (subdivisión, flagcdn lo soporta)
 *   - ING (Inglaterra) → 'gb-eng'  (idem)
 *   - Códigos locales del proyecto (ALE=Alemania, HOL=Países Bajos, etc.)
 *     no son ISO oficiales — el mapeo los traduce al país real.
 */

const ISO2 = {
  // Grupo A
  MEX: 'mx', RSA: 'za', COR: 'kr', CHE: 'cz',
  // Grupo B
  CAN: 'ca', BOS: 'ba', QAT: 'qa', SUI: 'ch',
  // Grupo C
  BRA: 'br', MAR: 'ma', HAI: 'ht', SCO: 'gb-sct',
  // Grupo D
  USA: 'us', PAR: 'py', AUS: 'au', TUR: 'tr',
  // Grupo E
  ALE: 'de', CUR: 'cw', CIV: 'ci', ECU: 'ec',
  // Grupo F
  HOL: 'nl', JAP: 'jp', SUE: 'se', TUN: 'tn',
  // Grupo G
  BEL: 'be', EGY: 'eg', IRN: 'ir', NZL: 'nz',
  // Grupo H
  ESP: 'es', CAB: 'cv', KSA: 'sa', URU: 'uy',
  // Grupo I
  FRA: 'fr', SEN: 'sn', IRQ: 'iq', NOR: 'no',
  // Grupo J
  ARG: 'ar', ALG: 'dz', AUT: 'at', JOR: 'jo',
  // Grupo K
  POR: 'pt', COD: 'cd', UZB: 'uz', COL: 'co',
  // Grupo L
  ING: 'gb-eng', CRO: 'hr', GHA: 'gh', PAN: 'pa',
}

export function isoDe(codigo) {
  if (!codigo) return null
  return ISO2[codigo] || null
}

export default ISO2
