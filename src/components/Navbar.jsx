import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../App.jsx'
import { api } from '../api/index.js'
import AccountMenu from './AccountMenu.jsx'

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

  // Última liga GDT visitada (persistida por MiEquipoGDT). Permite que "Mi GDT" del
  // navbar recuerde el contexto multiliga: sin esto, siempre caería en la liga default.
  let miGdtPath = '/gdt/mi-equipo'
  try {
    const last = localStorage.getItem('gdt:lastLigaId')
    if (last) miGdtPath = `/gdt/mi-equipo?liga_id=${encodeURIComponent(last)}`
  } catch (_) { /* localStorage no disponible: usar path simple */ }

  // Navbar contextual por ruta (Fase UX juegos):
  //   - En /mundial...:  links Mundial.
  //   - En /admin...:    solo Juegos + Admin (sin ruido de los juegos).
  //   - En /juegos:      solo Juegos.
  //   - En Prode tradicional (/, /fecha, /tabla, /estadisticas, /comidas, /gdt/*):
  //                      links tradicional.
  //   - Otro:            solo Juegos.
  // Admin/superadmin SIEMPRE tiene link Admin extra.
  // Los datos de torneos siguen filtrados por backend (torneo_jugadores).
  const [tradicionales, setTradicionales] = useState(null)
  const [mundiales, setMundiales]         = useState(null)

  useEffect(() => {
    if (!user) return
    let cancel = false
    api.getTorneos()
      .then(ts => {
        if (cancel) return
        const tradi = (Array.isArray(ts) ? ts : []).filter(t => t.tipo !== 'mundial_preguntas')
        setTradicionales(tradi)
      })
      .catch(() => { if (!cancel) setTradicionales([]) })
    api.getMundialTorneos()
      .then(ts => { if (!cancel) setMundiales(Array.isArray(ts) ? ts : []) })
      .catch(() => { if (!cancel) setMundiales([]) })
    return () => { cancel = true }
  }, [user?.id])

  const verTradicional   = isAdmin || (Array.isArray(tradicionales) && tradicionales.length > 0)
  const verMundial       = Array.isArray(mundiales) && mundiales.length > 0
  const mundialUnicoId   = (verMundial && mundiales.length === 1) ? mundiales[0].id : null
  const miMundialPath    = mundialUnicoId ? `/mundial/${mundialUnicoId}` : '/mundial'

  // Detectar contexto desde la ruta actual.
  const contexto = detectarContexto(location.pathname)

  return (
    <nav className="navbar">
      {/* Brand → /juegos: el selector es el "home" de la plataforma. */}
      <Link to="/juegos" className="navbar-brand">⚽ Prode Chacho</Link>

      <div className="navbar-links">
        {/* Juegos siempre visible: escape hatch al selector */}
        <NavLink to="/juegos" label="Juegos" />

        {/* Contexto Mundial: Mi Mundial + Ranking + Respuestas + Datos útiles (si aplica) */}
        {contexto === 'mundial' && verMundial && (
          <>
            <NavLink to={miMundialPath} label="Mi Mundial" exact={!!mundialUnicoId} />
            {mundialUnicoId && <NavLink to={`/mundial/${mundialUnicoId}/ranking`}     label="Ranking" />}
            {mundialUnicoId && <NavLink to={`/mundial/${mundialUnicoId}/respuestas`}  label="Respuestas" />}
            {mundialUnicoId && <NavLink to={`/mundial/${mundialUnicoId}/datos`}       label="Datos útiles" />}
          </>
        )}

        {/* Contexto Prode tradicional: Inicio + Mi GDT + Estadísticas + Comidas */}
        {contexto === 'tradicional' && verTradicional && (
          <>
            <NavLink to="/" label="Inicio" exact />
            <NavLink to={miGdtPath} label="Mi GDT" />
            <NavLink to="/estadisticas" label="Estadísticas" />
            <NavLink to="/comidas" label="Comidas" />
          </>
        )}

        {/* Admin link siempre visible para admins (en cualquier contexto) */}
        {isAdmin && <NavLink to="/admin" label="Admin" />}
      </div>

      <div className="navbar-user">
        {/* Shortcuts admin a la izquierda del dropdown — sin cambios */}
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
        {/* Dropdown de cuenta: reemplaza el bloque nombre+badge inerte y el botón Salir.
            Salir vive ahora dentro del dropdown. */}
        <AccountMenu onLogout={handleLogout} />
      </div>
    </nav>
  )
}

/**
 * Detecta el contexto/juego activo según la ruta. Determina qué links
 * de la navbar se muestran (Fase UX juegos).
 *
 * Contextos:
 *   - 'mundial':    /mundial...
 *   - 'admin':      /admin...
 *   - 'selector':   /juegos
 *   - 'tradicional': '/', /fecha, /tabla, /estadisticas, /comidas, /gdt/*
 *   - 'otro':       cualquier otra cosa (login, reset-password, etc).
 */
function detectarContexto(pathname) {
  if (pathname.startsWith('/mundial'))      return 'mundial'
  if (pathname.startsWith('/admin'))        return 'admin'
  if (pathname === '/juegos')               return 'selector'
  if (pathname === '/prode')                return 'selector'
  if (pathname === '/')                     return 'tradicional'
  if (
    pathname.startsWith('/fecha') ||
    pathname.startsWith('/tabla') ||
    pathname.startsWith('/estadisticas') ||
    pathname.startsWith('/comidas') ||
    pathname.startsWith('/gdt')
  ) return 'tradicional'
  return 'otro'
}

function NavLink({ to, label, exact }) {
  const location = useLocation()
  // Active check ignora querystring: "/gdt/mi-equipo?liga_id=3" matchea con "/gdt/mi-equipo"
  const pathname = to.split('?')[0]
  const active = exact ? location.pathname === pathname : location.pathname.startsWith(pathname)
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
