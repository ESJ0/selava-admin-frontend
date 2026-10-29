import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { afterEach, expect, it } from 'vitest'
import { api } from './client'
import { createUser, listUsers, setUserActive, updateUser } from './users'

const originalAdapter = api.defaults.adapter
afterEach(() => { api.defaults.adapter = originalAdapter })

it('consume el CRUD administrativo de cuentas', async () => {
  const calls: Array<{ method?: string; url?: string; data?: unknown }> = []
  api.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
    calls.push({ method: config.method, url: config.url, data: config.data ? JSON.parse(String(config.data)) : undefined })
    return { config, status: 200, statusText: 'OK', headers: {}, data: config.method === 'get' ? [] : { id: 1, rol_id: 2, rol: 'Recepcionista', email: 'recepcion@selava.local', activo: true } }
  }) as AxiosAdapter
  await listUsers()
  await createUser({ rol_id: 2, email: 'recepcion@selava.local', password: 'secreto-seguro' })
  await updateUser(1, { nombre: 'Recepción' })
  await setUserActive(1, false)
  expect(calls).toEqual([
    { method: 'get', url: '/usuarios/', data: undefined },
    { method: 'post', url: '/usuarios/', data: { rol_id: 2, email: 'recepcion@selava.local', password: 'secreto-seguro' } },
    { method: 'put', url: '/usuarios/1', data: { nombre: 'Recepción' } },
    { method: 'patch', url: '/usuarios/1/estado', data: { activo: false } },
  ])
})
