import { api } from './client'
import type { ClienteListResponse } from '../types'

export async function listClients(signal?: AbortSignal) {
  return (await api.get<ClienteListResponse>('/clientes/', { signal })).data
}
