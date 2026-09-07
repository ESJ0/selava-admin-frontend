import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './client'
import { cancelOrder, createOrder, getOrder, getOrderHistory, listOrderStatuses, updateOrderStatus } from './orders'
import { useAuth } from '../store/auth'

afterEach(() => { vi.restoreAllMocks(); useAuth.setState({ token: null, roleId: null }) })

describe('contrato API de pedidos', () => {
  it('usa las rutas reales de detalle, historial y catálogo y propaga AbortSignal', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: [] })
    const signal = new AbortController().signal
    await getOrder(42, signal); await getOrderHistory(42, signal); await listOrderStatuses(signal)
    expect(get.mock.calls).toEqual([
      ['/pedidos/42', { signal }], ['/pedidos/42/historial-estados', { signal }], ['/estados-pedido/', { signal }],
    ])
  })
  it('envía estado y observaciones normalizadas, y cancela sin inventar un body', async () => {
    const put = vi.spyOn(api, 'put').mockResolvedValue({ data: {} })
    await updateOrderStatus(42, 3, '  Lista  '); await cancelOrder(42)
    expect(put.mock.calls).toEqual([['/pedidos/42/estado', { estado_id: 3, observaciones: 'Lista' }], ['/pedidos/42/cancelar']])
  })
  it('crea prendas con IDs de servicio y deja precios y total al backend', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 42 } })
    await createOrder(1, '2030-01-01', '', [{ tipo_prenda_id: 2, cantidad: 3, color: '', descripcion: '', servicio_ids: [7, 9] }])
    const body = post.mock.calls[0][1] as Record<string, unknown>
    expect(body).not.toHaveProperty('total')
    expect(body.prendas).toEqual([{ tipo_prenda_id: 2, cantidad: 3, servicios: [{ servicio_id: 7 }, { servicio_id: 9 }] }])
  })
  it('adjunta JWT en la solicitud real de Axios y limpia sesión ante 401', async () => {
    const previous = api.defaults.adapter
    useAuth.setState({ token: 'audit-jwt', roleId: 1 })
    api.defaults.adapter = async config => {
      expect(config.headers.Authorization).toBe('Bearer audit-jwt')
      throw { isAxiosError: true, response: { status: 401, data: {} }, config }
    }
    try {
      await expect(getOrder(42)).rejects.toHaveProperty('response.status', 401)
      expect(useAuth.getState().token).toBeNull()
    } finally { api.defaults.adapter = previous }
  })
})
