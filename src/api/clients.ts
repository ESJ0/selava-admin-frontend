import axios from 'axios'
import { api } from './client'
import type { Cliente, ClienteCreate, ClienteListResponse } from '../types'

export async function listClients(signal?: AbortSignal) {
  return (await api.get<ClienteListResponse>('/clientes/', { signal })).data
}

export async function createClient(payload: ClienteCreate) {
  return (await api.post<Cliente>('/clientes/', payload)).data
}

export function clientFieldErrors(cause: unknown) {
  const result: Partial<Record<keyof ClienteCreate, string>> = {}
  if (!axios.isAxiosError(cause) || !Array.isArray(cause.response?.data?.errores)) return result
  for (const entry of cause.response.data.errores) {
    if (!entry || typeof entry !== 'object') continue
    const { field, message } = entry as { field?: unknown; message?: unknown }
    if (typeof field === 'string' && typeof message === 'string' && ['nombre', 'apellido', 'telefono', 'email', 'direccion'].includes(field)) {
      result[field as keyof ClienteCreate] = message
    }
  }
  return result
}
