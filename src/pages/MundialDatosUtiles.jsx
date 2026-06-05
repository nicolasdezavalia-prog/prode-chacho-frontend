/**
 * MundialDatosUtiles — Fase 1 (MVP manual, solo lectura)
 *
 * Página pública /mundial/:torneoId/datos. Lista datos útiles del Mundial
 * cargados por admin, agrupados por tipo. Pensada como "vida" durante el
 * torneo — info para enchufar las charlas:
 *   - goleadores;
 *   - amarillas por equipo;
 *   - rojas por equipo;
 *   - clasificados;
 *   - eliminados;
 *   - tabla de grupos;
 *   - otro.
 *
 * Solo lectura. Cero scoring, cero ranking, cero cruce con respuestas.
 *
 * Orden de secciones (fijo): goleadores → amarillas_equipo → rojas_equipo
 *   → clasificados → eliminados → tabla_grupos → otro.
 *
 * Tipos sin datos cargados: la sección NO se renderiza para no ensuciar.
 *
 * ROADMAP (no implementar acá):
 *   Fase 2 — Tarjetas estructuradas: matriz Equipo × Partido para amarillas
 *     y rojas. Sistema calcula totales y top 5. Reemplaza la carga manual de
 *     'amarillas_equipo' y 'rojas_equipo'.
 *   Fase 3 — Tabla de grupos calculada: admin carga resultados de partidos
 *     de grupo; sistema calcula PJ/Pts/GF/GC/DG/posición. Reemplaza la carga
 *     manual de 'tabla_grupos'.
 *   Fase 4 — "Lo pusieron": cruce contra mundial_respuestas_usuario usando
 *     pregunta_id (ya nullable en el schema). Goleadores → quién eligió ese
 *     jugador, tarjetas/clasificados/eliminados → quién eligió ese equipo.
 *     Gate temporal: no exponer antes del cierre de carga.
 *   Al implementar Fase 2/3, los tipos manuales correspondientes quedan
 *   deprecados desde el admin (sin necesidad de tocar el CHECK del schema).
 */

import { useEffect, useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/index.js'
import MundialIcon from '../components/MundialIcon.jsx'

// Orden fijo de tipos para que el render sea determinístico independiente
// del orden alfabético del backend (que igualmente ordena por tipo asc).
const TIPOS_ORDEN = [
  'goleadores',
  'amarillas_equipo',
  'rojas_equipo',
  'clasificados',
  'eliminados',
  'tabla_grupos',
  'otro',
]

const TIPO_META = {
  goleadores:       { label: 'Goleadores',           emoji: '🥇' },
  amarillas_equipo: { label: 'Amarillas por equipo', emoji: '🟨' },
  rojas_equipo:     { label: 'Rojas por equipo',     emoji: '🟥' },
  clasificados:     { label: 'Clasificados',         emoji: '✅' },
  eliminados:       { label: 'Eliminados',           emoji: '❌' },
  tabla_grupos:     { label: 'Tabla de grupos',      emoji: '📊' },
  otro:             { label: 'Otros datos útiles',   emoji: '📌' },
}

export default function MundialDatosUtiles() {
  const { torneoId } = useParams()
  const [torneo, setTorneo]   = useState(null)
  const [datos, setDatos]     = useState([])
  const [equipos, setEquipos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => { load() /* eslint-disable-next-line */ }, [torneoId])

  async function load() {
    setLoading(true); setError('')
    try {
      const [torneos, list, cat] = await Promise.all([
        api.getMundialTorneos(),
        api.getMundialDatosUtiles(torneoId),
        api.getMundialEquiposCatalogo(torneoId).catch(() => []),
      ])
      const t = (torneos || []).find(x => x.id === parseInt(torneoId, 10))
      if (!t) throw new Error('Torneo Mundial no encontrado')
      setTorneo(t)
      setDatos(Array.isArray(list) ? list : [])
      setEquipos(Array.isArray(cat) ? cat : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Mapa código → equipo (para emoji + nombre).
  const equipoBy = useMemo(() => {
    const m = new Map()
    for (const e of equipos) m.set(e.codigo, e)
    return m
  }, [equipos])

  // Agrupa datos por tipo. Backend ya ordena por (tipo, orden_display, id),
  // así que basta con foldear.
  const porTipo = useMemo(() => {
    const m = new Map()
    for (const d of datos) {
      let arr = m.get(d.tipo)
      if (!arr) { arr = []; m.set(d.tipo, arr) }
      arr.push(d)
    }
    return m
  }, [datos])

  function renderEquipo(codigo) {
    if (!codigo) return null
    const eq = equipoBy.get(codigo)
    if (!eq) return codigo // huérfano: muestra el código crudo
    return (
      <span style={{ whiteSpace: 'nowrap' }}>
        {eq.emoji ? `${eq.emoji} ` : ''}{eq.nombre || codigo}
        {eq.grupo && (
          <span style={{ color: 'var(--color-muted)', marginLeft: 4, fontSize: 11 }}>
            · Grupo {eq.grupo}
          </span>
        )}
      </span>
    )
  }

  if (loading) return <div className="loading">Cargando datos útiles...</div>
  if (error)   return <div className="error-msg" style={{ margin: 24 }}>{error}</div>

  const hayAlgo = datos.length > 0

  return (
    <div style={{ maxWidth: 880, margin: '24px auto', padding: '0 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <MundialIcon width={60} height={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
            Datos útiles — {torneo?.nombre}
          </h1>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
            Información manual del Mundial. Se actualiza durante el torneo.
          </div>
        </div>
        <Link to={`/mundial/${torneoId}`} className="btn btn-secondary btn-sm">
          ← Mis respuestas
        </Link>
      </div>

      {/* Empty */}
      {!hayAlgo && (
        <div style={{
          padding: '16px 18px', textAlign: 'center',
          background: 'rgba(0,0,0,0.04)', color: 'var(--color-muted)',
          borderRadius: 8, fontSize: 14, lineHeight: 1.5,
        }}>
          Todavía no hay datos útiles cargados.
        </div>
      )}

      {/* Secciones por tipo en orden fijo */}
      {TIPOS_ORDEN.map(tipo => {
        const items = porTipo.get(tipo) || []
        if (items.length === 0) return null
        const meta = TIPO_META[tipo] || { label: tipo, emoji: '•' }
        return (
          <section key={tipo} style={{ marginBottom: 20 }}>
            <h2 style={{
              fontSize: 14, fontWeight: 700,
              color: 'var(--color-text)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              margin: '0 0 8px 0',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 18 }}>{meta.emoji}</span>
              {meta.label}
              <span style={{
                fontSize: 11, color: 'var(--color-muted)',
                fontWeight: 400, textTransform: 'none',
              }}>
                ({items.length})
              </span>
            </h2>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  {items.map((d, idx) => (
                    <tr key={d.id} style={{
                      borderTop: idx === 0 ? 'none' : '1px solid rgba(0,0,0,0.05)',
                    }}>
                      <td style={tdMain}>
                        <div style={{ fontWeight: 600 }}>{d.titulo}</div>
                        {/* Línea secundaria: equipo + jugador + grupo */}
                        {(d.equipo_codigo || d.jugador || (d.grupo && !d.equipo_codigo)) && (
                          <div style={{
                            fontSize: 12, color: 'var(--color-muted)',
                            marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap',
                          }}>
                            {d.equipo_codigo && <span>{renderEquipo(d.equipo_codigo)}</span>}
                            {d.jugador && (
                              <span>👤 {d.jugador}</span>
                            )}
                            {d.grupo && !d.equipo_codigo && (
                              <span>Grupo {d.grupo}</span>
                            )}
                          </div>
                        )}
                        {/* Descripción opcional */}
                        {d.descripcion && (
                          <div style={{
                            fontSize: 12, color: 'var(--color-muted)',
                            marginTop: 4, fontStyle: 'italic', lineHeight: 1.4,
                          }}>
                            {d.descripcion}
                          </div>
                        )}
                      </td>
                      {/* Valor (num o texto). Si ambos, prioridad al num — el texto va al pie. */}
                      <td style={tdValor}>
                        {Number.isInteger(d.valor_num) && (
                          <span style={{
                            fontSize: 18, fontWeight: 700, color: 'var(--color-text)',
                            fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                          }}>
                            {d.valor_num}
                          </span>
                        )}
                        {!Number.isInteger(d.valor_num) && d.valor_texto && (
                          <span style={{ fontSize: 13, color: 'var(--color-text)' }}>
                            {d.valor_texto}
                          </span>
                        )}
                        {Number.isInteger(d.valor_num) && d.valor_texto && (
                          <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>
                            {d.valor_texto}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </div>
  )
}

const tdMain = {
  padding: '10px 12px',
  verticalAlign: 'top',
  lineHeight: 1.4,
}
const tdValor = {
  padding: '10px 12px',
  textAlign: 'right',
  whiteSpace: 'nowrap',
  verticalAlign: 'top',
  minWidth: 80,
}
