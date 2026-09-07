import axios from 'axios'
import { useAuth } from '../store/auth'

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api', timeout: 8000 })
api.interceptors.request.use((config) => { const token = useAuth.getState().token; if (token) config.headers.Authorization = `Bearer ${token}`; return config })
api.interceptors.response.use(undefined, (error) => { if (error.response?.status === 401) useAuth.getState().logout(); return Promise.reject(error) })

export function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string; errores?: Array<{ field: string; message: string }> } | undefined
    return data?.error ?? data?.errores?.map(({ field, message }) => `${field}: ${message}`).join('. ') ?? 'No fue posible conectar con el servidor.'
  }
  return 'Ocurrió un error inesperado.'
}
