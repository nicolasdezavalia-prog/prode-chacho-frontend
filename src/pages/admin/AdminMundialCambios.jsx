/**
 * AdminMundialCambios — Fase 5
 *
 * Tab Cambios del AdminMundialHub. Gestión completa de ventanas de cambios
 * post-grupos:
 *   - Crear ventana (cerrada por default).
 *   - Editar nombre/costo/cupo si está cerrada.
 *   - Abrir / cerrar / publicar.
 *   - Habilitar / deshabilitar usuarios (warning si tienen cambios cargados).
 *   - Ver historial de cambios cargados (auditoría).
 *
 * Props:
 *   torneoId  — id del torneo Mundial.
 *   estado    — estado actual del torneo. Las acciones admin no dependen del
 *               estado del torneo a nivel UI (lo gobiernan los endpoints).
 *               Mostramos un banner contextual si el torneo no está en
 *               'cambios_abiertos' para que el admin sepa que la ventana,
 *               aunque abierta, no permite carga por parte del user.
 *   onChanged — callback opcional cuando algo cambia.
 */

import { useEffect, useState, useMemo } from 'react'
import { api } from '../../api/index.js'

const VENTANA_LABEL = {
  cerrada:   'Cerrada',
  abierta:   'Abierta',
  publicada: 'Publicada',
}

const VENTANA_COLOR = {
  cerrada:   { bg: 'rgba(0,0,0,0.06)',        fg: 'var(--color-muted)' },
  abierta:   { bg: 'rgba(22,163,74,0.12)',    fg: 'var(--color-success)' },
  publicada: { bg: 'rgba(124,58,237,0.14)',   fg: '#7c3aed' },
}

const ESTADOS_USER_CARGA_ACTIVA = new Set(['cambios_abiertos'])

export default function AdminMundialCambios({ torneoId, estado, onChanged }) {
  const [ventanas, setVentanas]   = useState([])
  const [usuarios, setUsuarios]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [info, setInfo]           = useState('')
  // Estado por ventana: { [id]: { habilitados, expandido, cargandoHabilitados, cambios, cargandoCambios } }
  const [perVentana, setPerVentana] = useState({})
  // Form de alta nueva ventana
  const [mostrarAlta, setMostrarAlta] = useState(false)
  const [formAlta, setFormAlta] = useState({ nombre: '', costo_usd: '', cambios_por_usuario: '' })
  const [creando, setCreando] = useState(false)
  // Tracking de operaciones en curso
  const [accionando, setAccionando] = useState({}) // { ventanaId: true }
  // Sprint editar-ventana (2026-06-27): edición inline. Una sola ventana en
  // edición a la vez. Form preinicializado con valores actuales al abrir.
  const [editandoId, setEditandoId] = useState(null)
  const [formEdit, setFormEdit]     = useState({ nombre: '', costo_usd: '', cambios_por_usuario: '' })
  const [guardandoEdit, setGuardandoEdit] = useState(false)

  useEffect(() => { load() /* eslint-disable-next-line */ }, [torneoId])

  async function load() {
    setLoading(true)
    setError(''); setInfo('')
    try {
      const [vts, us] = await Promise.all([
        api.getMundialVentanas(torneoId),
        api.getUsuarios().catch(() => []),
      ])
      setVentanas(Array.isArray(vts) ? vts : [])
      setUsuarios(Array.isArray(us) ? us : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const hayAbierta = useMemo(() => ventanas.some(v => v.estado === 'abierta'), [ventanas])

  function setVentanaState(ventanaId, patch) {
    setPerVentana(prev => ({
      ...prev,
      [ventanaId]: { ...(prev[ventanaId] || {}), ...patch },
    }))
  }

  async function loadHabilitados(ventanaId) {
    setVentanaState(ventanaId, { cargandoHabilitados: true })
    try {
      const list = await api.getMundialVentanaHabilitados(torneoId, ventanaId)
      setVentanaState(ventanaId, { habilitados: Array.isArray(list) ? list : [] })
    } catch (e) {
      setError(e.message)
    } finally {
      setVentanaState(ventanaId, { cargandoHabilitados: false })
    }
  }

  async function loadCambios(ventanaId) {
    setVentanaState(ventanaId, { cargandoCambios: true })
    try {
      const list = await api.getMundialVentanaCambios(torneoId, ventanaId)
      setVentanaState(ventanaId, { cambios: Array.isArray(list) ? list : [] })
    } catch (e) {
      setError(e.message)
    } finally {
      setVentanaState(ventanaId, { cargandoCambios: false })
    }
  }

  // ── Acciones de ventana ──────────────────────────────────────────────
  async function handleCrearVentana(e) {
    e?.preventDefault?.()
    if (creando) return
    setCreando(true)
    setError(''); setInfo('')
    try {
      const body = {}
      if (formAlta.nombre.trim()) body.nombre = formAlta.nombre.trim()
      if (formAlta.costo_usd !== '') body.costo_usd = parseInt(formAlta.costo_usd, 10)
      if (formAlta.cambios_por_usuario !== '') body.cambios_por_usuario = parseInt(formAlta.cambios_por_usuario, 10)
      await api.createMundialVentana(torneoId, body)
      setMostrarAlta(false)
      setFormAlta({ nombre: '', costo_usd: '', cambios_por_usuario: '' })
      setInfo('Ventana creada.')
      await load()
      onChanged?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setCreando(false)
    }
  }

  // Sprint editar-ventana (2026-06-27)
  function abrirEdicion(v) {
    setEditandoId(v.id)
    setFormEdit({
      nombre: v.nombre || '',
      costo_usd: String(v.costo_usd ?? ''),
      cambios_por_usuario: String(v.cambios_por_usuario ?? ''),
    })
    setError(''); setInfo('')
  }
  function cancelarEdicion() {
    setEditandoId(null)
    setFormEdit({ nombre: '', costo_usd: '', cambios_por_usuario: '' })
  }
  async function handleGuardarEdicion(e, ventana) {
    e?.preventDefault?.()
    if (guardandoEdit) return
    setGuardandoEdit(true)
    setError(''); setInfo('')
    try {
      const body = {}
      const n = formEdit.nombre.trim()
      if (n.length === 0) {
        setError('Nombre no puede ser vacío.')
        setGuardandoEdit(false); return
      }
      if (n !== (ventana.nombre || '')) body.nombre = n
      if (formEdit.costo_usd !== '' && parseInt(formEdit.costo_usd, 10) !== ventana.costo_usd) {
        body.costo_usd = parseInt(formEdit.costo_usd, 10)
      }
      if (formEdit.cambios_por_usuario !== '' && parseInt(formEdit.cambios_por_usuario, 10) !== ventana.cambios_por_usuario) {
        body.cambios_por_usuario = parseInt(formEdit.cambios_por_usuario, 10)
      }
      if (Object.keys(body).length === 0) {
        setInfo('Sin cambios para guardar.')
        cancelarEdicion()
        setGuardandoEdit(false); return
      }
      // Warning si baja el cupo por debajo de lo ya cargado por algún user.
      if (body.cambios_por_usuario !== undefined && ventana.estado === 'abierta' && ventana.total_cambios > 0) {
        const ok = window.confirm(
          `Vas a cambiar el cupo a ${body.cambios_por_usuario}.\n\n` +
          `Hay ${ventana.users_con_cambios} usuario(s) con ${ventana.total_cambios} cambio(s) cargados.\n` +
          `Si bajaste el cupo por debajo de lo que algún user ya usó, el badge le mostrará exceso ` +
          `(pero el back rechaza nuevas cargas correctamente). Los cambios ya guardados NO se borran.\n\n` +
          `¿Confirmar?`
        )
        if (!ok) { setGuardandoEdit(false); return }
      }
      await api.updateMundialVentana(torneoId, ventana.id, body)
      setInfo(`Ventana #${ventana.id} actualizada.`)
      cancelarEdicion()
      await load()
      onChanged?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardandoEdit(false)
    }
  }

  async function handleCambiarEstadoVentana(ventana, nuevo) {
    if (accionando[ventana.id]) return
    const confirma = nuevo === 'cerrada' && ventana.estado === 'abierta'
      ? window.confirm('¿Cerrar la ventana? Los usuarios no van a poder cargar más cambios hasta que la vuelvas a abrir.')
      : true
    if (!confirma) return
    setAccionando(p => ({ ...p, [ventana.id]: true }))
    setError(''); setInfo('')
    try {
      await api.updateMundialVentana(torneoId, ventana.id, { estado: nuevo })
      setInfo(`Ventana #${ventana.id} ${nuevo === 'abierta' ? 'abierta' : 'cerrada'}.`)
      await load()
      onChanged?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setAccionando(p => ({ ...p, [ventana.id]: false }))
    }
  }

  async function handlePublicar(ventana) {
    if (accionando[ventana.id]) return
    const ok = window.confirm(
      `Publicar la ventana "${ventana.nombre}".\n\n` +
      `Esta acción ES IRREVERSIBLE:\n` +
      `- Pisa mundial_respuestas_usuario con la respuesta nueva de cada cambio.\n` +
      `- Marca los cambios como publicados.\n` +
      `- Cierra la ventana definitivamente.\n` +
      `- Los cambios de usuarios deshabilitados NO se aplican.\n\n` +
      `¿Continuar?`
    )
    if (!ok) return
    setAccionando(p => ({ ...p, [ventana.id]: true }))
    setError(''); setInfo('')
    try {
      const r = await api.publicarMundialVentana(torneoId, ventana.id)
      setInfo(`Ventana publicada. Aplicados: ${r.publicados} · No aplicados: ${r.no_publicados}.`)
      await load()
      // Refresh sub-listas si estaba expandida
      const sub = perVentana[ventana.id]
      if (sub?.expandido) {
        await loadHabilitados(ventana.id)
        await loadCambios(ventana.id)
      }
      onChanged?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setAccionando(p => ({ ...p, [ventana.id]: false }))
    }
  }

  async function handleHabilitarUser(ventana, userId) {
    if (!userId) return
    setError(''); setInfo('')
    try {
      await api.habilitarMundialUser(torneoId, ventana.id, parseInt(userId, 10))
      setInfo('Usuario habilitado.')
      await loadHabilitados(ventana.id)
      await load() // refresca el count habilitados_count
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleDeshabilitarUser(ventana, h) {
    const cargados = h.cambios_cargados || 0
    if (cargados > 0) {
      const ok = window.confirm(
        `${h.nombre} tiene ${cargados} cambio(s) cargado(s) en esta ventana.\n\n` +
        `Si lo deshabilitás, esos cambios quedan en DB pero NO se aplicarán al publicar.\n\n` +
        `¿Deshabilitar igual?`
      )
      if (!ok) return
    } else {
      if (!window.confirm(`Deshabilitar a ${h.nombre} de esta ventana?`)) return
    }
    setError(''); setInfo('')
    try {
      const r = await api.deshabilitarMundialUser(torneoId, ventana.id, h.user_id)
      setInfo(`${h.nombre} deshabilitado. Cambios no aplicables: ${r.cambios_cargados_no_publicables ?? 0}.`)
      await loadHabilitados(ventana.id)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  function toggleExpandida(ventanaId) {
    const sub = perVentana[ventanaId]
    const expandido = !sub?.expandido
    setVentanaState(ventanaId, { expandido })
    if (expandido) {
      loadHabilitados(ventanaId)
      loadCambios(ventanaId)
    }
  }

  if (loading) return <div className="loading">Cargando ventanas...</div>

  return (
    <div>
      {/* Banner contextual: torneo en cambios_abiertos vs no */}
      {!ESTADOS_USER_CARGA_ACTIVA.has(estado) && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(234,179,8,0.10)',
          color: '#a16207',
          borderRadius: 8, marginBottom: 12, fontSize: 13, lineHeight: 1.45,
          border: '1px solid rgba(234,179,8,0.25)',
        }}>
          ℹ️ El torneo está en estado <strong>{estado}</strong>. Para que los usuarios
          puedan cargar cambios desde su pantalla, el torneo debe estar en{' '}
          <strong>cambios_abiertos</strong>. Podés crear/configurar ventanas igual,
          pero la carga del user se gatilla por el estado del torneo.
        </div>
      )}

      {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}
      {info && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(22,163,74,0.10)', color: 'var(--color-success)',
          borderRadius: 6, marginBottom: 12, fontSize: 13,
        }}>
          {info}
        </div>
      )}

      {/* Botón + Form alta ventana */}
      <div style={{ marginBottom: 16 }}>
        {!mostrarAlta && (
          <button className="btn btn-primary btn-sm" onClick={() => setMostrarAlta(true)}>
            + Nueva ventana
          </button>
        )}
        {mostrarAlta && (
          <form onSubmit={handleCrearVentana} className="card" style={{ padding: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Nueva ventana de cambios</div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 10, marginBottom: 10,
            }}>
              <div>
                <label style={labelStyle}>Nombre (opcional)</label>
                <input
                  type="text"
                  value={formAlta.nombre}
                  onChange={e => setFormAlta(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Cambios post-grupos"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Costo USD por cambio (opcional)</label>
                <input
                  type="number" min="0" step="1"
                  value={formAlta.costo_usd}
                  onChange={e => setFormAlta(f => ({ ...f, costo_usd: e.target.value }))}
                  placeholder="Default config"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Cambios por usuario (opcional)</label>
                <input
                  type="number" min="0" step="1"
                  value={formAlta.cambios_por_usuario}
                  onChange={e => setFormAlta(f => ({ ...f, cambios_por_usuario: e.target.value }))}
                  placeholder="Default config"
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMostrarAlta(false)} disabled={creando}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={creando}>
                {creando ? 'Creando...' : 'Crear ventana'}
              </button>
            </div>
          </form>
        )}
        {hayAbierta && (
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 6 }}>
            Hay una ventana abierta. MVP: solo una a la vez por torneo.
          </div>
        )}
      </div>

      {/* Lista de ventanas */}
      {ventanas.length === 0 ? (
        <div style={{
          padding: '24px', textAlign: 'center',
          background: 'rgba(0,0,0,0.03)', color: 'var(--color-muted)',
          borderRadius: 8, fontSize: 14,
        }}>
          No hay ventanas creadas todavía.
        </div>
      ) : (
        ventanas.map(v => {
          const sub = perVentana[v.id] || {}
          const expandido = !!sub.expandido
          const color = VENTANA_COLOR[v.estado] || VENTANA_COLOR.cerrada
          const esPublicada = v.estado === 'publicada'
          return (
            <div key={v.id} className="card" style={{ marginBottom: 12, padding: 14 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 99,
                  background: color.bg, color: color.fg, whiteSpace: 'nowrap',
                }}>
                  {VENTANA_LABEL[v.estado] || v.estado}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{v.nombre} <span style={{ color: 'var(--color-muted)', fontWeight: 400, fontSize: 12 }}>#{v.id}</span></div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                    Costo: USD {v.costo_usd} · Cupo: {v.cambios_por_usuario} por user ·{' '}
                    {v.habilitados_count} habilitados · {v.users_con_cambios} con cambios ({v.total_cambios} total)
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {v.estado === 'cerrada' && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleCambiarEstadoVentana(v, 'abierta')}
                      disabled={accionando[v.id] || hayAbierta}
                      title={hayAbierta ? 'Ya hay otra ventana abierta. Cerrala antes de abrir esta.' : 'Abrir esta ventana'}
                    >
                      Abrir
                    </button>
                  )}
                  {v.estado === 'abierta' && (
                    <>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleCambiarEstadoVentana(v, 'cerrada')}
                        disabled={accionando[v.id]}
                      >
                        Cerrar
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handlePublicar(v)}
                        disabled={accionando[v.id]}
                        style={{ background: '#7c3aed' }}
                      >
                        Publicar
                      </button>
                    </>
                  )}
                  {v.estado === 'cerrada' && v.total_cambios > 0 && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handlePublicar(v)}
                      disabled={accionando[v.id]}
                      style={{ background: '#7c3aed' }}
                      title="Publicar sin re-abrir. Cambios cargados se aplican."
                    >
                      Publicar
                    </button>
                  )}
                  {/* Sprint editar-ventana (2026-06-27): editable salvo publicada */}
                  {!esPublicada && editandoId !== v.id && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => abrirEdicion(v)}
                      disabled={accionando[v.id]}
                      title="Editar nombre, costo y cupo"
                    >
                      ✏️ Editar
                    </button>
                  )}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => toggleExpandida(v.id)}
                  >
                    {expandido ? '▲ Cerrar' : '▼ Detalle'}
                  </button>
                </div>
              </div>

              {editandoId === v.id && (
                <form
                  onSubmit={e => handleGuardarEdicion(e, v)}
                  style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--color-border)' }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 8, letterSpacing: '0.04em' }}>
                    Editar ventana
                    {v.estado === 'abierta' && (
                      <span style={{ marginLeft: 8, fontSize: 11, color: '#a16207', textTransform: 'none', fontWeight: 500 }}>
                        ⚠️ Ventana abierta — cambios afectan a users en vivo
                      </span>
                    )}
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 10, marginBottom: 10,
                  }}>
                    <div>
                      <label style={labelStyle}>Nombre</label>
                      <input
                        type="text"
                        value={formEdit.nombre}
                        onChange={e => setFormEdit(f => ({ ...f, nombre: e.target.value }))}
                        style={inputStyle}
                        autoFocus
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Costo USD por cambio</label>
                      <input
                        type="number" min="0" step="1"
                        value={formEdit.costo_usd}
                        onChange={e => setFormEdit(f => ({ ...f, costo_usd: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Cambios por usuario</label>
                      <input
                        type="number" min="0" step="1"
                        value={formEdit.cambios_por_usuario}
                        onChange={e => setFormEdit(f => ({ ...f, cambios_por_usuario: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={cancelarEdicion} disabled={guardandoEdit}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={guardandoEdit}>
                      {guardandoEdit ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </form>
              )}

              {expandido && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--color-border)' }}>
                  <PanelHabilitados
                    ventana={v}
                    usuarios={usuarios}
                    sub={sub}
                    onHabilitar={uid => handleHabilitarUser(v, uid)}
                    onDeshabilitar={h => handleDeshabilitarUser(v, h)}
                    bloqueado={esPublicada}
                  />
                  <PanelHistorial sub={sub} />
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────

function PanelHabilitados({ ventana, usuarios, sub, onHabilitar, onDeshabilitar, bloqueado }) {
  const [sel, setSel] = useState('')
  const habilitados = sub.habilitados || []
  const idsHab = new Set(habilitados.map(h => h.user_id))
  const usersDisponibles = usuarios.filter(u => !idsHab.has(u.id))

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 8, letterSpacing: '0.04em' }}>
        Habilitados
      </div>
      {sub.cargandoHabilitados ? (
        <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>Cargando...</div>
      ) : habilitados.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--color-muted)', fontStyle: 'italic', marginBottom: 8 }}>
          Sin usuarios habilitados todavía.
        </div>
      ) : (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8,
          border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden',
        }}>
          {habilitados.map(h => (
            <div key={h.user_id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 10px', fontSize: 13,
              borderTop: '1px solid rgba(0,0,0,0.04)',
            }}>
              <span style={{ flex: 1, fontWeight: 500 }}>{h.nombre}</span>
              <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{h.email}</span>
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: h.cambios_cargados > 0 ? 'var(--color-primary)' : 'var(--color-muted)',
                background: h.cambios_cargados > 0 ? 'rgba(59,130,246,0.10)' : 'rgba(0,0,0,0.04)',
                padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap',
              }}>
                {h.cambios_cargados} cambio{h.cambios_cargados === 1 ? '' : 's'}
              </span>
              {!bloqueado && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onDeshabilitar(h)}
                  style={{ fontSize: 11 }}
                  title="Deshabilitar usuario de esta ventana"
                >
                  Deshabilitar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {!bloqueado && (
        <div style={{ display: 'flex', gap: 6 }}>
          <select
            value={sel}
            onChange={e => setSel(e.target.value)}
            style={{
              flex: 1, padding: '6px 10px', fontSize: 13,
              border: '1px solid var(--color-border)', borderRadius: 6,
              background: 'white',
            }}
          >
            <option value="">— Habilitar usuario —</option>
            {usersDisponibles.map(u => (
              <option key={u.id} value={u.id}>
                {u.nombre} ({u.email})
              </option>
            ))}
          </select>
          <button
            className="btn btn-primary btn-sm"
            disabled={!sel}
            onClick={() => { onHabilitar(sel); setSel('') }}
          >
            + Habilitar
          </button>
        </div>
      )}
    </div>
  )
}

function PanelHistorial({ sub }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 8, letterSpacing: '0.04em' }}>
        Historial de cambios cargados
      </div>
      {sub.cargandoCambios ? (
        <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>Cargando...</div>
      ) : !sub.cambios || sub.cambios.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--color-muted)', fontStyle: 'italic' }}>
          Sin cambios cargados en esta ventana.
        </div>
      ) : (
        <div style={{
          border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden',
          fontSize: 12,
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.03)' }}>
                <th style={cellTh}>Usuario</th>
                <th style={cellTh}>#</th>
                <th style={cellTh}>Pregunta</th>
                <th style={cellTh}>Anterior → Nueva</th>
                <th style={{ ...cellTh, textAlign: 'right' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {sub.cambios.map(c => (
                <tr key={c.id} style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                  <td style={cellTd}>{c.user_nombre}</td>
                  <td style={cellTd}>#{c.pregunta_numero}</td>
                  <td style={{ ...cellTd, color: 'var(--color-muted)' }}>{c.pregunta_enunciado}</td>
                  <td style={{ ...cellTd, fontFamily: 'monospace', fontSize: 11 }}>
                    <span style={{ color: 'var(--color-muted)' }}>{compactJson(c.respuesta_anterior_json)}</span>
                    {' → '}
                    <strong>{compactJson(c.respuesta_nueva_json)}</strong>
                  </td>
                  <td style={{ ...cellTd, textAlign: 'right' }}>
                    {c.publicado === 1 ? (
                      <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>✓ Publicado</span>
                    ) : (
                      <span style={{ color: 'var(--color-muted)' }}>Pendiente</span>
                    )}
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

// ── Helpers ────────────────────────────────────────────────────────────

function compactJson(jsonStr) {
  if (!jsonStr) return '∅'
  try {
    const obj = JSON.parse(jsonStr)
    if (obj && typeof obj === 'object') {
      const entries = Object.entries(obj)
      if (entries.length === 0) return '∅'
      return entries.map(([k, v]) => `${k}=${Array.isArray(v) ? `[${v.join(',')}]` : v}`).join(' ')
    }
    return String(obj)
  } catch {
    return jsonStr.length > 40 ? jsonStr.slice(0, 38) + '...' : jsonStr
  }
}

const labelStyle = {
  display: 'block', fontSize: 11, color: 'var(--color-muted)',
  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3,
}
const inputStyle = {
  width: '100%', padding: '6px 10px', fontSize: 13,
  border: '1px solid var(--color-border)', borderRadius: 6, background: 'white',
}
const cellTh = {
  padding: '6px 8px', textAlign: 'left',
  fontSize: 11, fontWeight: 700, color: 'var(--color-muted)',
  textTransform: 'uppercase', letterSpacing: '0.04em',
}
const cellTd = {
  padding: '6px 8px', verticalAlign: 'top',
}
