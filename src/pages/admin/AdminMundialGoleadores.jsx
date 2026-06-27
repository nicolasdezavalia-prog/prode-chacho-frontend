/**
 * AdminMundialGoleadores — Sprint Final C5.
 *
 * Sub-tab de Datos útiles (admin). Grilla del TOP de goleadores que mantiene
 * el admin: jugador | equipo | goles | activo | orden | notas | borrar.
 * Guardado bulk (UPSERT por jugador+equipo); bajas por fila.
 * Alimenta la sección "Top goleadores" de Datos útiles (usuario) y, en C7,
 * la sugerencia de la pregunta Goleador. NO toca scoring/ranking/respuestas.
 */

import { useEffect, useState } from 'react'
import { api } from '../../api/index.js'
import EquipoAutocomplete from '../../components/EquipoAutocomplete.jsx'

export default function AdminMundialGoleadores({ torneoId }) {
  const [filas, setFilas]     = useState([])
  const [equipos, setEquipos] = useState([])
  const [dirty, setDirty]     = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [info, setInfo]       = useState('')
  const [seq, setSeq]         = useState(1)

  useEffect(() => { load() /* eslint-disable-next-line */ }, [torneoId])

  async function load() {
    setLoading(true); setError('')
    try {
      const [data, cat] = await Promise.all([
        api.getMundialGoleadores(torneoId),
        api.getMundialEquiposCatalogo(torneoId).catch(() => []),
      ])
      setFilas((data.goleadores || []).map(g => ({
        key: `id-${g.id}`, id: g.id,
        jugador: g.jugador, equipo_codigo: g.equipo_codigo,
        goles: String(g.goles), activo: g.activo === 1,
        orden_display: g.orden_display || 0, notas: g.notas || '',
      })))
      setEquipos(Array.isArray(cat) ? cat.filter(e => e.activo !== 0) : [])
      setDirty(new Set())
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  function setCampo(key, campo, valor) {
    setFilas(prev => prev.map(f => (f.key === key ? { ...f, [campo]: valor } : f)))
    setDirty(prev => new Set(prev).add(key))
    setInfo('')
  }

  function agregar() {
    const key = `nuevo-${seq}`
    setSeq(n => n + 1)
    setFilas(prev => [...prev, { key, id: null, jugador: '', equipo_codigo: '', goles: '0', activo: true, orden_display: 0, notas: '' }])
    setDirty(prev => new Set(prev).add(key))
  }

  async function borrar(f) {
    if (!f.id) {
      setFilas(prev => prev.filter(x => x.key !== f.key))
      setDirty(prev => { const s = new Set(prev); s.delete(f.key); return s })
      return
    }
    if (!confirm(`¿Borrar a ${f.jugador} del top de goleadores?`)) return
    setError(''); setInfo('')
    try {
      await api.deleteMundialGoleador(torneoId, f.id)
      setInfo('Goleador borrado.')
      await load()
    } catch (e) { setError(e.message) }
  }

  async function guardar() {
    if (saving || dirty.size === 0) return
    const aGuardar = filas.filter(f => dirty.has(f.key))
    for (const f of aGuardar) {
      if (!f.jugador.trim()) { setError('Hay una fila sin jugador.'); return }
      if (!f.equipo_codigo)  { setError(`Falta el equipo de ${f.jugador}.`); return }
    }
    setSaving(true); setError(''); setInfo('')
    try {
      const goleadores = aGuardar.map(f => ({
        jugador: f.jugador.trim(),
        equipo_codigo: f.equipo_codigo,
        goles: parseInt(f.goles, 10) || 0,
        activo: f.activo ? 1 : 0,
        orden_display: parseInt(f.orden_display, 10) || 0,
        notas: f.notas || undefined,
      }))
      await api.saveMundialGoleadoresBulk(torneoId, goleadores)
      setInfo(`${goleadores.length} goleador(es) guardado(s).`)
      await load()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  if (loading) return <div className="loading">Cargando goleadores...</div>

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 10, lineHeight: 1.45 }}>
        🥇 Top de goleadores del torneo, mantenido a mano (10-20 filas alcanzan).
        Alimenta Datos útiles y la futura sugerencia de la pregunta Goleador.
        El nombre que cargues acá es el <strong>canónico</strong> — usá la grafía linda (ej: "K. Mbappé").
      </div>
      {/* Sprint goleadores-por-partido: aviso anti doble-cuenta */}
      <div style={{
        padding: '8px 12px', marginBottom: 12,
        background: 'rgba(234,179,8,0.10)', color: '#a16207',
        border: '1px solid rgba(234,179,8,0.30)',
        borderRadius: 6, fontSize: 12, lineHeight: 1.5,
      }}>
        ⚠️ <strong>A partir de ahora cargá goleadores desde el modal del Fixture</strong>
        (boton ⚽ en cada partido). Esta pantalla queda solo para el TOP historico
        que ya cargaste manualmente. Si sumás un goleador acá Y también en un
        partido del Fixture, el sistema lo cuenta DOS veces — descontá los goles
        que ya estén cargados via modal.
      </div>
      {error && <div className="error-msg" style={{ marginBottom: 10 }}>{error}</div>}
      {info && (
        <div style={{ padding: '6px 10px', marginBottom: 10, background: 'rgba(22,163,74,0.10)', color: 'var(--color-success)', borderRadius: 6, fontSize: 12 }}>{info}</div>
      )}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={agregar}>➕ Agregar goleador</button>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-primary btn-sm" onClick={guardar} disabled={saving || dirty.size === 0}>
          {saving ? 'Guardando...' : `💾 Guardar${dirty.size > 0 ? ` (${dirty.size})` : ''}`}
        </button>
      </div>
      {filas.length === 0 ? (
        <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>
          Sin goleadores cargados todavía.
        </div>
      ) : (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, background: 'white' }}>
          {/* OJO: sin overflowX en este contenedor — el dropdown del autocomplete
              de equipos es position:absolute y un contenedor con overflow lo
              recorta (bug detectado por Nico en la carga de L. Yamal). */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.03)' }}>
                <th style={thC}>Jugador</th>
                <th style={{ ...thC, minWidth: 220 }}>Equipo</th>
                <th style={thC}>Goles</th>
                <th style={thC}>Activo</th>
                <th style={thC} title="Orden de desempate visual">Orden</th>
                <th style={{ ...thC, minWidth: 140 }}>Notas</th>
                <th style={thC}></th>
              </tr>
            </thead>
            <tbody>
              {filas.map(f => (
                <tr key={f.key} style={{
                  borderTop: '1px solid var(--color-border)',
                  background: dirty.has(f.key) ? 'rgba(234,179,8,0.06)' : undefined,
                  opacity: f.activo ? 1 : 0.6,
                }}>
                  <td style={tdC}>
                    <input type="text" value={f.jugador} placeholder="Ej: K. Mbappé"
                      onChange={e => setCampo(f.key, 'jugador', e.target.value)}
                      style={{ ...inC, minWidth: 150 }} />
                  </td>
                  <td style={{ ...tdC, position: 'relative', minWidth: 220 }}>
                    <EquipoAutocomplete
                      equipos={equipos}
                      valor={f.equipo_codigo}
                      onChange={c => setCampo(f.key, 'equipo_codigo', c)}
                      placeholder="Buscar por nombre o código…"
                    />
                  </td>
                  <td style={tdC}>
                    <input type="number" min="0" value={f.goles}
                      onChange={e => setCampo(f.key, 'goles', e.target.value)}
                      style={{ ...inC, width: 56, textAlign: 'center', fontWeight: 700 }} />
                  </td>
                  <td style={{ ...tdC, textAlign: 'center' }}>
                    <input type="checkbox" checked={f.activo}
                      title={f.activo ? 'Activo (su equipo sigue en el torneo)' : 'Eliminado del torneo'}
                      onChange={e => setCampo(f.key, 'activo', e.target.checked)} />
                  </td>
                  <td style={tdC}>
                    <input type="number" min="0" value={f.orden_display}
                      onChange={e => setCampo(f.key, 'orden_display', e.target.value)}
                      style={{ ...inC, width: 52, textAlign: 'center' }} />
                  </td>
                  <td style={tdC}>
                    <input type="text" value={f.notas} placeholder="—"
                      onChange={e => setCampo(f.key, 'notas', e.target.value)}
                      style={{ ...inC, width: '100%' }} />
                  </td>
                  <td style={{ ...tdC, whiteSpace: 'nowrap' }}>
                    <button type="button" onClick={() => borrar(f)} title="Borrar"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-muted)' }}>
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
