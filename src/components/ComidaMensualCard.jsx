import { useState, useEffect } from 'react'
import { api } from '../api/index.js'
import { useAuth } from '../App.jsx'

const ESTADOS = [
  { value: 'pendiente',   label: '⏳ Pendiente',   color: 'var(--color-muted)' },
  { value: 'confirmada',  label: '✅ Confirmada',  color: 'var(--color-success)' },
  { value: 'realizada',   label: '🍗 Realizada',   color: 'var(--color-primary)' },
]

function estadoConfig(estado) {
  return ESTADOS.find(e => e.value === estado) || ESTADOS[0]
}

/**
 * ComidaMensualCard
 *
 * Props:
 *  - torneoId: number
 *  - mes: number
 *  - anio: number
 *  - jugadores: Array<{ id, nombre }> (lista de jugadores del torneo)
 *  - puedeEditar: boolean (tiene permiso editar_tabla_mensual o es superadmin)
 *  - organizadorSugerido: { id, nombre } | null (tomado del cierre mensual si existe)
 */
export default function ComidaMensualCard({ torneoId, mes, anio, jugadores = [], puedeEditar, organizadorSugerido }) {
  const [comida, setComida] = useState(undefined)   // undefined = cargando, null = no existe
  const [editando, setEditando] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    organizador_user_id: '',
    lugar: '',
    fecha_comida: '',
    google_maps_url: '',
    nota: '',
    estado: 'pendiente',
  })

  // Estado para participantes (sección separada)
  const [participantes, setParticipantes] = useState(null)
  const [editandoPart, setEditandoPart] = useState(false)
  const [savingPart, setSavingPart] = useState(false)
  const [formPart, setFormPart] = useState({ jugadoresIds: new Set(), externos: [] })
  const [nuevoExterno, setNuevoExterno] = useState('')

  // Estado para fotos
  const [fotos, setFotos] = useState([])
  const [modalFotosAbierto, setModalFotosAbierto] = useState(false)
  const [subiendo, setSubiendo] = useState(false)

  // Usuario actual
  const { user } = useAuth()

  // Estado para votación
  const [votacionConfig, setVotacionConfig] = useState([])
  const [misVotos, setMisVotos] = useState({})          // { [item]: puntaje }
  const [votacionForm, setVotacionForm] = useState({})   // { [item]: string }
  const [savingVoto, setSavingVoto] = useState(false)
  const [votacionOk, setVotacionOk] = useState('')
  const [votacionError, setVotacionError] = useState('')
  const [modalVotoAbierto, setModalVotoAbierto] = useState(false)

  useEffect(() => {
    if (!torneoId || !mes || !anio) return
    setComida(undefined)
    setEditando(false)
    setParticipantes(null)
    setEditandoPart(false)
    api.getComida(torneoId, mes, anio)
      .then(data => setComida(data))
      .catch(() => setComida(null))
  }, [torneoId, mes, anio])

  // Carga participantes cuando la comida ya tiene ID
  useEffect(() => {
    if (!comida?.id) { setParticipantes(null); return }
    api.getParticipantes(comida.id)
      .then(data => setParticipantes(data))
      .catch(() => setParticipantes({ jugadores: [], externos: [] }))
  }, [comida?.id])

  // Carga fotos cuando la comida tiene ID
  useEffect(() => {
    if (!comida?.id) { setFotos([]); return }
    api.getFotos(comida.id)
      .then(data => setFotos(Array.isArray(data) ? data : []))
      .catch(() => setFotos([]))
  }, [comida?.id])

  // Carga configuración de votación del torneo
  useEffect(() => {
    if (!torneoId) return
    api.getComidaVotacionConfig(torneoId)
      .then(cfg => setVotacionConfig(Array.isArray(cfg.items) ? cfg.items : []))
      .catch(() => setVotacionConfig([]))
  }, [torneoId])

  // Carga mis votos cuando hay comida
  useEffect(() => {
    if (!comida?.id) { setMisVotos({}); setVotacionForm({}); return }
    api.getMisVotos(comida.id)
      .then(data => {
        const map = {}
        const formMap = {}
        ;(Array.isArray(data) ? data : []).forEach(v => {
          map[v.item] = v.puntaje
          formMap[v.item] = String(v.puntaje)
        })
        setMisVotos(map)
        setVotacionForm(formMap)
      })
      .catch(() => { setMisVotos({}); setVotacionForm({}) })
  }, [comida?.id])

  const handleSubirFoto = () => {
    if (!comida?.id) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (!file) return
      setSubiendo(true)
      const reader = new FileReader()
      reader.onload = async (ev) => {
        try {
          const foto = await api.addFoto(comida.id, ev.target.result)
          setFotos(prev => [...prev, foto])
        } catch (err) {
          alert('Error al subir foto: ' + err.message)
        } finally {
          setSubiendo(false)
        }
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  const abrirEdicion = () => {
    setForm({
      organizador_user_id: comida?.organizador_user_id?.toString()
        || organizadorSugerido?.id?.toString()
        || '',
      lugar:           comida?.lugar           || '',
      fecha_comida:    comida?.fecha_comida     || '',
      google_maps_url: comida?.google_maps_url  || '',
      nota:            comida?.nota             || '',
      estado:          comida?.estado           || 'pendiente',
    })
    setEditando(true)
  }

  const cancelar = () => setEditando(false)

  const guardar = async () => {
    setSaving(true)
    try {
      const saved = await api.saveComida({
        torneo_id:          torneoId,
        mes,
        anio,
        organizador_user_id: form.organizador_user_id ? parseInt(form.organizador_user_id) : null,
        lugar:               form.lugar.trim()           || null,
        fecha_comida:        form.fecha_comida.trim()    || null,
        google_maps_url:     form.google_maps_url.trim() || null,
        nota:                form.nota.trim()            || null,
        estado:              form.estado,
      })
      setComida(saved)
      setEditando(false)
    } catch (err) {
      alert('Error al guardar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  // ——— Handlers participantes ———

  const abrirEditPart = () => {
    const asistentesIds = new Set(
      (participantes?.jugadores || []).filter(j => j.asistio).map(j => j.user_id)
    )
    setFormPart({
      jugadoresIds: asistentesIds,
      externos: (participantes?.externos || []).map(e => e.nombre),
    })
    setNuevoExterno('')
    setEditandoPart(true)
  }

  const cancelarPart = () => setEditandoPart(false)

  const toggleJugador = (userId) => {
    setFormPart(f => {
      const ids = new Set(f.jugadoresIds)
      if (ids.has(userId)) ids.delete(userId)
      else ids.add(userId)
      return { ...f, jugadoresIds: ids }
    })
  }

  const agregarExterno = () => {
    const nombre = nuevoExterno.trim()
    if (!nombre) return
    setFormPart(f => ({ ...f, externos: [...f.externos, nombre] }))
    setNuevoExterno('')
  }

  const quitarExterno = (idx) => {
    setFormPart(f => ({ ...f, externos: f.externos.filter((_, i) => i !== idx) }))
  }

  const guardarParticipantes = async () => {
    if (!comida?.id) return
    setSavingPart(true)
    try {
      const jugadoresPayload = jugadores
        .filter(j => formPart.jugadoresIds.has(j.id))
        .map(j => ({ user_id: j.id, nombre: j.nombre, asistio: true }))

      const externosPayload = formPart.externos
        .filter(n => n.trim())
        .map(nombre => ({ nombre: nombre.trim() }))

      const saved = await api.saveParticipantes(comida.id, {
        jugadores: jugadoresPayload,
        externos: externosPayload,
      })
      setParticipantes(saved)
      setEditandoPart(false)
    } catch (err) {
      alert('Error al guardar participantes: ' + err.message)
    } finally {
      setSavingPart(false)
    }
  }

  // ——— Handlers votación ———

  const handleGuardarVotos = async () => {
    setVotacionError('')
    setVotacionOk('')

    // Validar que todos los items tengan valor en rango
    for (const item of votacionConfig) {
      const v = votacionForm[item.nombre]
      if (v === undefined || v === '') {
        setVotacionError(`Falta puntaje para "${item.nombre}".`)
        return
      }
      const n = Number(v)
      if (!Number.isInteger(n) || n < 1 || n > 10) {
        setVotacionError(`Puntaje de "${item.nombre}" debe ser entre 1 y 10.`)
        return
      }
    }

    const votos = votacionConfig.map(item => ({
      item: item.nombre,
      puntaje: Number(votacionForm[item.nombre]),
    }))

    setSavingVoto(true)
    try {
      const updated = await api.saveMisVotos(comida.id, votos)
      const map = {}
      const formMap = {}
      ;(Array.isArray(updated) ? updated : []).forEach(v => {
        map[v.item] = v.puntaje
        formMap[v.item] = String(v.puntaje)
      })
      setMisVotos(map)
      setVotacionForm(formMap)
      setVotacionOk('¡Votación guardada!')
      setModalVotoAbierto(false)
    } catch (err) {
      setVotacionError(err.message)
    } finally {
      setSavingVoto(false)
    }
  }

  // ——— RENDER ———

  if (comida === undefined) {
    return null // cargando silenciosamente
  }

  const cfg = estadoConfig(comida?.estado)

  const cardStyle = {
    flex: '1 1 260px',
    minWidth: 240,
  }

  const labelStyle = {
    fontSize: 11,
    color: 'var(--color-muted)',
    display: 'block',
    marginBottom: 3,
  }

  const inputStyle = {
    width: '100%',
    fontSize: 13,
    boxSizing: 'border-box',
  }

  return (
    <>
      <div className="card" style={cardStyle}>
      <div className="card-header" style={{ paddingBottom: 8 }}>
        🍽️ Comida del mes
        {comida && (
          <span style={{ fontSize: 11, color: cfg.color, marginLeft: 8, fontWeight: 500 }}>
            {cfg.label}
          </span>
        )}
      </div>

      {!editando ? (
        /* ——— MODO VISTA ——— */
        <div style={{ padding: '4px 0' }}>
          {!comida ? (
            <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '4px 0 8px' }}>
              Sin información cargada aún.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Organizador */}
              {comida.organizador_nombre && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>💸</span>
                  <span style={{ fontSize: 13 }}>
                    <span style={{ color: 'var(--color-muted)', marginRight: 4 }}>Organizador:</span>
                    <strong>{comida.organizador_nombre}</strong>
                  </span>
                </div>
              )}

              {/* Lugar */}
              {comida.lugar && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>📍</span>
                  <span style={{ fontSize: 13 }}>
                    <span style={{ color: 'var(--color-muted)', marginRight: 4 }}>Lugar:</span>
                    {comida.google_maps_url ? (
                      <a
                        href={comida.google_maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--color-primary)', fontWeight: 600 }}
                      >
                        {comida.lugar}
                      </a>
                    ) : (
                      <strong>{comida.lugar}</strong>
                    )}
                  </span>
                </div>
              )}

              {/* Fecha */}
              {comida.fecha_comida && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>📅</span>
                  <span style={{ fontSize: 13 }}>
                    <span style={{ color: 'var(--color-muted)', marginRight: 4 }}>Fecha:</span>
                    <strong>{comida.fecha_comida}</strong>
                  </span>
                </div>
              )}

              {/* Link maps si hay lugar + url */}
              {comida.google_maps_url && !comida.lugar && (
                <div>
                  <a
                    href={comida.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 13, color: 'var(--color-primary)' }}
                  >
                    📍 Ver ubicación
                  </a>
                </div>
              )}

              {/* Nota */}
              {comida.nota && (
                <div style={{
                  marginTop: 4,
                  padding: '6px 10px',
                  background: 'var(--color-surface2)',
                  borderRadius: 6,
                  fontSize: 12,
                  color: 'var(--color-muted)',
                  borderLeft: '3px solid var(--color-primary)',
                }}>
                  {comida.nota}
                </div>
              )}
            </div>
          )}

          {/* ——— Fotos ——— */}
          {comida && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                📸 Fotos: <strong style={{ color: 'var(--color-text)' }}>{fotos.length}</strong>
              </span>
              <button
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11 }}
                onClick={() => setModalFotosAbierto(true)}
              >
                Ver fotos
              </button>
              {puedeEditar && (
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 11 }}
                  onClick={handleSubirFoto}
                  disabled={subiendo}
                >
                  {subiendo ? 'Subiendo...' : '+ Agregar foto'}
                </button>
              )}
            </div>
          )}

          {/* ——— Sección participantes ——— */}
          {comida && (
            <div style={{ marginTop: 12, borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6, letterSpacing: 0.5 }}>
                Participantes
                {participantes && (
                  <span style={{ fontWeight: 400, marginLeft: 6 }}>
                    ({(participantes.jugadores?.length || 0) + (participantes.externos?.length || 0)})
                  </span>
                )}
              </div>

              {!editandoPart ? (
                /* Vista de participantes */
                <div>
                  {!participantes || (participantes.jugadores?.length === 0 && participantes.externos?.length === 0) ? (
                    <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '0 0 8px' }}>Sin participantes registrados.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>

                      {/* Jugadores del prode */}
                      {(participantes.jugadores || []).length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                            🎮 <span>Jugadores</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 4 }}>
                            {participantes.jugadores.map(j => (
                              <span key={j.user_id} style={{ fontSize: 13 }}>{j.nombre}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Invitados externos */}
                      {(participantes.externos || []).length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                            👤 <span>Invitados</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 4 }}>
                            {participantes.externos.map((e, i) => (
                              <span key={i} style={{ fontSize: 13 }}>{e.nombre}</span>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                  {puedeEditar && (
                    <div style={{ marginTop: 8 }}>
                      <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={abrirEditPart}>
                        👥 Editar participantes
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Edición de participantes */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Jugadores del torneo */}
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 5 }}>Jugadores del torneo:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {jugadores.map(j => (
                        <label key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                          <input
                            type="checkbox"
                            checked={formPart.jugadoresIds.has(j.id)}
                            onChange={() => toggleJugador(j.id)}
                          />
                          {j.nombre}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Invitados externos */}
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 5 }}>Invitados externos:</div>
                    {formPart.externos.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6 }}>
                        {formPart.externos.map((nombre, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                            <span>👤 {nombre}</span>
                            <button
                              onClick={() => quitarExterno(idx)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '0 2px', fontSize: 13 }}
                              title="Quitar invitado"
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        value={nuevoExterno}
                        onChange={e => setNuevoExterno(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && agregarExterno()}
                        placeholder="Nombre del invitado"
                        style={{ flex: 1, fontSize: 12, boxSizing: 'border-box' }}
                      />
                      <button className="btn btn-secondary btn-sm" style={{ fontSize: 12 }} onClick={agregarExterno}>
                        + Agregar
                      </button>
                    </div>
                  </div>

                  {/* Botones */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-primary btn-sm" style={{ fontSize: 12 }} onClick={guardarParticipantes} disabled={savingPart}>
                      {savingPart ? 'Guardando...' : '💾 Guardar'}
                    </button>
                    <button className="btn btn-secondary btn-sm" style={{ fontSize: 12 }} onClick={cancelarPart} disabled={savingPart}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ——— Sección votación (compacta) ——— */}
          {comida && comida.estado !== 'pendiente' && (() => {
            const soyOrganizador = comida.organizador_user_id && comida.organizador_user_id === user?.id
            const yoPuedoVotar = !soyOrganizador && participantes?.jugadores?.some(
              j => j.user_id === user?.id && j.puede_votar
            )

            // Organizador: mostrar badge, sin botón de voto
            if (soyOrganizador) {
              return (
                <div style={{ marginTop: 12, borderTop: '1px solid var(--color-border)', paddingTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-muted)', letterSpacing: 0.5 }}>
                    🗳️ Tu votación
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--color-muted)', fontStyle: 'italic' }}>
                    Organizador · no vota
                  </span>
                </div>
              )
            }

            if (!yoPuedoVotar) return null
            const yaVoto = Object.keys(misVotos).length > 0
            const votacionCerrada = comida.votacion_estado === 'cerrada'
            return (
              <div style={{ marginTop: 12, borderTop: '1px solid var(--color-border)', paddingTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-muted)', letterSpacing: 0.5 }}>
                  🗳️ Tu votación
                </span>
                {votacionCerrada ? (
                  <span style={{ fontSize: 12, color: 'var(--color-danger)', fontWeight: 600 }}>
                    🔒 Cerrada
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: yaVoto ? 'var(--color-success)' : 'var(--color-muted)' }}>
                    {yaVoto ? '✓ Guardada' : 'Pendiente'}
                  </span>
                )}
                {!votacionCerrada && (
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11, marginLeft: 'auto' }}
                    onClick={() => { setVotacionError(''); setModalVotoAbierto(true) }}
                  >
                    {yaVoto ? 'Editar voto' : 'Votar'}
                  </button>
                )}
              </div>
            )
          })()}

          {puedeEditar && (
            <div style={{ marginTop: 10 }}>
              <button
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 12 }}
                onClick={abrirEdicion}
              >
                ✏️ {comida ? 'Editar' : 'Cargar comida'}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ——— MODO EDICIÓN ——— */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
          {/* Organizador */}
          <div>
            <label style={labelStyle}>Organizador</label>
            <select
              value={form.organizador_user_id}
              onChange={e => set('organizador_user_id', e.target.value)}
              style={inputStyle}
            >
              <option value="">— sin seleccionar —</option>
              {jugadores.map(j => (
                <option key={j.id} value={j.id}>{j.nombre}</option>
              ))}
            </select>
          </div>

          {/* Lugar */}
          <div>
            <label style={labelStyle}>Lugar</label>
            <input
              type="text"
              value={form.lugar}
              onChange={e => set('lugar', e.target.value)}
              placeholder="Ej: Lo de Chacho, Palermo"
              style={inputStyle}
            />
          </div>

          {/* Fecha comida */}
          <div>
            <label style={labelStyle}>Fecha de la comida</label>
            <input
              type="text"
              value={form.fecha_comida}
              onChange={e => set('fecha_comida', e.target.value)}
              placeholder="Ej: Sábado 15 de marzo"
              style={inputStyle}
            />
          </div>

          {/* Google Maps URL */}
          <div>
            <label style={labelStyle}>Link Google Maps (opcional)</label>
            <input
              type="url"
              value={form.google_maps_url}
              onChange={e => set('google_maps_url', e.target.value)}
              placeholder="https://maps.google.com/..."
              style={inputStyle}
            />
          </div>

          {/* Estado */}
          <div>
            <label style={labelStyle}>Estado</label>
            <select
              value={form.estado}
              onChange={e => set('estado', e.target.value)}
              style={inputStyle}
            >
              {ESTADOS.map(e => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>

          {/* Nota */}
          <div>
            <label style={labelStyle}>Nota (opcional)</label>
            <textarea
              value={form.nota}
              onChange={e => set('nota', e.target.value)}
              rows={2}
              placeholder="Ej: Reserva a nombre de Juan..."
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
            <button
              className="btn btn-primary btn-sm"
              style={{ fontSize: 12 }}
              onClick={guardar}
              disabled={saving}
            >
              {saving ? 'Guardando...' : '💾 Guardar'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 12 }}
              onClick={cancelar}
              disabled={saving}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      </div>

      {/* Modal de fotos */}
      {modalFotosAbierto && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000,
                   display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                   padding: '20px 12px', overflowY: 'auto' }}
          onClick={() => setModalFotosAbierto(false)}
        >
          <div
            style={{ background: 'var(--color-surface)', borderRadius: 10, padding: 20,
                     maxWidth: 560, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>📸 Fotos de la comida</span>
              <button
                onClick={() => setModalFotosAbierto(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--color-muted)', lineHeight: 1 }}
              >✕</button>
            </div>

            {fotos.length === 0 ? (
              <p style={{ color: 'var(--color-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                Sin fotos todavía.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                {fotos.map(f => (
                  <img
                    key={f.id}
                    src={f.url}
                    style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px' }}
                  />
                ))}
              </div>
            )}

            {puedeEditar && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 12 }}
                  onClick={handleSubirFoto}
                  disabled={subiendo}
                >
                  {subiendo ? 'Subiendo...' : '+ Agregar foto'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Modal de votación */}
      {modalVotoAbierto && (() => {
        const yoPuedoVotar = participantes?.jugadores?.some(
          j => j.user_id === user?.id && j.puede_votar
        )
        if (!yoPuedoVotar) return null
        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000,
                     display: 'flex', alignItems: 'center', justifyContent: 'center',
                     padding: '20px 12px' }}
            onClick={() => setModalVotoAbierto(false)}
          >
            <div
              style={{ background: 'var(--color-surface)', borderRadius: 10, padding: 24,
                       maxWidth: 360, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>🗳️ Tu votación</span>
                <button
                  onClick={() => setModalVotoAbierto(false)}
                  style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--color-muted)', lineHeight: 1 }}
                >✕</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {votacionConfig.map(item => (
                  <div key={item.nombre} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <label style={{ fontSize: 13, flex: 1, color: 'var(--color-text)' }}>
                      {item.nombre}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={votacionForm[item.nombre] ?? ''}
                      onChange={e => {
                        setVotacionForm(f => ({ ...f, [item.nombre]: e.target.value }))
                        setVotacionError('')
                      }}
                      style={{ width: 60, textAlign: 'center', fontSize: 14, padding: '5px 6px',
                               border: '1px solid var(--color-border)', borderRadius: 4 }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--color-muted)', minWidth: 28 }}>/10</span>
                  </div>
                ))}
              </div>

              {votacionError && (
                <div style={{ fontSize: 12, color: 'var(--color-danger)', marginBottom: 10 }}>
                  {votacionError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ fontSize: 13 }}
                  onClick={handleGuardarVotos}
                  disabled={savingVoto || comida?.votacion_estado === 'cerrada'}
                >
                  {savingVoto ? 'Guardando...' : '💾 Guardar votación'}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 13 }}
                  onClick={() => setModalVotoAbierto(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )
}
