import { api } from './client'

export interface UserAccount { id: number; rol_id: number; rol: string; cliente_id?: number; nombre: string; apellido: string; email: string; telefono: string; activo: boolean; created_at: string; updated_at: string }
export interface UserPayload { rol_id?: number; nombre?: string; apellido?: string; email?: string; telefono?: string; direccion?: string; password?: string; activo?: boolean }

export async function listUsers() { return (await api.get<UserAccount[]>('/usuarios/')).data }
export async function createUser(payload: UserPayload) { return (await api.post<UserAccount>('/usuarios/', payload)).data }
export async function updateUser(id: number, payload: UserPayload) { return (await api.put<UserAccount>(`/usuarios/${id}`, payload)).data }
export async function setUserActive(id: number, activo: boolean) { return (await api.patch<UserAccount>(`/usuarios/${id}/estado`, { activo })).data }
