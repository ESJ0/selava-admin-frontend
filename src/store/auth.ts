import { create } from 'zustand'

interface AuthState { token: string | null; roleId: number | null; setToken: (token: string) => void; logout: () => void }
function getRole(token: string) {
  try { return (JSON.parse(atob(token.split('.')[1])) as { rol_id?: number }).rol_id ?? null } catch { return null }
}
const initialToken = sessionStorage.getItem('selava_token')
export const useAuth = create<AuthState>((set) => ({
  token: initialToken, roleId: initialToken ? getRole(initialToken) : null,
  setToken: (token) => { sessionStorage.setItem('selava_token', token); set({ token, roleId: getRole(token) }) },
  logout: () => { sessionStorage.removeItem('selava_token'); set({ token: null, roleId: null }) },
}))
