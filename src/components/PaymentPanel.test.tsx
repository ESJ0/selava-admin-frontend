import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentPanel } from './PaymentPanel'

const mocks = vi.hoisted(() => ({
  balance: vi.fn(),
  payments: vi.fn(),
  methods: vi.fn(),
  register: vi.fn(),
}))

vi.mock('../api/payments', () => ({
  getOrderBalance: mocks.balance,
  getOrderPayments: mocks.payments,
  listPaymentMethods: mocks.methods,
  registerOrderPayment: mocks.register,
}))

const payment = {
  id: 1, pedido_id: 42, metodo_pago_id: 1, usuario_id: 7, monto: 30,
  fecha_pago: '2026-09-21T10:00:00Z', referencia: 'POS-123',
  metodo_pago: { id: 1, nombre: 'Efectivo', activo: true },
  usuario: { id: 7, nombre: 'Ana', apellido: 'López' },
}

describe('PaymentPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.balance.mockResolvedValue({ pedido_id: 42, total: 100, total_pagado: 30, saldo_pendiente: 70 })
    mocks.payments.mockResolvedValue([payment])
    mocks.methods.mockResolvedValue([{ id: 1, nombre: 'Efectivo', activo: true }])
    mocks.register.mockResolvedValue(payment)
  })

  it('carga saldo oficial e historial completo', async () => {
    render(<PaymentPanel orderId={42} onPaymentSaved={vi.fn().mockResolvedValue(true)}/>)
    expect(screen.getByRole('status')).toHaveTextContent('Cargando saldo')
    expect(await screen.findByText(/Ana López/)).toBeInTheDocument()
    expect(screen.getByText(/POS-123/)).toBeInTheDocument()
    expect(screen.getAllByText(/70\.00/).length).toBeGreaterThan(0)
    expect(mocks.balance).toHaveBeenCalledWith(42, expect.any(AbortSignal))
    expect(mocks.payments).toHaveBeenCalledWith(42, expect.any(AbortSignal))
  })

  it('registra un pago y refresca saldo, historial y detalle', async () => {
    const user = userEvent.setup()
    const refreshDetail = vi.fn().mockResolvedValue(true)
    render(<PaymentPanel orderId={42} onPaymentSaved={refreshDetail}/>)
    await screen.findByText(/Ana López/)
    await user.type(screen.getByLabelText('Monto'), '20')
    await user.selectOptions(screen.getByLabelText('Método de pago'), '1')
    await user.type(screen.getByLabelText('Referencia'), ' TRANS-9 ')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    await waitFor(() => expect(mocks.register).toHaveBeenCalledWith(42, { metodo_pago_id: 1, monto: 20, referencia: 'TRANS-9' }))
    expect(refreshDetail).toHaveBeenCalled()
    expect(mocks.balance).toHaveBeenCalledTimes(2)
    expect(mocks.payments).toHaveBeenCalledTimes(2)
    expect(await screen.findByText('Pago registrado correctamente.')).toBeInTheDocument()
  })

  it('rechaza sobrepago en UI y traduce el conflicto del backend', async () => {
    const user = userEvent.setup()
    render(<PaymentPanel orderId={42} onPaymentSaved={vi.fn().mockResolvedValue(true)}/>)
    await screen.findByText(/Ana López/)
    await user.type(screen.getByLabelText('Monto'), '71')
    await user.selectOptions(screen.getByLabelText('Método de pago'), '1')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El monto ingresado supera el saldo pendiente.')
    expect(mocks.register).not.toHaveBeenCalled()

    await user.clear(screen.getByLabelText('Monto'))
    await user.type(screen.getByLabelText('Monto'), '60')
    mocks.register.mockRejectedValueOnce({ isAxiosError: true, response: { status: 409, data: { error: 'el monto del pago excede el saldo pendiente' } } })
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El monto ingresado supera el saldo pendiente.')
  })

  it('muestra estado vacío cuando no existen pagos', async () => {
    mocks.payments.mockResolvedValue([])
    render(<PaymentPanel orderId={42} onPaymentSaved={vi.fn().mockResolvedValue(true)}/>)
    expect(await screen.findByText('Sin pagos registrados.')).toBeInTheDocument()
  })
})
