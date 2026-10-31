import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listOrders, listOrderStatuses } from '../api/orders'
import { useOrdersOverview } from '../hooks/useOrdersOverview'
import { useAuth } from '../store/auth'
import type { PedidoResumen } from '../types'
import { AdminHomePage } from './AdminHomePage'

vi.mock('../api/orders', () => ({ listOrders: vi.fn(), listOrderStatuses: vi.fn() }))

const iso = (offsetDays: number) => { const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() + offsetDays); return date.toISOString() }
const recibido = { id: 1, nombre: 'Recibido', orden: 10 }
const planchado = { id: 3, nombre: 'En planchado', orden: 30 }
const finalizado = { id: 5, nombre: 'Finalizado', orden: 50, es_terminal: true }
const order = (id: number, extra: Partial<PedidoResumen>): PedidoResumen => ({
  id, fecha_recibido: iso(-2), total: 100, activo: true, cliente: { id: 1, nombre: 'Ana', apellido: 'López', telefono: '55551234' }, estado_actual: recibido, ...extra,
})

beforeEach(() => {
  vi.resetAllMocks()
  useOrdersOverview.setState({ orders: [], total: 0, status: 'idle', error: '', loadedAt: 0 })
  useAuth.setState({ token: 'token', roleId: 1 })
  vi.mocked(listOrderStatuses).mockResolvedValue([recibido, planchado, finalizado])
  vi.mocked(listOrders).mockResolvedValue({
    pedidos: [
      order(17, { fecha_entrega_estimada: iso(-1) }),
      order(16, { estado_actual: planchado, fecha_entrega_estimada: iso(2), total: 300, cliente: { id: 2, nombre: 'Luis', apellido: 'Pérez', telefono: '41330121' } }),
      order(15, {}),
      order(14, { estado_actual: finalizado, fecha_entrega_estimada: iso(-5) }),
    ],
    total: 4, pagina: 1, limite: 100,
  })
})

function renderHome() {
  return render(<MemoryRouter initialEntries={['/inicio']}><Routes>
    <Route path="/inicio" element={<AdminHomePage />} />
    <Route path="/pedidos/:id" element={<h1>Detalle destino</h1>} />
  </Routes></MemoryRouter>)
}

describe('AdminHomePage', () => {
  it('resume la operación con los pedidos reales', async () => {
    renderHome()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Administrador.')
    expect(await screen.findByRole('heading', { name: '3 pedidos en proceso' })).toBeInTheDocument()
    expect(screen.getByLabelText('En planchado: 1')).toBeInTheDocument()
    const attention = screen.getByRole('heading', { name: 'Necesitan atención' }).closest('.ad-card') as HTMLElement
    expect(within(attention).getByText('pedidos con entrega vencida').previousSibling).toHaveTextContent('1')
    expect(within(attention).getByText('pedidos sin fecha de entrega').previousSibling).toHaveTextContent('1')
    expect(screen.getByRole('link', { name: /#SLV-0016 · Luis Pérez/ })).toHaveAttribute('href', '/pedidos/16')
    expect(screen.getByRole('link', { name: 'Ver los 4 pedidos' })).toHaveAttribute('href', '/pedidos')
    expect(screen.getByRole('link', { name: 'Ver pedido #SLV-0017' })).toHaveAttribute('href', '/pedidos/17')
  })

  it('abre un pedido por número y avisa si no existe', async () => {
    const user = userEvent.setup()
    renderHome()
    await screen.findByRole('heading', { name: '3 pedidos en proceso' })
    await user.type(screen.getByLabelText('Abrir un pedido por número'), '99')
    await user.click(screen.getByRole('button', { name: /abrir/i }))
    expect(screen.getByRole('alert')).toHaveTextContent('No existe el pedido #SLV-0099.')
    await user.clear(screen.getByLabelText('Abrir un pedido por número'))
    await user.type(screen.getByLabelText('Abrir un pedido por número'), '16')
    expect(screen.getByText(/Luis Pérez · Q 300\.00/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /abrir/i }))
    expect(screen.getByRole('heading', { name: 'Detalle destino' })).toBeInTheDocument()
  })

  it('muestra el error de carga y permite reintentar', async () => {
    const user = userEvent.setup()
    vi.mocked(listOrders).mockRejectedValueOnce(new Error('network'))
    renderHome()
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar el resumen de pedidos')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { name: '3 pedidos en proceso' })).toBeInTheDocument()
  })
})
