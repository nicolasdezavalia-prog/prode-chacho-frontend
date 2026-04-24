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
  const [usuarios, setUsuarios] = useState([])
  const [saving, setSaving] = useState(null) // userId guardando
  const [error, setError] = useState(null)

  useEffect(() => {
    if (user?.role !== 'superadmin') {
      navigate('/')
      return
    }
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
    } catch (e) {
      setError('Error cargando datos')
    }
  }

  async function togglePermiso(userId, permiso, tieneActual) {
    const usuario = usuarios.find(u => u.id === userId)
    if (!usuario) return

    const nuevosPermisos = tieneActual
      ? usuario.permisos.filter(p => p !== permiso)
      : [...usuario.permisos, permiso]

    setSaving(userId)
    try {
      const res = await api.updatePermisosUsuario(userId, nuevosPermisos)
      setUsuarios(prev =>
        prev.map(u => u.id === userId ? { ...u, permisos: res.permisos } : u)
      )
    } catch (e) {
      setError('Error al guardar')
    } finally {
      setSaving(null)
    }
  }

  if (user?.role !== 'superadmin') return null

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 8 }}>Permisos por usuario</h2>
      <p style={{ color: '#666', marginBottom: 24, fontSize: 14 }}>
        Los admins con permisos específicos pueden ejecutar esas acciones. El superadmin siempre tiene acceso total.
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
              <th style={{ padding: '8px 12px', minWidth: 140 }}>Usuario</th>
              <th style={{ padding: '8px 12px', minWidth: 60 }}>Rol</th>
              {catalogo.map(p => (
                <th key={p} style={{ padding: '8px 12px', textAlign: 'center', minWidth: 90, fontSize: 12, color: '#555' }}>
                  {LABELS[p] || p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
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
                  const tiene = u.permisos.includes(p)
                  const isSaving = saving === u.id
                  return (
                    <td key={p} style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={tiene}
                        disabled={isSaving}
                        onChange={() => togglePermiso(u.id, p, tiene)}
                        style={{ width: 16, height: 16, cursor: isSaving ? 'wait' : 'pointer', accentColor: '#7c3aed' }}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={2 + catalogo.length} style={{ padding: 24, textAlign: 'center', color: '#888' }}>
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
