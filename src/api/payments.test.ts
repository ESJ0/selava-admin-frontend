import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './client'
import { getOrderBalance, listActivePaymentMethods, registerPayment } from './payments'

afterEach(() => vi.restoreAllMocks())

describe('contrato API de pagos', () => {
  it('consulta el saldo y filtra métodos de pago inactivos', async () => {
    const get = vi.spyOn(api, 'get')
      .mockResolvedValueOnce({ data: { pedido_id: 42, total: 80, total_pagado: 30, saldo_pendiente: 50 } })
      .mockResolvedValueOnce({ data: [
        { id: 1, nombre: 'Efectivo', activo: true },
        { id: 2, nombre: 'Cheque', activo: false },
      ] })
    const signal = new AbortController().signal

    const balance = await getOrderBalance(42, signal)
    const methods = await listActivePaymentMethods(signal)

    expect(get.mock.calls).toEqual([
      ['/pedidos/42/saldo', { signal }],
      ['/metodos-pago/', { signal }],
    ])
    expect(balance.saldo_pendiente).toBe(50)
    expect(methods.map(method => method.nombre)).toEqual(['Efectivo'])
  })

  it('registra monto, método y referencia normalizada', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 9, monto: 25 } })

    await registerPayment(42, 3, 25, '  AUTH-123  ')

    expect(post).toHaveBeenCalledWith('/pedidos/42/pagos', {
      metodo_pago_id: 3,
      monto: 25,
      referencia: 'AUTH-123',
    })
  })
})
