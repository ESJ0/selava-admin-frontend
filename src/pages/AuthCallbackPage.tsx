import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { tokenIdentity, useAuth } from '../store/auth'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const setToken = useAuth(state => state.setToken)
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? ''
  const identity = useMemo(() => tokenIdentity(token), [token])
  useEffect(() => {
    window.history.replaceState(null, '', '/auth/callback')
    if (!identity) return
    setToken(token)
    navigate(identity.roleId === 3 ? '/pedidos' : '/inicio', { replace: true })
  }, [identity, navigate, setToken, token])
  return <main className="login-page"><section className="login-card"><h1>Validando sesión</h1>{!identity ? <><div className="alert error">La sesión recibida no es válida o ya venció.</div><a className="primary wide" href={(import.meta.env.VITE_LOGIN_URL || 'http://localhost:5174/login')}>Volver al login</a></> : <p>Preparando tu espacio de trabajo…</p>}</section></main>
}
