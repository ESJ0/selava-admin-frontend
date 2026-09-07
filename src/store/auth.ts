import { create } from 'zustand'

interface AuthState { token: string | null; roleId: number | null; setToken: (token: string) => void; logout: () => void }
function getRole(token: string) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { rol_id?: number; exp?: number }
    if (!payload.exp || payload.exp * 1000 <= Date.now()) return null
    return payload.rol_id ?? null
  } catch { return null }
}
const storedToken = sessionStorage.getItem('selava_token')
const initialToken = storedToken && getRole(storedToken) !== null ? storedToken : null
if (!initialToken) sessionStorage.removeItem('selava_token')
export const useAuth = create<AuthState>((set) => ({
  token: initialToken, roleId: initialToken ? getRole(initialToken) : null,
  setToken: (token) => { sessionStorage.setItem('selava_token', token); set({ token, roleId: getRole(token) }) },
  logout: () => { sessionStorage.removeItem('selava_token'); set({ token: null, roleId: null }) },
}))
