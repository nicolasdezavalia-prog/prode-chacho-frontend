import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/index.js'
import { useAuth } from '../App.jsx'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  const { login } = useAuth()

  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if (!token) setError('Link inválido. Pedile al admin que genere uno nuevo.')
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 4) { setError('La contraseña debe tener al menos 4 caracteres'); return }
    if (password !== confirmar) { setError('Las contraseñas no coinciden'); return }

    setLoading(true)
    try {
      const data = await api.resetPassword(token, password)
      // Loguear automáticamente al usuario
      login(data.user, data.token)
      setOk(true)
      setTimeout(() => navigate('/'), 2000)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-bg)', padding: 16
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚽</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Prode Chacho</div>
          <div style={{ color: 'var(--color-muted)', fontSize: 14, marginTop: 4 }}>Restablecer contraseña</div>
        </div>

        <div className="card">
          {ok ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>¡Contraseña actualizada!</div>
              <div style={{ color: 'var(--color-muted)', fontSize: 13 }}>Redirigiendo al inicio...</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && (
                <div className="error-msg" style={{ marginBottom: 14 }}>{error}</div>
              )}

              <div className="form-group">
                <label className="form-label">Nueva contraseña</label>
                <input
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mín. 4 caracteres"
                  autoFocus
                  disabled={!token || loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirmar contraseña</label>
                <input
                  type="password"
                  className="form-input"
                  value={confirmar}
                  onChange={e => setConfirmar(e.target.value)}
                  placeholder="Repetí la contraseña"
                  disabled={!token || loading}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 8 }}
                disabled={!token || loading}
              >
                {loading ? 'Guardando...' : 'Establecer contraseña →'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
