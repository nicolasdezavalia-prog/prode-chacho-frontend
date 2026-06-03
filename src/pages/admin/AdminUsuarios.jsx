import { useState, useEffect } from 'react'
import { useAuth } from '../../App.jsx'
import { api } from '../../api/index.js'

/**
 * Validación cliente — sincronizada con el backend (POST /api/usuarios).
 * Backend igual valida todo; estos checks son para feedback inmediato.
 */
const PASSWORD_MIN_LEN = 6
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function AdminUsuarios() {
  const { user: yo } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // { userId: { link, expires_at } }
  const [links, setLinks] = useState({})
  // { userId: true } para estados de carga individuales
  const [toggling, setToggling] = useState({})
  const [generando, setGenerando] = useState({})
  const [copiado, setCopiado] = useState({})

  // ── Alta de usuario ────────────────────────────────────────────────────
  const [mostrarAlta, setMostrarAlta] = useState(false)
  const [formAlta, setFormAlta]       = useState({ nombre: '', email: '', password: '' })
  const [creando, setCreando]         = useState(false)
  const [errorAlta, setErrorAlta]     = useState('')

  // ── Cambio de clave (inline por fila) ─────────────────────────────────
  // Estructura: cambioClave = { userId | null, password: '', error: '', ok: '' }
  // Solo una fila puede estar editando a la vez.
  const [cambioClave, setCambioClave] = useState({ userId: null, password: '', error: '' })
  const [cambiandoClave, setCambiandoClave] = useState(false)
  // { userId: timestamp } para mostrar flash verde "Clave actualizada" por un rato
  const [okClavePara, setOkClavePara] = useState({})

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      const data = await api.getUsuarios()
      setUsuarios(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const ROL_LABEL = { user: 'JUGADOR', admin: 'ADMIN', superadmin: 'SUPER' }
  const ROL_SIGUIENTE = { user: 'admin', admin: 'superadmin', superadmin: 'user' }
  const ROL_BTN = {
    user:       { label: '↑ Dar admin',    color: undefined },
    admin:      { label: '⬆ Dar super',   color: '#7c3aed' },
    superadmin: { label: '↓ Quitar admin', color: undefined },
  }

  // ── Handlers existentes ────────────────────────────────────────────────
  const handleToggleRol = async (u) => {
    if (toggling[u.id]) return
    const siguiente = ROL_SIGUIENTE[u.role] || 'user'
    const confirmar = window.confirm(
      `¿Cambiar rol de ${u.nombre} de ${ROL_LABEL[u.role]} a ${ROL_LABEL[siguiente]}?`
    )
    if (!confirmar) return
    setToggling(p => ({ ...p, [u.id]: true }))
    try {
      const updated = await api.toggleRolUsuario(u.id)
      setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, role: updated.role } : x))
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setToggling(p => ({ ...p, [u.id]: false }))
    }
  }

  const handleGenerarLink = async (u) => {
    if (generando[u.id]) return
    setGenerando(p => ({ ...p, [u.id]: true }))
    try {
      const data = await api.generarResetLink(u.id)
      setLinks(p => ({ ...p, [u.id]: data }))
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setGenerando(p => ({ ...p, [u.id]: false }))
    }
  }

  const handleCopiar = (userId, link) => {
    navigator.clipboard.writeText(link).then(() => {
      setCopiado(p => ({ ...p, [userId]: true }))
      setTimeout(() => setCopiado(p => ({ ...p, [userId]: false })), 2000)
    })
  }

  // ── Alta de usuario ────────────────────────────────────────────────────
  const handleAbrirAlta = () => {
    setMostrarAlta(true)
    setFormAlta({ nombre: '', email: '', password: '' })
    setErrorAlta('')
  }
  const handleCancelarAlta = () => {
    if (creando) return
    setMostrarAlta(false)
    setErrorAlta('')
    setFormAlta({ nombre: '', email: '', password: '' })
  }
  const handleSubmitAlta = async (e) => {
    e.preventDefault()
    if (creando) return
    setErrorAlta('')
    // Validación cliente (espejo del backend para feedback inmediato)
    const nombre = (formAlta.nombre || '').trim()
    const email  = (formAlta.email || '').trim().toLowerCase()
    const pass   = formAlta.password || ''
    if (!nombre)                       { setErrorAlta('Nombre requerido.'); return }
    if (!EMAIL_RE.test(email))         { setErrorAlta('Email inválido.'); return }
    if (pass.length < PASSWORD_MIN_LEN) {
      setErrorAlta(`La contraseña debe tener al menos ${PASSWORD_MIN_LEN} caracteres.`); return
    }
    setCreando(true)
    try {
      const nuevo = await api.createUsuario({ nombre, email, password: pass })
      // Rol default 'user' (JUGADOR) — no enviamos `role` al backend.
      setUsuarios(prev => [...prev, nuevo].sort((a, b) =>
        (a.nombre || '').localeCompare(b.nombre || '', 'es')))
      setMostrarAlta(false)
      setFormAlta({ nombre: '', email: '', password: '' })
    } catch (err) {
      setErrorAlta(err.message)
    } finally {
      setCreando(false)
    }
  }

  // ── Cambio de clave inline ─────────────────────────────────────────────
  const handleAbrirCambioClave = (userId) => {
    setCambioClave({ userId, password: '', error: '' })
  }
  const handleCancelarCambioClave = () => {
    if (cambiandoClave) return
    setCambioClave({ userId: null, password: '', error: '' })
  }
  const handleSubmitCambioClave = async (u) => {
    if (cambiandoClave) return
    const pass = cambioClave.password || ''
    if (pass.length < PASSWORD_MIN_LEN) {
      setCambioClave(c => ({ ...c, error: `Mínimo ${PASSWORD_MIN_LEN} caracteres.` }))
      return
    }
    const confirmar = window.confirm(
      `¿Cambiar la clave de ${u.nombre}? La nueva tiene ${pass.length} caracteres.`
    )
    if (!confirmar) return
    setCambiandoClave(true)
    try {
      await api.cambiarPasswordUsuario(u.id, pass)
      setCambioClave({ userId: null, password: '', error: '' })
      setOkClavePara(p => ({ ...p, [u.id]: Date.now() }))
      setTimeout(() => {
        setOkClavePara(p => {
          const next = { ...p }; delete next[u.id]; return next
        })
      }, 3500)
      // También invalidamos cualquier link mostrado, porque el backend lo invalida.
      setLinks(p => {
        const next = { ...p }; delete next[u.id]; return next
      })
    } catch (e) {
      setCambioClave(c => ({ ...c, error: e.message }))
    } finally {
      setCambiandoClave(false)
    }
  }

  if (loading) return <div className="loading">Cargando...</div>

  return (
    <div>
      <div className="flex-between mb-16">
        <div className="page-title">Gestión de usuarios</div>
        {!mostrarAlta && (
          <button className="btn btn-primary btn-sm" onClick={handleAbrirAlta}>
            + Nuevo usuario
          </button>
        )}
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* Form de alta de usuario */}
      {mostrarAlta && (
        <form
          onSubmit={handleSubmitAlta}
          className="card"
          style={{ marginBottom: 16 }}
        >
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
            Nuevo usuario (rol <strong>JUGADOR</strong>)
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 10, marginBottom: 12,
          }}>
            <div>
              <label style={labelStyle}>Nombre visible</label>
              <input
                type="text"
                value={formAlta.nombre}
                onChange={e => setFormAlta(f => ({ ...f, nombre: e.target.value }))}
                disabled={creando}
                style={inputStyle}
                placeholder="Ej: Juan Pérez"
                autoFocus
              />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={formAlta.email}
                onChange={e => setFormAlta(f => ({ ...f, email: e.target.value }))}
                disabled={creando}
                style={inputStyle}
                placeholder="juan@ejemplo.com"
                autoComplete="off"
              />
            </div>
            <div>
              <label style={labelStyle}>Contraseña inicial</label>
              <input
                type="password"
                value={formAlta.password}
                onChange={e => setFormAlta(f => ({ ...f, password: e.target.value }))}
                disabled={creando}
                style={inputStyle}
                placeholder={`Mínimo ${PASSWORD_MIN_LEN} caracteres`}
                autoComplete="new-password"
              />
            </div>
          </div>
          {errorAlta && (
            <div className="error-msg" style={{ marginBottom: 8, fontSize: 13 }}>{errorAlta}</div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCancelarAlta}
              disabled={creando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={creando}
            >
              {creando ? 'Creando...' : 'Crear usuario'}
            </button>
          </div>
        </form>
      )}

      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
              <th style={thStyle}>Nombre</th>
              <th style={thStyle}>Email</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Rol</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Acciones</th>
              <th style={thStyle}>Magic link</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => {
              const esMismo    = u.id === yo.id
              const linkData   = links[u.id]
              const editandoClave = cambioClave.userId === u.id
              const okClave    = okClavePara[u.id]
              return (
                <tr key={u.id} style={{
                  borderBottom: '1px solid var(--color-border)',
                  background: esMismo ? 'rgba(59,130,246,0.04)' : 'transparent',
                }}>
                  <td style={{ padding: '10px 12px', fontWeight: esMismo ? 700 : 400 }}>
                    {u.nombre}
                    {esMismo && <span style={{ fontSize: 11, color: 'var(--color-muted)', marginLeft: 6 }}>(vos)</span>}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--color-muted)', fontSize: 13 }}>{u.email}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: u.role === 'superadmin' ? 'rgba(124,58,237,0.12)' : u.role === 'admin' ? 'rgba(59,130,246,0.12)' : 'var(--color-surface2)',
                      color: u.role === 'superadmin' ? '#7c3aed' : u.role === 'admin' ? 'var(--color-primary)' : 'var(--color-muted)',
                    }}>
                      {ROL_LABEL[u.role] || u.role}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {editandoClave ? (
                      // Modo cambiar clave: input + Guardar + Cancelar.
                      // Reemplaza temporalmente los botones de rol y cambiar clave.
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
                        <input
                          type="password"
                          value={cambioClave.password}
                          onChange={e => setCambioClave(c => ({ ...c, password: e.target.value, error: '' }))}
                          disabled={cambiandoClave}
                          style={{ ...inputStyle, fontSize: 12, padding: '4px 8px' }}
                          placeholder={`Nueva clave (mín ${PASSWORD_MIN_LEN})`}
                          autoFocus
                          autoComplete="new-password"
                        />
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={handleCancelarCambioClave}
                            disabled={cambiandoClave}
                            style={{ fontSize: 11 }}
                          >
                            Cancelar
                          </button>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleSubmitCambioClave(u)}
                            disabled={cambiandoClave}
                            style={{ fontSize: 11 }}
                          >
                            {cambiandoClave ? 'Guardando...' : 'Guardar'}
                          </button>
                        </div>
                        {cambioClave.error && (
                          <div style={{ fontSize: 11, color: 'var(--color-danger)' }}>{cambioClave.error}</div>
                        )}
                      </div>
                    ) : (
                      // Modo normal: botones rol + cambiar clave
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                        {!esMismo && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleToggleRol(u)}
                            disabled={toggling[u.id]}
                            style={{ minWidth: 130, color: toggling[u.id] ? undefined : ROL_BTN[u.role]?.color }}
                          >
                            {toggling[u.id] ? 'Guardando...' : (ROL_BTN[u.role]?.label || '↑ Cambiar rol')}
                          </button>
                        )}
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleAbrirCambioClave(u.id)}
                          style={{ minWidth: 130, fontSize: 11 }}
                          title="Cambiar la contraseña de este usuario"
                        >
                          🔑 Cambiar clave
                        </button>
                        {okClave && (
                          <span style={{ fontSize: 11, color: 'var(--color-success)' }}>
                            ✓ Clave actualizada
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {!linkData ? (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleGenerarLink(u)}
                        disabled={generando[u.id]}
                      >
                        {generando[u.id] ? 'Generando...' : '🔗 Generar link'}
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          readOnly
                          value={linkData.link}
                          onClick={e => e.target.select()}
                          style={{
                            flex: 1, fontSize: 11, padding: '4px 7px',
                            border: '1px solid var(--color-border)', borderRadius: 4,
                            background: 'var(--color-surface2)', color: 'var(--color-text)',
                            fontFamily: 'monospace', minWidth: 0, width: 220,
                          }}
                        />
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleCopiar(u.id, linkData.link)}
                          style={{ flexShrink: 0 }}
                        >
                          {copiado[u.id] ? '✅' : '📋'}
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleGenerarLink(u)}
                          disabled={generando[u.id]}
                          title="Generar nuevo link (invalida el anterior)"
                          style={{ flexShrink: 0 }}
                        >
                          🔄
                        </button>
                      </div>
                    )}
                    {linkData && (
                      <div style={{ fontSize: 10, color: 'var(--color-muted)', marginTop: 2 }}>
                        Expira: {new Date(linkData.expires_at).toLocaleString('es-AR')}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Estilos compartidos ────────────────────────────────────────────────
const thStyle = {
  padding: '8px 12px',
  textAlign: 'left',
  fontSize: 12,
  color: 'var(--color-muted)',
  fontWeight: 600,
  textTransform: 'uppercase',
}
const labelStyle = {
  display: 'block',
  fontSize: 11,
  color: 'var(--color-muted)',
  marginBottom: 3,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}
const inputStyle = {
  width: '100%',
  padding: '6px 10px',
  fontSize: 13,
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  background: 'white',
  outline: 'none',
}
