import { api } from './client'
import type { Insumo, InsumoCreatePayload, InsumoUpdatePayload } from '../types'

export async function listInputs(signal?: AbortSignal) {
  return (await api.get<Insumo[]>('/insumos/', { signal })).data
}

export async function createInput(payload: InsumoCreatePayload) {
  return (await api.post<Insumo>('/insumos/', payload)).data
}

export async function updateInput(id: number, payload: InsumoUpdatePayload) {
  return (await api.put<Insumo>(`/insumos/${id}`, payload)).data
}

export async function deactivateInput(id: number) {
  await api.delete(`/insumos/${id}`)
}
