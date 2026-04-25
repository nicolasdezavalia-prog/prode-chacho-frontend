import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../App.jsx'
import { api } from '../../api/index.js'

const LABELS = {
  crear_torneo:        'Crear torneo',
  editar_fecha:        'Editar fecha',
  cargar_resultados:   'Cargar resultados',
  editar_tabla_mensual:'Tabla mensual',
  gestionar_multas:    'Multas',
}

export default function AdminPermisos() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [catalogo, setCatalogo] = useState([])
  const [usuarios, setUsuarios] = useState([])       // estado guardado en servidor
  const [draft, setDraft] = useState({})             // { [userId]: [...permisos] } — cambios locales
  const [saving, setSaving] = useState(null)
  const [saved, setSaved] = useState(null)           // userId que acaba de guardar (para el ✓)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (user?.role !== 'superadmin') { navigate('/'); return }
    cargarDatos()
  }, [])

  async function cargarDatos() {
    try {
      const [cat, usrs] = await Promise.all([
        api.getPermisosCatalogo(),
        api.getUsuariosPermisos(),
      ])
      setCatalogo(cat.permisos)
      setUsuarios(usrs.usuarios)
      setDraft({})
    } catch (e) {
      setError('Error cargando datos')
    }
  }

  // Cambiar un checkbox → solo actualiza el draft local
  function toggleDraft(userId, permiso, tieneActual) {
    setDraft(prev => {
      const base = prev[userId] ?? usuarios.find(u => u.id === userId)?.permisos ?? []
      const nuevos = tieneActual
        ? base.filter(p => p !== permiso)
        : [...base, permiso]
      return { ...prev, [userId]: nuevos }
    })
    setSaved(null)
  }

  // Guardar los cambios del draft para un usuario
  async function guardarUsuario(userId) {
    const nuevosPermisos = draft[userId]
    if (!nuevosPermisos) return
    setSaving(userId)
    setError(null)
    try {
      const res = await api.updatePermisosUsuario(userId, nuevosPermisos)
      setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, permisos: res.permisos } : u))
      setDraft(prev => { const d = { ...prev }; delete d[userId]; return d })
      setSaved(userId)
      setTimeout(() => setSaved(null), 2000)
    } catch (e) {
      setError('Error al guardar')
    } finally {
      setSaving(null)
    }
  }

  // Descartar cambios del draft para un usuario
  function descartarUsuario(userId) {
    setDraft(prev => { const d = { ...prev }; delete d[userId]; return d })
  }

  if (user?.role !== 'superadmin') return null

  return (
    <div style={{ padding: '24px', maxWidth: 960, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 8 }}>Permisos por usuario</h2>
      <p style={{ color: '#666', marginBottom: 24, fontSize: 14 }}>
        Cambiá los permisos y presioná <strong>Guardar</strong> en la fila para confirmar. El superadmin siempre tiene acceso total.
      </p>

      {error && (
        <div style={{ background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: 6, marginBottom: 16 }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px', minWidth: 150 }}>Usuario</th>
              <th style={{ padding: '8px 12px', minWidth: 60 }}>Rol</th>
              {catalogo.map(p => (
                <th key={p} style={{ padding: '8px 12px', textAlign: 'center', minWidth: 90, fontSize: 12, color: '#555' }}>
                  {LABELS[p] || p}
                </th>
              ))}
              <th style={{ padding: '8px 12px', minWidth: 110 }}></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => {
              const permisosActuales = draft[u.id] ?? u.permisos
              const tieneCambios = !!draft[u.id]
              const isSaving = saving === u.id
              const isSaved = saved === u.id

              return (
                <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6', background: tieneCambios ? '#fdf9ff' : 'transparent' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ fontWeight: 500 }}>{u.nombre}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{u.email}</div>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ fontSize: 12, background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>
                      {u.role}
                    </span>
                  </td>
                  {catalogo.map(p => {
                    const tiene = permisosActuales.includes(p)
                    return (
                      <td key={p} style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={tiene}
                          disabled={isSaving}
                          onChange={() => toggleDraft(u.id, p, tiene)}
                          style={{ width: 16, height: 16, cursor: isSaving ? 'wait' : 'pointer', accentColor: '#7c3aed' }}
                        />
                      </td>
                    )
                  })}
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                    {isSaved && (
                      <span style={{ color: '#16a34a', fontSize: 13, fontWeight: 500 }}>✓ Guardado</span>
                    )}
                    {tieneCambios && !isSaving && (
                      <span style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => guardarUsuario(u.id)}
                          style={{ fontSize: 12, padding: '3px 10px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => descartarUsuario(u.id)}
                          style={{ fontSize: 12, padding: '3px 8px', background: 'none', color: '#888', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}
                        >
                          ✕
                        </button>
                      </span>
                    )}
                    {isSaving && (
                      <span style={{ color: '#888', fontSize: 12 }}>Guardando…</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={3 + catalogo.length} style={{ padding: 24, textAlign: 'center', color: '#888' }}>
                  No hay usuarios
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
