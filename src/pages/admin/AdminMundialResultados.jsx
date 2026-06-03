/**
 * AdminMundialResultados — Fase 3
 *
 * Tab Resultados del AdminMundialHub.
 *
 * Props:
 *   torneoId  — id del torneo Mundial.
 *   estado    — estado actual del torneo (de mundial_config).
 *   onChanged — callback opcional (no usado por ahora, reservado).
 *
 * UX MVP:
 *   - Una card por pregunta con su MundialResultadoInput.
 *   - "Guardar" por card (POST individual). Sin bulk para MVP.
 *   - "Borrar" si ya hay resultado cargado.
 *   - Contador "X de Y cargados" arriba.
 *   - Política backend: solo se puede cargar/borrar si estado >= 'grupos_jugados'.
 *     El componente muestra un banner si el estado no lo permite y deshabilita
 *     todos los inputs.
 *
 * Sin scoring preview, sin "ver pts esperados" — el ranking se ve en su
 * propia página y mis-puntos del user en /mundial/:id.
 */

import { useEffect, useState, useMemo } from 'react'
import { api } from '../../api/index.js'
import MundialResultadoInput from '../../components/MundialResultadoInput.jsx'

const ESTADOS_EDITABLES = new Set([
  'grupos_jugados', 'cambios_abiertos', 'cambios_cerrados', 'resultados', 'finalizado',
])

// Tipos que necesitan fetch de respuestas-por-pregunta para mostrar la tabla
// de overrides en el editor admin (Fase 3.1 + 3.2).
// Incluye equipo_categoria SOLO si el config tiene scoring_manual:true.
function preguntaNecesitaRespuestas(p) {
  if (!p) return false
  if (p.tipo_pregunta === 'respuesta_manual') return true
  if (p.tipo_pregunta === 'regla_especial')   return true
  if (p.tipo_pregunta === 'equipo_categoria') {
    let cfg = {}
    try { cfg = JSON.parse(p.config_json) || {} } catch { /* deja {} */ }
    return cfg.scoring_manual === true
  }
  return false
}

const TIPO_LABEL = {
  opcion_unica:          'Opción única',
  equipo_categoria:      'Equipo (categorías)',
  instancia_eliminacion: 'Instancia de eliminación',
  numero_exacto:         'Número exacto',
  numero_por_banda:      'Número por banda',
  multi_equipo:          'Multi-equipo',
  respuesta_manual:      'Respuesta manual',
  regla_especial:        'Regla especial',
}

export default function AdminMundialResultados({ torneoId, estado }) {
  const editable = ESTADOS_EDITABLES.has(estado)

  const [preguntas, setPreguntas]           = useState([])
  const [resultados, setResultados]         = useState({})    // { pregunta_id: resultado_json (parseado) }
  const [equiposCatalogo, setEquiposCatalogo] = useState([])
  const [edicion, setEdicion]               = useState({})    // { pregunta_id: resultado_json en edición }
  // Fase 3.1 — respuestas de TODOS los users por pregunta texto. Lo carga
  // el admin para asignar overrides_pts a mano cuando el matching automático
  // no alcanza (ej: 'MESSI' vs 'L. MESSI' vs 'Lionel Messi').
  // Shape: { pregunta_id: [{ user_id, nombre, respuesta_json, updated_at }] }
  const [respuestasPorPregunta, setRespuestasPorPregunta] = useState({})
  const [savingId, setSavingId]             = useState(null)
  const [deletingId, setDeletingId]         = useState(null)
  const [error, setError]                   = useState('')
  const [info, setInfo]                     = useState('')
  const [loading, setLoading]               = useState(true)

  useEffect(() => { load() /* eslint-disable-next-line */ }, [torneoId, estado])

  async function load() {
    setLoading(true)
    setError(''); setInfo('')
    try {
      // Preguntas + equipos siempre se pueden leer (con sus permisos habituales).
      const [preg, equipos] = await Promise.all([
        api.getMundialPreguntasActivas(torneoId).catch(() => []),
        api.getMundialEquiposCatalogo(torneoId).catch(() => []),
      ])
      setPreguntas(Array.isArray(preg) ? preg : [])
      setEquiposCatalogo(Array.isArray(equipos) ? equipos : [])

      // Resultados: el backend devuelve 403 si estado < grupos_jugados.
      // Si pasa, los cargamos; sino, dejamos {} y el banner explica el porqué.
      if (editable) {
        const res = await api.getMundialResultados(torneoId).catch(() => [])
        const map = {}
        const edit = {}
        for (const r of (res || [])) {
          try {
            const parsed = JSON.parse(r.resultado_json)
            map[r.pregunta_id]  = parsed
            edit[r.pregunta_id] = parsed
          } catch { /* ignorar resultado malformado */ }
        }
        setResultados(map)
        setEdicion(edit)

        // Fetch en paralelo las respuestas para los tipos que usan tabla de overrides:
        //   - respuesta_manual / regla_especial (Fase 3.1)
        //   - equipo_categoria con scoring_manual: true (Fase 3.2)
        const preguntasConOverrides = (preg || []).filter(preguntaNecesitaRespuestas)
        const respMap = {}
        await Promise.all(preguntasConOverrides.map(async p => {
          const respList = await api.getMundialRespuestasPregunta(torneoId, p.id).catch(() => [])
          respMap[p.id] = Array.isArray(respList) ? respList : []
        }))
        setRespuestasPorPregunta(respMap)
      } else {
        setResultados({})
        setEdicion({})
        setRespuestasPorPregunta({})
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const cargados = useMemo(() => Object.keys(resultados).length, [resultados])
  const total    = preguntas.length

  function handleChange(preguntaId, nuevoResultado) {
    setEdicion(prev => ({ ...prev, [preguntaId]: nuevoResultado }))
  }

  async function handleSave(preguntaId) {
    if (!editable || savingId) return
    setSavingId(preguntaId)
    setError(''); setInfo('')
    try {
      const resultado = edicion[preguntaId] || {}
      if (!resultado || Object.keys(resultado).length === 0) {
        setError('Cargá el resultado antes de guardar.')
        return
      }
      await api.saveMundialResultado(torneoId, preguntaId, resultado)
      setInfo(`Resultado #${preguntas.find(p => p.id === preguntaId)?.numero} guardado.`)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSavingId(null)
    }
  }

  async function handleDelete(preguntaId) {
    if (!editable || deletingId) return
    const p = preguntas.find(p => p.id === preguntaId)
    if (!confirm(`¿Borrar resultado de la pregunta #${p?.numero}?`)) return
    setDeletingId(preguntaId)
    setError(''); setInfo('')
    try {
      await api.deleteMundialResultado(torneoId, preguntaId)
      setInfo(`Resultado #${p?.numero} borrado.`)
      // Limpiar edición local también
      setEdicion(prev => {
        const next = { ...prev }
        delete next[preguntaId]
        return next
      })
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <div className="loading">Cargando...</div>

  return (
    <div>
      {!editable && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(234,179,8,0.12)',
          color: '#a16207',
          borderRadius: 8, marginBottom: 16, fontSize: 13, lineHeight: 1.45,
          border: '1px solid rgba(234,179,8,0.30)',
        }}>
          ⏳ La carga de resultados se habilita a partir del estado <strong>Grupos jugados</strong>.
          Estado actual: <strong>{estado}</strong>.
        </div>
      )}

      {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}
      {info && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(22,163,74,0.10)',
          color: 'var(--color-success)',
          borderRadius: 6, marginBottom: 12, fontSize: 13,
        }}>
          {info}
        </div>
      )}

      <div style={{
        fontSize: 13, color: 'var(--color-muted)', marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <span><strong>{cargados}</strong> de <strong>{total}</strong> resultados cargados</span>
      </div>

      {preguntas.length === 0 ? (
        <div style={{
          padding: '32px 16px', textAlign: 'center',
          color: 'var(--color-muted)', fontSize: 14,
        }}>
          No hay preguntas activas en este torneo.
        </div>
      ) : (
        preguntas.map(p => {
          let cfg = null
          try { cfg = JSON.parse(p.config_json) } catch { cfg = {} }
          const tieneCargado = !!resultados[p.id]
          return (
            <div key={p.id} className="card" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--color-muted)',
                  background: 'rgba(0,0,0,0.06)', borderRadius: 99, padding: '2px 8px',
                }}>
                  #{p.numero}
                </span>
                {tieneCargado && (
                  <span title="Resultado cargado" style={{
                    color: 'var(--color-success)', fontSize: 14, fontWeight: 700, lineHeight: 1,
                  }}>✓</span>
                )}
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, flex: 1 }}>
                  {p.enunciado}
                </h3>
                <span style={{
                  fontSize: 11, color: 'var(--color-muted)',
                  background: 'rgba(0,0,0,0.04)', padding: '2px 8px', borderRadius: 4,
                  whiteSpace: 'nowrap',
                }}>
                  {TIPO_LABEL[p.tipo_pregunta] || p.tipo_pregunta}
                </span>
              </div>
              {p.aclaracion && (
                <div style={{
                  fontSize: 12, color: 'var(--color-muted)',
                  marginBottom: 12, fontStyle: 'italic',
                }}>
                  {p.aclaracion}
                </div>
              )}
              <MundialResultadoInput
                tipo={p.tipo_pregunta}
                configPregunta={cfg}
                equiposCatalogo={equiposCatalogo}
                valor={edicion[p.id]}
                onChange={nueva => handleChange(p.id, nueva)}
                disabled={!editable}
                respuestasUsuarios={respuestasPorPregunta[p.id]}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                {tieneCargado && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleDelete(p.id)}
                    disabled={!editable || deletingId === p.id || savingId !== null}
                  >
                    {deletingId === p.id ? 'Borrando...' : 'Borrar'}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleSave(p.id)}
                  disabled={!editable || savingId === p.id || deletingId !== null}
                >
                  {savingId === p.id ? 'Guardando...' : (tieneCargado ? 'Actualizar' : 'Guardar')}
                </button>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
