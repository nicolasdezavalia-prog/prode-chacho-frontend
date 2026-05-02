import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../App.jsx'

function DropdownMenu({ label, items }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const location = useLocation()

  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const isActive = items.some(item => location.pathname.startsWith(item.to))

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 13,
          color: isActive ? '#ffffff' : '#a1a1aa',
          fontWeight: isActive ? 600 : 400,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 0',
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#ffffff'}
        onMouseLeave={e => e.currentTarget.style.color = isActive ? '#ffffff' : '#a1a1aa'}
      >
        {label}
        <span style={{ fontSize: 9, opacity: 0.7 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          minWidth: 180,
          zIndex: 500,
          overflow: 'hidden',
        }}>
          {items.map((item, i) => (
            <Link
              key={i}
              to={item.to}
              onClick={() => setOpen(false)}
              style={{
                display: 'block',
                padding: '9px 14px',
                fontSize: 13,
                color: location.pathname.startsWith(item.to) ? 'var(--color-primary)' : 'var(--color-text)',
                textDecoration: 'none',
                borderBottom: i < items.length - 1 ? '1px solid var(--color-border)' : 'none',
                fontWeight: location.pathname.startsWith(item.to) ? 600 : 400,
                background: location.pathname.startsWith(item.to) ? 'rgba(59,130,246,0.06)' : 'transparent',
              }}
              onMouseEnter={e => { if (!location.pathname.startsWith(item.to)) e.currentTarget.style.background = 'var(--color-surface2)' }}
              onMouseLeave={e => { e.currentTarget.style.background = location.pathname.startsWith(item.to) ? 'rgba(59,130,246,0.06)' : 'transparent' }}
            >
              {item.icon && <span style={{ marginRight: 6 }}>{item.icon}</span>}
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => { logout(); navigate('/login') }

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const isSuperAdmin = user?.role === 'superadmin'

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">⚽ Prode Chacho</Link>

      <div className="navbar-links">
        <NavLink to="/" label="Inicio" exact />
        <NavLink to="/gdt/mi-equipo" label="Mi GDT" />
        <NavLink to="/estadisticas" label="Estadísticas" />
        <NavLink to="/comidas" label="Comidas" />
        {isAdmin && <NavLink to="/admin" label="Admin" />}
      </div>

      <div className="navbar-user">
        <span>{user?.nombre}</span>
        <span className="badge badge-borrador" style={{ fontSize: 10, ...(isSuperAdmin ? { background: 'rgba(124,58,237,0.15)', color: '#7c3aed' } : {}) }}>
          {isSuperAdmin ? 'SUPER' : isAdmin ? 'ADMIN' : 'JUGADOR'}
        </span>
        {isAdmin && (
          <Link to="/admin/usuarios" className="btn btn-secondary btn-sm" title="Gestión de usuarios">
            👥
          </Link>
        )}
        {isSuperAdmin && (
          <Link to="/admin/permisos" className="btn btn-secondary btn-sm" title="Gestión de permisos">
            🔑
          </Link>
        )}
        <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Salir</button>
      </div>
    </nav>
  )
}

function NavLink({ to, label, exact }) {
  const location = useLocation()
  const active = exact ? location.pathname === to : location.pathname.startsWith(to)
  return (
    <Link
      to={to}
      style={{
        color: active ? '#ffffff' : '#a1a1aa',
        fontWeight: active ? 600 : 400,
        textDecoration: 'none',
        fontSize: 13,
        padding: '4px 0',
        transition: 'color 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.color = '#ffffff'}
      onMouseLeave={e => e.currentTarget.style.color = active ? '#ffffff' : '#a1a1aa'}
    >
      {label}
    </Link>
  )
}
