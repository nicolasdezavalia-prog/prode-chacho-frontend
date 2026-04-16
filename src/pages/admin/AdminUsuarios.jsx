import { useState, useEffect } from 'react'
import { useAuth } from '../../App.jsx'
import { api } from '../../api/index.js'

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

  const handleToggleRol = async (u) => {
    if (toggling[u.id]) return
    const nuevoRol = u.role === 'admin' ? 'user' : 'admin'
    const confirmar = window.confirm(
      `¿Cambiar rol de ${u.nombre} a ${nuevoRol === 'admin' ? 'ADMIN' : 'JUGADOR'}?`
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

  if (loading) return <div className="loading">Cargando...</div>

  return (
    <div>
      <div className="flex-between mb-16">
        <div className="page-title">Gestión de usuarios</div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Nombre</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Email</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Rol</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Acciones</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Magic link</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => {
              const esMismo = u.id === yo.id
              const linkData = links[u.id]
              return (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)', background: esMismo ? 'rgba(59,130,246,0.04)' : 'transparent' }}>
                  <td style={{ padding: '10px 12px', fontWeight: esMismo ? 700 : 400 }}>
                    {u.nombre}
                    {esMismo && <span style={{ fontSize: 11, color: 'var(--color-muted)', marginLeft: 6 }}>(vos)</span>}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--color-muted)', fontSize: 13 }}>{u.email}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: u.role === 'admin' ? 'rgba(59,130,246,0.12)' : 'var(--color-surface2)',
                      color: u.role === 'admin' ? 'var(--color-primary)' : 'var(--color-muted)',
                    }}>
                      {u.role === 'admin' ? 'ADMIN' : 'JUGADOR'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {!esMismo && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleToggleRol(u)}
                        disabled={toggling[u.id]}
                        style={{ minWidth: 130 }}
                      >
                        {toggling[u.id]
                          ? 'Guardando...'
                          : u.role === 'admin'
                            ? '↓ Quitar admin'
                            : '↑ Dar admin'
                        }
                      </button>
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
