import { api } from './client'
import type { CatalogKind, Entity, MetodoPago, Servicio, TipoPrenda } from '../types'

export type CatalogEntity = Servicio | TipoPrenda | MetodoPago
export type CatalogPayload = { nombre: string; descripcion?: string; precio_base?: number; tiempo_estimado_horas?: number }
export async function listCatalog(kind: CatalogKind) { return (await api.get<CatalogEntity[]>(`/${kind}/`)).data }
export async function createCatalog(kind: CatalogKind, data: CatalogPayload) { return (await api.post<CatalogEntity>(`/${kind}/`, data)).data }
export async function updateCatalog(kind: CatalogKind, id: number, data: Partial<CatalogPayload & Pick<Entity, 'activo'>>) { return (await api.put<CatalogEntity>(`/${kind}/${id}`, data)).data }
export async function deactivateCatalog(kind: CatalogKind, id: number) { await api.delete(`/${kind}/${id}`) }
