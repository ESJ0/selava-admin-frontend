import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('./client', () => ({ api: mocks }))

import { createInput, deactivateInput, listInputs, listLowStockInputs, registerInventoryMovement, updateInput } from './inventory'
import { getOrderBalance, getOrderPayments, listPaymentMethods, registerOrderPayment } from './payments'

describe('contratos API de Sprint 4', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.get.mockResolvedValue({ data: [] })
    mocks.post.mockResolvedValue({ data: { id: 1 } })
    mocks.put.mockResolvedValue({ data: { id: 1 } })
    mocks.delete.mockResolvedValue({ data: undefined })
  })

  it('usa los endpoints reales de saldo, historial, métodos y registro de pago', async () => {
    const controller = new AbortController()
    await getOrderBalance(42, controller.signal)
    await getOrderPayments(42, controller.signal)
    await listPaymentMethods(controller.signal)
    await registerOrderPayment(42, { metodo_pago_id: 3, monto: 25, referencia: 'POS-25' })

    expect(mocks.get).toHaveBeenNthCalledWith(1, '/pedidos/42/saldo', { signal: controller.signal })
    expect(mocks.get).toHaveBeenNthCalledWith(2, '/pedidos/42/pagos', { signal: controller.signal })
    expect(mocks.get).toHaveBeenNthCalledWith(3, '/metodos-pago/', { signal: controller.signal })
    expect(mocks.post).toHaveBeenCalledWith('/pedidos/42/pagos', { metodo_pago_id: 3, monto: 25, referencia: 'POS-25' })
  })

  it('usa los endpoints reales del CRUD y alertas de insumos', async () => {
    const controller = new AbortController()
    const create = { nombre: 'Cloro', unidad_medida: 'L', stock_actual: 10, stock_minimo: 3 }
    await listInputs(controller.signal)
    await listLowStockInputs(controller.signal)
    await createInput(create)
    await updateInput(7, { stock_minimo: 5 })
    await deactivateInput(7)

    expect(mocks.get).toHaveBeenNthCalledWith(1, '/insumos/', { signal: controller.signal })
    expect(mocks.get).toHaveBeenNthCalledWith(2, '/insumos/alertas/stock-minimo', { signal: controller.signal })
    expect(mocks.post).toHaveBeenCalledWith('/insumos/', create)
    expect(mocks.put).toHaveBeenCalledWith('/insumos/7', { stock_minimo: 5 })
    expect(mocks.delete).toHaveBeenCalledWith('/insumos/7')
  })

  it('envía movimientos con los nombres y valores definidos por backend', async () => {
    const payload = { insumo_id: 7, tipo_movimiento: 'salida' as const, cantidad: 2.5, motivo: 'Consumo' }
    await registerInventoryMovement(payload)
    expect(mocks.post).toHaveBeenCalledWith('/movimientos-inventario/', payload)
  })
})
