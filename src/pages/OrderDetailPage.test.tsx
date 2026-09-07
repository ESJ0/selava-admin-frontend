import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OrderDetailPage } from './OrderDetailPage'
import { useAuth } from '../store/auth'

const mocks = vi.hoisted(() => ({
  detail: vi.fn(),
  history: vi.fn(),
  statuses: vi.fn(),
  cancel: vi.fn(),
  updateStatus: vi.fn(),
}))

vi.mock('../api/orders', () => ({
  getOrder: mocks.detail,
  getOrderHistory: mocks.history,
  listOrderStatuses: mocks.statuses,
  cancelOrder: mocks.cancel,
  updateOrderStatus: mocks.updateStatus,
}))

const detail = {
  id: 42,
  cliente_id: 1,
  usuario_id: 7,
  estado_actual_id: 1,
  fecha_recibido: '2026-09-05T10:00:00Z',
  fecha_entrega_estimada: '2026-09-07T10:00:00Z',
  total: 50,
  activo: true,
  cliente: { id: 1, nombre: 'Ana', apellido: 'Martínez', telefono: '5555-5555', email: 'ana@example.com', activo: true },
  estado_actual: { id: 1, nombre: 'Recibido', orden: 1 },
  prendas: [{
    id: 9, pedido_id: 42, tipo_prenda_id: 2, cantidad: 2, color: 'Azul',
    tipo_prenda: { id: 2, nombre: 'Camisa', activo: true },
    servicios: [{ id: 5, prenda_id: 9, servicio_id: 3, precio_aplicado: 25, servicio: { id: 3, nombre: 'Lavado', activo: true, precio_base: 25 } }],
  }],
  pagos: [],
}

function renderPage(operatorMode = false) {
  return render(<MemoryRouter initialEntries={['/pedidos/42']}><Routes><Route path="/pedidos/:pedidoId" element={<OrderDetailPage operatorMode={operatorMode}/>} /></Routes></MemoryRouter>)
}

describe('OrderDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.setState({ roleId: 2 })
    mocks.detail.mockResolvedValue(detail)
    mocks.history.mockResolvedValue([{
      id: 1, pedido_id: 42, estado_id: 1, usuario_id: 7, fecha_cambio: '2026-09-05T10:00:00Z',
      estado: { id: 1, nombre: 'Recibido', orden: 1 }, usuario: { id: 7, nombre: 'Luis', apellido: 'Pérez' },
    }])
    mocks.statuses.mockResolvedValue([
      { id: 1, nombre: 'Recibido', orden: 1 },
      { id: 2, nombre: 'Rackeado', orden: 2 },
      { id: 3, nombre: 'Entregado', orden: 3 },
      { id: 4, nombre: 'Cancelado', orden: 99 },
    ])
    mocks.cancel.mockResolvedValue({})
    mocks.updateStatus.mockResolvedValue({})
  })

  it('muestra cliente, prendas, servicios, total e historial con responsable', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: '#SLV-0042' })).toBeInTheDocument()
    expect(screen.getByText('Ana Martínez')).toBeInTheDocument()
    expect(screen.getByText('Camisa × 2')).toBeInTheDocument()
    expect(screen.getByText('Lavado')).toBeInTheDocument()
    expect(screen.getAllByText(/Q\s*50\.00/).length).toBeGreaterThan(0)
    expect(screen.getByText('Luis Pérez')).toBeInTheDocument()
  })

  it('solicita confirmación antes de cancelar', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /^cancelar pedido$/i }))
    expect(screen.getByRole('dialog', { name: /cancelar pedido/i })).toBeInTheDocument()
    expect(mocks.cancel).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /sí, cancelar pedido/i }))
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledWith(42))
    expect(await screen.findByText(/fue cancelado correctamente/i)).toBeInTheDocument()
  })

  it('permite al operario avanzar a Rackeado y excluye Cancelado', async () => {
    const user = userEvent.setup()
    useAuth.setState({ roleId: 3 })
    renderPage(true)
    const selector = await screen.findByLabelText('Nuevo estado')
    expect(screen.queryByRole('button', { name: /^cancelar pedido$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Cancelado' })).not.toBeInTheDocument()
    await user.selectOptions(selector, '2')
    await user.type(screen.getByLabelText('Observaciones'), 'Lista para entregar')
    await user.click(screen.getByRole('button', { name: /actualizar estado/i }))
    await waitFor(() => expect(mocks.updateStatus).toHaveBeenCalledWith(42, 2, 'Lista para entregar'))
  })
})
