import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listOrders, listOrderStatuses } from '../api/orders'
import { OrderLookupPage } from './OrderLookupPage'
import { useAuth } from '../store/auth'

vi.mock('../api/orders', () => ({ listOrders: vi.fn(), listOrderStatuses: vi.fn() }))
beforeEach(() => {
  vi.mocked(listOrders).mockResolvedValue({ pedidos: [], total: 0, pagina: 1, limite: 20 })
  vi.mocked(listOrderStatuses).mockResolvedValue([])
})

describe('OrderLookupPage', () => {
  it('valida el número y lleva al operario a su flujo de actualización', async () => {
    const user = userEvent.setup()
    useAuth.setState({ roleId: 3 })
    render(<MemoryRouter initialEntries={['/pedidos']}><Routes>
      <Route path="/pedidos" element={<OrderLookupPage/>}/>
      <Route path="/operario/pedidos/:pedidoId" element={<div>Flujo operario</div>}/>
    </Routes></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: /abrir pedido/i }))
    expect(screen.getByText(/número de pedido válido/i)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Número de pedido'), '42')
    await user.click(screen.getByRole('button', { name: /abrir pedido/i }))
    expect(await screen.findByText('Flujo operario')).toBeInTheDocument()
  })
})
