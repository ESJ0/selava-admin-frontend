import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './client'
import { clientFieldErrors, createClient, deactivateClient, getClient, listClients, updateClient } from './clients'

afterEach(() => vi.restoreAllMocks())

describe('contrato API de clientes', () => {
  it('lista y obtiene por ID propagando AbortSignal', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: [] })
    const signal = new AbortController().signal
    await listClients(signal)
    await getClient(7, signal)
    expect(get.mock.calls).toEqual([['/clientes/', { signal }], ['/clientes/7', { signal }]])
  })

  it('crea, actualiza y desactiva con los métodos reales', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 7 } })
    const put = vi.spyOn(api, 'put').mockResolvedValue({ data: { id: 7 } })
    const remove = vi.spyOn(api, 'delete').mockResolvedValue({ data: undefined })
    const payload = { nombre: 'Ana', apellido: 'Paz', telefono: '5555-1234' }
    await createClient(payload)
    await updateClient(7, { telefono: '5555-9876', activo: true })
    await deactivateClient(7)
    expect(post).toHaveBeenCalledWith('/clientes/', payload)
    expect(put).toHaveBeenCalledWith('/clientes/7', { telefono: '5555-9876', activo: true })
    expect(remove).toHaveBeenCalledWith('/clientes/7')
  })

  it('convierte errores de validación backend en errores por campo', () => {
    const result = clientFieldErrors({ isAxiosError: true, response: { data: { errores: [{ field: 'telefono', message: 'es requerido' }, { field: 'desconocido', message: 'ignorar' }] } } })
    expect(result).toEqual({ telefono: 'es requerido' })
  })
})
