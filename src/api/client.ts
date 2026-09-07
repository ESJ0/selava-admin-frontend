import axios from 'axios'
import { useAuth } from '../store/auth'

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api', timeout: 8000 })
api.interceptors.request.use((config) => { const token = useAuth.getState().token; if (token) config.headers.Authorization = `Bearer ${token}`; return config })
api.interceptors.response.use(undefined, (error) => { if (error.response?.status === 401) useAuth.getState().logout(); return Promise.reject(error) })

export function httpStatus(error: unknown) {
  return axios.isAxiosError(error) ? error.response?.status : undefined
}

export function errorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return 'Ocurrió un error inesperado.'
  const data: unknown = error.response?.data
  if (data && typeof data === 'object') {
    const body = data as { error?: unknown; errores?: unknown }
    if (typeof body.error === 'string' && body.error.trim()) return body.error
    if (Array.isArray(body.errores)) {
      const messages = body.errores.flatMap((entry: unknown) => {
        if (!entry || typeof entry !== 'object') return []
        const { field, message } = entry as { field?: unknown; message?: unknown }
        return typeof message === 'string' ? [typeof field === 'string' ? `${field}: ${message}` : message] : []
      })
      if (messages.length) return messages.join('. ')
    }
  }
  const messages: Record<number, string> = {
    400: 'La solicitud no es válida. Revisa los datos ingresados.',
    401: 'Tu sesión terminó. Inicia sesión nuevamente.',
    403: 'No tienes permiso para realizar esta acción.',
    404: 'No se encontró el recurso solicitado.',
    409: 'El pedido cambió o su estado no permite esta acción. Actualiza la vista.',
    422: 'Revisa los datos ingresados antes de continuar.',
    500: 'No pudimos completar la operación. Inténtalo nuevamente.',
  }
  const status = httpStatus(error)
  return status ? messages[status] ?? 'El servidor no pudo completar la operación.' : 'No fue posible conectar con el servidor.'
}
