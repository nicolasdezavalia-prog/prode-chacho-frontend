/**
 * AccountMenu — dropdown de cuenta en la navbar.
 *
 * UI:
 *   Botón trigger (nombre + badge rol + chevron ▼) → dropdown con:
 *     - Mi cuenta
 *     - Cambiar contraseña
 *     - Cambiar email
 *     - Salir
 *   Click en una opción de cuenta/password/email → modal inline.
 *
 * Backend:
 *   - GET /api/auth/me
 *   - PATCH /api/auth/me/password { current_password, new_password }
 *   - PATCH /api/auth/me/email    { new_email, current_password }
 *
 * Al cambiar email, el backend devuelve token + user nuevos. Pisamos la
 * sesión via useAuth().login() para que el JWT persistido tenga el nuevo
 * email en el payload.
 */

import { useState, useRef, useEffect } from 'react'
import { api } from '../api/index.js'
import { useAuth } from '../App.jsx'

const ROL_LABEL = { user: 'JUGADOR', admin: 'ADMIN', superadmin: 'SUPER' }

export default function AccountMenu({ onLogout }) {
  const { user, login } = useAuth()
  const [open, setOpen] = useState(false)
  // Modal activo: null | 'cuenta' | 'password' | 'email'
  const [modal, setModal] = useState(null)
  const triggerRef = useRef(null)
  const dropdownRef = useRef(null)

  // Cierra el dropdown al click fuera.
  useEffect(() => {
    function handle(e) {
      if (
        triggerRef.current  && !triggerRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const isSuperAdmin = user?.role === 'superadmin'
  const isAdmin      = user?.role === 'admin' || isSuperAdmin

  function abrirModal(nombre) {
    setOpen(false)
    setModal(nombre)
  }

  return (
    <>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button
          ref={triggerRef}
          onClick={() => setOpen(o => !o)}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
            cursor: 'pointer',
            color: '#ffffff',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px',
            fontSize: 13,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
          title="Cuenta"
        >
          <span style={{ fontWeight: 500 }}>{user?.nombre}</span>
          <span style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 99, fontWeight: 700,
            background: isSuperAdmin ? 'rgba(124,58,237,0.18)' :
                        isAdmin      ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.10)',
            color:      isSuperAdmin ? '#a78bfa' :
                        isAdmin      ? '#93c5fd' : '#d4d4d8',
            whiteSpace: 'nowrap',
          }}>
            {ROL_LABEL[user?.role] || user?.role}
          </span>
          <span style={{ fontSize: 9, opacity: 0.7 }}>{open ? '▲' : '▼'}</span>
        </button>

        {open && (
          <div
            ref={dropdownRef}
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              minWidth: 200,
              zIndex: 600,
              overflow: 'hidden',
            }}
          >
            <MenuItem onClick={() => abrirModal('cuenta')}   icon="👤" label="Mi cuenta" />
            <MenuItem onClick={() => abrirModal('password')} icon="🔑" label="Cambiar contraseña" />
            <MenuItem onClick={() => abrirModal('email')}    icon="✉️" label="Cambiar email" />
            <div style={{ borderTop: '1px solid var(--color-border)' }} />
            <MenuItem
              onClick={() => { setOpen(false); onLogout?.() }}
              icon="↩"
              label="Salir"
              danger
            />
          </div>
        )}
      </div>

      {modal === 'cuenta'   && <ModalMiCuenta onClose={() => setModal(null)} />}
      {modal === 'password' && <ModalCambiarPassword onClose={() => setModal(null)} />}
      {modal === 'email'    && <ModalCambiarEmail onClose={() => setModal(null)} login={login} />}
    </>
  )
}

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', textAlign: 'left',
        padding: '10px 14px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: 13,
        color: danger ? 'var(--color-danger)' : 'var(--color-text)',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{ fontSize: 14, opacity: 0.85 }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

// ────────────────────── Modal frame compartido ────────────────────────────

function ModalFrame({ title, onClose, children }) {
  // Cierra con Escape.
  useEffect(() => {
    function handle(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose])

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: '20px 22px',
        maxWidth: 420,
        width: '100%',
        boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 18, color: 'var(--color-muted)', lineHeight: 1,
              padding: 0,
            }}
            title="Cerrar"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ────────────────────── Modal "Mi cuenta" ────────────────────────────────

function ModalMiCuenta({ onClose }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.me()
      .then(r => setData(r?.user || null))
      .catch(e => setError(e.message))
  }, [])

  return (
    <ModalFrame title="Mi cuenta" onClose={onClose}>
      {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}
      {!data && !error && <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>Cargando...</div>}
      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Campo label="Nombre" value={data.nombre} />
          <Campo label="Email"  value={data.email} />
          <Campo label="Rol"    value={ROL_LABEL[data.role] || data.role} />
        </div>
      )}
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary btn-sm" onClick={onClose}>Cerrar</button>
      </div>
    </ModalFrame>
  )
}

function Campo({ label, value }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--color-muted)',
        textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: 'var(--color-text)' }}>{value}</div>
    </div>
  )
}

// ────────────────────── Modal Cambiar contraseña ─────────────────────────

const PASSWORD_MIN = 6

function ModalCambiarPassword({ onClose }) {
  const [form, setForm]   = useState({ current: '', nueva: '', repetir: '' })
  const [error, setError] = useState('')
  const [info, setInfo]   = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving) return
    setError(''); setInfo('')
    if (!form.current)                    return setError('Contraseña actual requerida.')
    if (!form.nueva || form.nueva.length < PASSWORD_MIN)
      return setError(`La nueva contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`)
    if (form.nueva !== form.repetir)      return setError('Las contraseñas nuevas no coinciden.')

    setSaving(true)
    try {
      await api.cambiarMiPassword(form.current, form.nueva)
      setInfo('Contraseña actualizada.')
      setForm({ current: '', nueva: '', repetir: '' })
      // Cerrar después de mostrar feedback breve.
      setTimeout(onClose, 1500)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalFrame title="Cambiar contraseña" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Field
          label="Contraseña actual"
          type="password"
          value={form.current}
          onChange={v => setForm(f => ({ ...f, current: v }))}
          autoFocus
        />
        <Field
          label={`Nueva contraseña (mín ${PASSWORD_MIN})`}
          type="password"
          value={form.nueva}
          onChange={v => setForm(f => ({ ...f, nueva: v }))}
        />
        <Field
          label="Repetir nueva contraseña"
          type="password"
          value={form.repetir}
          onChange={v => setForm(f => ({ ...f, repetir: v }))}
        />
        {error && <div className="error-msg" style={{ fontSize: 12 }}>{error}</div>}
        {info  && (
          <div style={{
            padding: '6px 10px', borderRadius: 6, fontSize: 12,
            background: 'rgba(22,163,74,0.10)', color: 'var(--color-success)',
          }}>
            ✓ {info}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </ModalFrame>
  )
}

// ────────────────────── Modal Cambiar email ───────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function ModalCambiarEmail({ onClose, login }) {
  const [form, setForm]   = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [info, setInfo]   = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving) return
    setError(''); setInfo('')
    const email = (form.email || '').trim().toLowerCase()
    if (!EMAIL_RE.test(email)) return setError('Email inválido.')
    if (!form.password)        return setError('Contraseña actual requerida para confirmar.')

    setSaving(true)
    try {
      const r = await api.cambiarMiEmail(email, form.password)
      // El backend devuelve token + user nuevos. Pisamos la sesión.
      if (r?.token && r?.user) {
        login(r.user, r.token)
      }
      setInfo('Email actualizado.')
      setTimeout(onClose, 1500)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalFrame title="Cambiar email" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Field
          label="Nuevo email"
          type="email"
          value={form.email}
          onChange={v => setForm(f => ({ ...f, email: v }))}
          autoFocus
        />
        <Field
          label="Contraseña actual (confirmación)"
          type="password"
          value={form.password}
          onChange={v => setForm(f => ({ ...f, password: v }))}
        />
        {error && <div className="error-msg" style={{ fontSize: 12 }}>{error}</div>}
        {info  && (
          <div style={{
            padding: '6px 10px', borderRadius: 6, fontSize: 12,
            background: 'rgba(22,163,74,0.10)', color: 'var(--color-success)',
          }}>
            ✓ {info}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </ModalFrame>
  )
}

// ────────────────────── Field genérico ────────────────────────────────────

function Field({ label, type = 'text', value, onChange, autoFocus, autoComplete }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{
        fontSize: 11, fontWeight: 700, color: 'var(--color-muted)',
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoFocus={autoFocus}
        autoComplete={autoComplete || (type === 'password' ? 'off' : undefined)}
        style={{
          padding: '7px 10px', fontSize: 13,
          border: '1px solid var(--color-border)', borderRadius: 6,
          background: 'white', outline: 'none',
        }}
      />
    </label>
  )
}
