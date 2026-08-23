import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { api, errorMessage } from '../api/client'
import { useAuth } from '../store/auth'

export function LoginPage() {
  const token = useAuth((s) => s.token); const setToken = useAuth((s) => s.setToken)
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  if (token) return <Navigate to="/servicios" replace />
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(''); const data = new FormData(event.currentTarget)
    try { const response = await api.post<{token:string}>('/auth/login', { email: data.get('email'), password: data.get('password') }); setToken(response.data.token) }
    catch (e) { setError(errorMessage(e)) } finally { setLoading(false) }
  }
  return <main className="login-page"><section className="login-card"><div className="brand brand-login"><span className="brand-mark">✦</span><span>SELAVA</span></div>
    <h1>Bienvenido</h1><p>Ingresa a la administración de tu lavandería.</p><form onSubmit={submit}>
      <label>Correo electrónico<input name="email" type="email" required autoComplete="email" /></label><label>Contraseña<input name="password" type="password" required autoComplete="current-password" /></label>
      {error && <div className="alert error">{error}</div>}<button className="primary wide" disabled={loading}>{loading ? 'Ingresando…' : 'Ingresar'}</button>
    </form></section></main>
}
