import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, createContext, useContext } from 'react'
import Login from './pages/Login.jsx'
import Home from './pages/Home.jsx'
import MiFecha from './pages/MiFecha.jsx'
import TablaGeneral from './pages/TablaGeneral.jsx'
import AdminFecha from './pages/admin/AdminFecha.jsx'
import AdminEventos from './pages/admin/AdminEventos.jsx'
import AdminResultados from './pages/admin/AdminResultados.jsx'
import AdminFixture from './pages/admin/AdminFixture.jsx'
import AdminGDTPuntajes from './pages/admin/AdminGDTPuntajes.jsx'
import AdminEquiposGDT from './pages/admin/AdminEquiposGDT.jsx'
import AdminGDTCatalogo from './pages/admin/AdminGDTCatalogo.jsx'
import AdminGDTPendientes from './pages/admin/AdminGDTPendientes.jsx'
import AdminGDTJugadores from './pages/admin/AdminGDTJugadores.jsx'
import AdminGDTVentana from './pages/admin/AdminGDTVentana.jsx'
import AdminFechaResumida from './pages/admin/AdminFechaResumida.jsx'
import MiEquipoGDT from './pages/MiEquipoGDT.jsx'
import Enfrentamientos from './pages/Enfrentamientos.jsx'
import AdminUsuarios from './pages/admin/AdminUsuarios.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import Navbar from './components/Navbar.jsx'

// Context de autenticación
export const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

function PrivateRoute({ children, adminOnly = false }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" />
  if (adminOnly && user.role !== 'admin' && user.role !== 'superadmin') return <Navigate to="/" />
  return children
}

export default function App() {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })

  const login = (userData, token) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <BrowserRouter>
        {user && <Navbar />}
        <div className="main-content">
          <Routes>
            <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
            <Route path="/fecha/:fechaId" element={<PrivateRoute><MiFecha /></PrivateRoute>} />
            <Route path="/tabla/:torneoId" element={<PrivateRoute><TablaGeneral /></PrivateRoute>} />
            <Route path="/admin/fecha/nueva" element={<PrivateRoute adminOnly><AdminFecha /></PrivateRoute>} />
            <Route path="/admin/fecha/:fechaId" element={<PrivateRoute adminOnly><AdminFecha /></PrivateRoute>} />
            <Route path="/admin/fecha/:fechaId/eventos" element={<PrivateRoute adminOnly><AdminEventos /></PrivateRoute>} />
            <Route path="/admin/fecha/:fechaId/resultados" element={<PrivateRoute adminOnly><AdminResultados /></PrivateRoute>} />
            <Route path="/admin/fecha/:fechaId/fixture" element={<PrivateRoute adminOnly><AdminFixture /></PrivateRoute>} />
            <Route path="/admin/fecha/:fechaId/gdt" element={<PrivateRoute adminOnly><AdminGDTPuntajes /></PrivateRoute>} />
            <Route path="/admin/fecha/:fechaId/resumido" element={<PrivateRoute adminOnly><AdminFechaResumida /></PrivateRoute>} />
            <Route path="/admin/gdt/equipos" element={<PrivateRoute adminOnly><AdminEquiposGDT /></PrivateRoute>} />
            <Route path="/admin/gdt/catalogo" element={<PrivateRoute adminOnly><AdminGDTCatalogo /></PrivateRoute>} />
            <Route path="/admin/gdt/pendientes" element={<PrivateRoute adminOnly><AdminGDTPendientes /></PrivateRoute>} />
            <Route path="/admin/gdt/jugadores" element={<PrivateRoute adminOnly><AdminGDTJugadores /></PrivateRoute>} />
            <Route path="/admin/gdt/ventana" element={<PrivateRoute adminOnly><AdminGDTVentana /></PrivateRoute>} />
            <Route path="/admin/usuarios" element={<PrivateRoute adminOnly><AdminUsuarios /></PrivateRoute>} />
            <Route path="/fecha/:fechaId/enfrentamientos" element={<PrivateRoute><Enfrentamientos /></PrivateRoute>} />
            <Route path="/gdt/mi-equipo" element={<PrivateRoute><MiEquipoGDT /></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}
