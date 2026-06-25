/**
 * AdminMundialRespuestasUsers — Sprint mobile-admin (2026-06-25)
 *
 * Permite al admin cargar/editar las respuestas de cualquier user despues del
 * deadline o cuando el torneo paso de 'abierto'. Usa los endpoints nuevos
 * /respuestas-admin/* (ver routes/mundial.js).
 *
 * UX:
 *   1. Selector de user (dropdown con cant cargada / total).
 *   2. Una card por pregunta con MundialRespuestaInput (mismo que MundialResponder).
 *   3. Campo "Observacion" opcional para el log de auditoria.
 *   4. "Guardar respuestas de <user>" hace PUT bulk con TODAS las respuestas
 *      del editor (las que se modificaron Y las que estaban).
 *
 * Validacion:
 *   - Backend valida shape, codigos contra catalogo y restricciones igual que
 *     PUT /mis-respuestas — error explica que pregunta fallo.
 *   - Estado 'configuracion' rechaza (las preguntas pueden cambiar).
 */

import { useEffect, useState, useMemo } from 'react'
import { api } from '../../api/index.js'
import MundialRespuestaInput from '../../components/MundialRespuestaInput.jsx'

export default function AdminMundialRespuestasUsers({ torneoId, estado }) {
  const [users, setUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [preguntas, setPreguntas] = useState([])
  const [equiposCatalogo, setEquiposCatalogo] = useState([])
  const [respuestas, setRespuestas] = useState({}) // { pregunta_id: respuesta_json (parseado) }
  const [edicion, setEdicion] = useState({})       // { pregunta_id: respuesta_json en edicion }
  const [observacion, setObservacion] = useState('')
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingUser, setLoadingUser] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  // Cargar lista de users + preguntas + catalogo al montar.
  useEffect(() => {
    let cancel = false
    async function loadInit() {
      setLoadingUsers(true)
      setError('')
      try {
        const [u, preg, eq] = await Promise.all([
          api.getMundialAdminRespuestasUsers(torneoId).catch(e => ({ users: [] })),
          api.getMundialPreguntasActivas(torneoId).catch(() => []),
          api.getMundialEquiposCatalogo(torneoId).catch(() => []),
        ])
        if (cancel) return
        setUsers(Array.isArray(u?.users) ? u.users : [])
        setPreguntas(Array.isArray(preg) ? preg : [])
        setEquiposCatalogo(Array.isArray(eq) ? eq : [])
      } catch (e) {
        if (!cancel) setError(e.message || String(e))
      } finally {
        if (!cancel) setLoadingUsers(false)
      }
    }
    loadInit()
    return () => { cancel = true }
  }, [torneoId])

  // Al cambiar user, cargar sus respuestas actuales.
  useEffect(() => {
    if (!selectedUserId) {
      setRespuestas({})
      setEdicion({})
      return
    }
    let cancel = false
    async function loadUser() {
      setLoadingUser(true)
      setError(''); setInfo('')
      try {
        const r = await api.getMundialAdminRespuestasDeUser(torneoId, selectedUserId)
        if (cancel) return
        const map = {}
        for (const it of (r?.respuestas || [])) {
          try {
            const parsed = JSON.parse(it.respuesta_json)
            map[it.pregunta_id] = parsed
          } catch { /* malformada — ignorar */ }
        }
        setRespuestas(map)
        setEdicion({ ...map })
      } catch (e) {
        if (!cancel) setError(e.message || String(e))
      } finally {
        if (!cancel) setLoadingUser(false)
      }
    }
    loadUser()
    return () => { cancel = true }
  }, [torneoId, selectedUserId])

  const userObj = useMemo(
    () => users.find(u => u.id === selectedUserId) || null,
    [users, selectedUserId]
  )

  function handleChange(preguntaId, nuevo) {
    setEdicion(prev => ({ ...prev, [preguntaId]: nuevo }))
  }

  async function guardar() {
    if (!selectedUserId) return
    setSaving(true)
    setError(''); setInfo('')
    try {
      // Enviamos TODAS las respuestas que tengan algun campo no vacio.
      // El backend valida shape; si una esta incompleta tira 400.
      const payload = []
      for (const p of preguntas) {
        const v = edicion[p.id]
        if (!v || typeof v !== 'object') continue
        // No enviar si esta literalmente vacio ({} sin claves)
        if (Object.keys(v).length === 0) continue
        payload.push({ pregunta_id: p.id, respuesta_json: v })
      }
      if (payload.length === 0) {
        setError('No hay respuestas para guardar.')
        setSaving(false)
        return
      }
      const r = await api.saveMundialAdminRespuestasDeUser(
        torneoId, selectedUserId, payload,
        observacion.trim() || null
      )
      setInfo(`Guardado: ${r.creadas} creadas, ${r.actualizadas} actualizadas (total ${r.total}). Estado torneo: ${r.estado_torneo}.`)
      setObservacion('')
      // Re-cargar respuestas guardadas para sincronizar.
      const refresh = await api.getMundialAdminRespuestasDeUser(torneoId, selectedUserId)
      const map = {}
      for (const it of (refresh?.respuestas || [])) {
        try { map[it.pregunta_id] = JSON.parse(it.respuesta_json) } catch {}
      }
      setRespuestas(map)
      setEdicion({ ...map })
      // Refrescar users (cant cargadas / ultima carga)
      const ulist = await api.getMundialAdminRespuestasUsers(torneoId).catch(() => null)
      if (ulist?.users) setUsers(ulist.users)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  const editable = estado !== 'configuracion'

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: 16 }}>
          Carga de respuestas (admin override)
        </h3>
        <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 12 }}>
          Permite cargar/editar respuestas de cualquier user despues del deadline.
          Cada cambio se registra en el log de auditoria con tu usuario.
          {!editable && (
            <div style={{
              marginTop: 10, padding: '8px 12px', background: 'rgba(234,179,8,0.15)',
              color: '#a16207', borderRadius: 6, fontSize: 12,
            }}>
              Bloqueado en estado 'configuracion'. Avanza el torneo a 'abierto' o
              superior para usar esta vista.
            </div>
          )}
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            Usuario
          </label>
          <select
            value={selectedUserId || ''}
            onChange={e => setSelectedUserId(e.target.value ? parseInt(e.target.value, 10) : null)}
            disabled={loadingUsers || !editable}
            style={{ width: '100%', maxWidth: 480, padding: '8px 12px', fontSize: 14, borderRadius: 6, border: '1px solid var(--color-border)' }}
          >
            <option value="">— Elegi un usuario —</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.nombre} — {u.cargadas}/{u.total_preguntas} cargadas
                {u.ultima_carga ? ` · ult: ${u.ultima_carga.slice(0,16).replace('T',' ')}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '10px 12px', background: 'rgba(239,68,68,0.10)',
          color: 'var(--color-danger)', borderRadius: 6, marginBottom: 12, fontSize: 13,
        }}>{error}</div>
      )}
      {info && (
        <div style={{
          padding: '10px 12px', background: 'rgba(22,163,74,0.10)',
          color: 'var(--color-success)', borderRadius: 6, marginBottom: 12, fontSize: 13,
        }}>{info}</div>
      )}

      {selectedUserId && loadingUser && (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--color-muted)' }}>
          Cargando respuestas...
        </div>
      )}

      {selectedUserId && !loadingUser && preguntas.length > 0 && (
        <>
          {preguntas.map(p => {
            let cfg = null
            try { cfg = JSON.parse(p.config_json) } catch { cfg = {} }
            const tieneCargado = !!respuestas[p.id]
            return (
              <div key={p.id} className="card" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--color-muted)',
                    background: 'rgba(0,0,0,0.06)', borderRadius: 99, padding: '2px 8px',
                  }}>#{p.numero}</span>
                  {tieneCargado && (
                    <span title="Cargada" style={{ color: 'var(--color-success)', fontSize: 14, fontWeight: 700 }}>✓</span>
                  )}
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, flex: 1 }}>
                    {p.enunciado}
                  </h4>
                </div>
                {p.aclaracion && (
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 10, fontStyle: 'italic' }}>
                    {p.aclaracion}
                  </div>
                )}
                <MundialRespuestaInput
                  tipo={p.tipo_pregunta}
                  configPregunta={cfg}
                  equiposCatalogo={equiposCatalogo}
                  valor={edicion[p.id] || null}
                  onChange={nueva => handleChange(p.id, nueva)}
                  disabled={!editable || saving}
                />
              </div>
            )
          })}

          <div className="card" style={{ marginTop: 16, marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Observacion (opcional, queda en el log)
            </label>
            <input
              type="text"
              value={observacion}
              onChange={e => setObservacion(e.target.value)}
              placeholder="ej: el user pidio cargar despues del deadline"
              maxLength={500}
              disabled={!editable || saving}
              style={{ width: '100%', padding: '8px 12px', fontSize: 14, borderRadius: 6, border: '1px solid var(--color-border)' }}
            />
            <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!editable || saving}
                onClick={guardar}
              >
                {saving ? 'Guardando...' : `Guardar respuestas de ${userObj?.nombre || 'user'}`}
              </button>
              <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                Estado del torneo: <strong>{estado}</strong>
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
