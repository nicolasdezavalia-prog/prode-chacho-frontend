/**
 * AdminMundialPremiosIndividuales — Sprint Final C6.
 *
 * Sub-tab de Datos útiles (admin). Un premio de cada tipo por torneo
 * (UNIQUE del schema C1): Balón/Guante/Bota de Oro, Fair Play, Mejor joven,
 * Otro. `jugador` queda vacío hasta que el premio se otorgue. `pregunta_id`
 * linkea la pregunta que en C7 va a recibir la sugerencia de resultado.
 * Guardado bulk (UPSERT por premio). NO toca scoring/ranking/respuestas.
 */

import { useEffect, useState } from 'react'
import { api } from '../../api/index.js'
import EquipoAutocomplete from '../../components/EquipoAutocomplete.jsx'

// Templates VISIBLES por defecto — solo los premios que este Mundial usa
// (decisión 2026-06-11): Balón de Oro (P6), Guante de Oro (P7) y Bota de Oro
// (asociable a Goleador P5). Fair Play NO va acá: es premio a EQUIPO y la
// pregunta #8 se resuelve en Resultados con select de equipo. 'fair_play',
// 'mejor_joven' y 'otro' siguen soportados por el backend, pero solo se
// muestran si ya existen cargados en la DB (no como template).
const PREMIOS_TEMPLATE = [
  { premio: 'balon_oro',  tituloDefault: 'Balón de Oro' },
  { premio: 'guante_oro', tituloDefault: 'Guante de Oro' },
  { premio: 'bota_oro',   tituloDefault: 'Bota de Oro' },
]

export default function AdminMundialPremiosIndividuales({ torneoId }) {
  const [filas, setFilas]       = useState([])
  const [equipos, setEquipos]   = useState([])
  const [preguntas, setPreguntas] = useState([])
  const [dirty, setDirty]       = useState(new Set())
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [info, setInfo]         = useState('')

  useEffect(() => { load() /* eslint-disable-next-line */ }, [torneoId])

  async function load() {
    setLoading(true); setError('')
    try {
      const [data, cat, preg] = await Promise.all([
        api.getMundialPremiosIndividuales(torneoId),
        api.getMundialEquiposCatalogo(torneoId).catch(() => []),
        api.getMundialPreguntasActivas(torneoId).catch(() => []),
      ])
      const existentes = new Map((data.premios || []).map(p => [p.premio, p]))
      // Filas = templates visibles (existan o no) + premios YA cargados en DB
      // que no son template (legacy/avanzado: fair_play, mejor_joven, otro) —
      // los datos existentes nunca se ocultan.
      const aFila = (premio, tituloDefault) => {
        const e = existentes.get(premio)
        return {
          key: premio, premio,
          existe: !!e,
          titulo: e?.titulo || tituloDefault,
          jugador: e?.jugador || '',
          equipo_codigo: e?.equipo_codigo || '',
          pregunta_id: e?.pregunta_id || '',
          notas: e?.notas || '',
        }
      }
      const templates = PREMIOS_TEMPLATE.map(t => aFila(t.premio, t.tituloDefault))
      const extras = [...existentes.keys()]
        .filter(p => !PREMIOS_TEMPLATE.some(t => t.premio === p))
        .map(p => aFila(p, ''))
      setFilas([...templates, ...extras])
      setEquipos(Array.isArray(cat) ? cat.filter(e => e.activo !== 0) : [])
      setPreguntas(Array.isArray(preg) ? preg : [])
      setDirty(new Set())
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  function setCampo(key, campo, valor) {
    setFilas(prev => prev.map(f => (f.key === key ? { ...f, [campo]: valor } : f)))
    setDirty(prev => new Set(prev).add(key))
    setInfo('')
  }

  async function guardar() {
    if (saving || dirty.size === 0) return
    const aGuardar = filas.filter(f => dirty.has(f.key))
    for (const f of aGuardar) {
      if (!f.titulo.trim()) { setError(`Falta el título del premio "${f.premio}".`); return }
    }
    setSaving(true); setError(''); setInfo('')
    try {
      const premios = aGuardar.map(f => ({
        premio: f.premio,
        titulo: f.titulo.trim(),
        jugador: f.jugador.trim() || undefined,
        equipo_codigo: f.equipo_codigo || undefined,
        pregunta_id: f.pregunta_id ? parseInt(f.pregunta_id, 10) : undefined,
        notas: f.notas || undefined,
      }))
      await api.saveMundialPremiosIndividualesBulk(torneoId, premios)
      setInfo(`${premios.length} premio(s) guardado(s).`)
      await load()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  if (loading) return <div className="loading">Cargando premios individuales...</div>

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 10, lineHeight: 1.45 }}>
        🏅 Premios individuales a JUGADOR: Balón de Oro, Guante de Oro y Bota de Oro.
        Dejá <strong>jugador vacío</strong> hasta que se otorgue. El nombre que cargues es el{' '}
        <strong>canónico</strong> (grafía linda). "Pregunta relacionada" linkea la pregunta del prode
        que va a recibir la sugerencia de resultado (C7).
        <br />ℹ️ <strong>Fair Play no va acá</strong>: es premio a equipo — la pregunta #8 se resuelve
        directo en el tab Resultados eligiendo el equipo.
      </div>
      {error && <div className="error-msg" style={{ marginBottom: 10 }}>{error}</div>}
      {info && (
        <div style={{ padding: '6px 10px', marginBottom: 10, background: 'rgba(22,163,74,0.10)', color: 'var(--color-success)', borderRadius: 6, fontSize: 12 }}>{info}</div>
      )}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-primary btn-sm" onClick={guardar} disabled={saving || dirty.size === 0}>
          {saving ? 'Guardando...' : `💾 Guardar${dirty.size > 0 ? ` (${dirty.size})` : ''}`}
        </button>
      </div>
      {/* Sin overflowX: el dropdown del autocomplete (absolute) se recorta
          dentro de contenedores con overflow — mismo fix que Goleadores. */}
      <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, background: 'white' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.03)' }}>
              <th style={thC}>Premio</th>
              <th style={{ ...thC, minWidth: 150 }}>Título</th>
              <th style={{ ...thC, minWidth: 140 }}>Jugador (canónico)</th>
              <th style={{ ...thC, minWidth: 170 }}>Equipo</th>
              <th style={{ ...thC, minWidth: 170 }}>Pregunta relacionada</th>
              <th style={{ ...thC, minWidth: 120 }}>Notas</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.key} style={{
                borderTop: '1px solid var(--color-border)',
                background: dirty.has(f.key) ? 'rgba(234,179,8,0.06)' : undefined,
              }}>
                <td style={{ ...tdC, whiteSpace: 'nowrap' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                    background: f.existe ? 'rgba(22,163,74,0.10)' : 'rgba(0,0,0,0.05)',
                    color: f.existe ? '#15803d' : 'var(--color-muted)',
                  }}>
                    {f.premio}{f.existe ? ' ✓' : ''}
                  </span>
                </td>
                <td style={tdC}>
                  <input type="text" value={f.titulo}
                    onChange={e => setCampo(f.key, 'titulo', e.target.value)}
                    style={{ ...inC, width: '100%' }} placeholder="Título del premio" />
                </td>
                <td style={tdC}>
                  <input type="text" value={f.jugador}
                    onChange={e => setCampo(f.key, 'jugador', e.target.value)}
                    style={{ ...inC, width: '100%' }} placeholder="— sin otorgar —" />
                </td>
                <td style={{ ...tdC, position: 'relative', minWidth: 200 }}>
                  <EquipoAutocomplete
                    equipos={equipos}
                    valor={f.equipo_codigo}
                    onChange={c => setCampo(f.key, 'equipo_codigo', c)}
                    placeholder="Buscar por nombre o código…"
                  />
                </td>
                <td style={tdC}>
                  <select value={f.pregunta_id} onChange={e => setCampo(f.key, 'pregunta_id', e.target.value)} style={{ ...inC, width: '100%' }}>
                    <option value="">— sin pregunta —</option>
                    {preguntas
                      .filter(p => p.tipo_pregunta === 'respuesta_manual' || p.tipo_pregunta === 'regla_especial')
                      .map(p => (
                        <option key={p.id} value={p.id}>#{p.numero} — {p.enunciado}</option>
                      ))}
                  </select>
                </td>
                <td style={tdC}>
                  <input type="text" value={f.notas} placeholder="—"
                    onChange={e => setCampo(f.key, 'notas', e.target.value)}
                    style={{ ...inC, width: '100%' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const thC = {
  padding: '6px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700,
  color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
}
const tdC = { padding: '4px 8px', verticalAlign: 'middle' }
const inC = {
  padding: '4px 6px', fontSize: 12, border: '1px solid var(--color-border)',
  borderRadius: 4, background: 'white', outline: 'none',
}
