import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { SessionScreen } from '../components/admin/SessionScreen'
import { tokenIdentity, useAuth } from '../store/auth'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const setToken = useAuth(state => state.setToken)
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? ''
  const identity = useMemo(() => tokenIdentity(token), [token])
  useEffect(() => {
    window.history.replaceState(null, '', '/auth/callback')
    if (!identity) return
    // Breve pausa para mostrar la pantalla de bienvenida antes de entrar al panel.
    const timer = window.setTimeout(() => {
      setToken(token)
      navigate(identity.roleId === 3 ? '/pedidos' : '/inicio', { replace: true })
    }, import.meta.env.MODE === 'test' ? 0 : 900)
    return () => window.clearTimeout(timer)
  }, [identity, navigate, setToken, token])
  if (!identity) return <SessionScreen tone="error" title="Sesión no válida" text="La sesión recibida no es válida o ya venció.">
    <a className="ss-btn" href={(import.meta.env.VITE_LOGIN_URL || 'http://localhost:5174/login')}>Volver al inicio de sesión</a>
  </SessionScreen>
  return <SessionScreen title="Iniciando sesión" text="Preparando tu espacio de trabajo…" />
}
