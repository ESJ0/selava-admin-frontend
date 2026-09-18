import { api } from './client'
import type { Insumo } from '../types'

export interface SupplyPayload {
  nombre: string
  descripcion?: string
  unidad_medida: string
  stock_actual: number
  stock_minimo: number
}

export async function listSupplies(signal?: AbortSignal) {
  return (await api.get<Insumo[]>('/insumos/', { signal })).data
}

export async function createSupply(payload: SupplyPayload) {
  return (await api.post<Insumo>('/insumos/', payload)).data
}

export async function updateSupply(id: number, payload: Partial<SupplyPayload & Pick<Insumo, 'activo'>>) {
  return (await api.put<Insumo>(`/insumos/${id}`, payload)).data
}

export async function deactivateSupply(id: number) {
  await api.delete(`/insumos/${id}`)
}
