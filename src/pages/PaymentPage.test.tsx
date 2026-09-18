import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentPage } from './PaymentPage'

const mocks = vi.hoisted(() => ({
  balance: vi.fn(),
  methods: vi.fn(),
  register: vi.fn(),
}))

vi.mock('../api/payments', () => ({
  getOrderBalance: mocks.balance,
  listActivePaymentMethods: mocks.methods,
  registerPayment: mocks.register,
}))

function renderPage(path = '/pedidos/42/cobrar') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/pedidos/:pedidoId/cobrar" element={<PaymentPage/>}/></Routes></MemoryRouter>)
}

describe('PaymentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.balance.mockResolvedValue({ pedido_id: 42, total: 80, total_pagado: 30, saldo_pendiente: 50 })
    mocks.methods.mockResolvedValue([
      { id: 1, nombre: 'Efectivo', activo: true },
      { id: 2, nombre: 'Tarjeta', activo: true },
    ])
    mocks.register.mockResolvedValue({ id: 7, monto: 20 })
  })

  it('muestra saldo pendiente, monto y métodos disponibles', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: /cobrar pedido #SLV-0042/i })).toBeInTheDocument()
    expect(screen.getAllByText(/Q\s*50\.00/).length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Monto')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Efectivo' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Tarjeta' })).toBeInTheDocument()
  })

  it('impide registrar un monto superior al saldo pendiente', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.selectOptions(await screen.findByLabelText('Método de pago'), '1')
    await user.type(screen.getByLabelText('Monto'), '50.01')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('no puede superar el saldo pendiente')
    expect(mocks.register).not.toHaveBeenCalled()
  })

  it('registra el pago y actualiza el saldo visible', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.selectOptions(await screen.findByLabelText('Método de pago'), '2')
    await user.type(screen.getByLabelText('Monto'), '20')
    await user.type(screen.getByLabelText('Referencia'), 'AUTH-123')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))

    await waitFor(() => expect(mocks.register).toHaveBeenCalledWith(42, 2, 20, 'AUTH-123'))
    expect(await screen.findByRole('status')).toHaveTextContent(/Pago de Q\s*20\.00 registrado correctamente/)
    expect(screen.getAllByText(/Q\s*30\.00/).length).toBeGreaterThan(0)
  })

  it('permite completar el saldo con un solo botón', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /usar saldo completo/i }))
    expect(screen.getByLabelText('Monto')).toHaveValue(50)
  })
})
