import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './client'
import { createSupply, deactivateSupply, listSupplies, updateSupply } from './supplies'

afterEach(() => vi.restoreAllMocks())

describe('contrato API de insumos', () => {
  it('usa las rutas CRUD del backend', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: [] })
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })
    const put = vi.spyOn(api, 'put').mockResolvedValue({ data: {} })
    const remove = vi.spyOn(api, 'delete').mockResolvedValue({ data: {} })
    const signal = new AbortController().signal
    const payload = { nombre: 'Detergente', unidad_medida: 'litros', stock_actual: 10, stock_minimo: 2 }

    await listSupplies(signal)
    await createSupply(payload)
    await updateSupply(4, { stock_minimo: 3 })
    await deactivateSupply(4)

    expect(get).toHaveBeenCalledWith('/insumos/', { signal })
    expect(post).toHaveBeenCalledWith('/insumos/', payload)
    expect(put).toHaveBeenCalledWith('/insumos/4', { stock_minimo: 3 })
    expect(remove).toHaveBeenCalledWith('/insumos/4')
  })
})
