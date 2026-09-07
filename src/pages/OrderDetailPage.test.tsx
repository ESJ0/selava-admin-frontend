import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
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

  it('muestra carga, 404 y permite reintentar sin datos anteriores', async () => {
    mocks.detail.mockRejectedValueOnce({ isAxiosError: true, response: { status: 404, data: { error: 'pedido no encontrado' } } })
    renderPage()
    expect(screen.getByRole('status')).toHaveTextContent('Cargando pedido')
    expect(await screen.findByRole('heading', { name: 'Pedido no encontrado' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^cancelar pedido$/i })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }))
    expect(await screen.findByRole('heading', { name: '#SLV-0042' })).toBeInTheDocument()
  })

  it('no muestra éxito engañoso ni acciones obsoletas si falla recargar tras guardar', async () => {
    mocks.detail.mockResolvedValueOnce(detail).mockRejectedValueOnce({ isAxiosError: true, response: { status: 500 } })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /^cancelar pedido$/i }))
    await userEvent.click(screen.getByRole('button', { name: /sí, cancelar pedido/i }))
    expect(await screen.findByText(/El cambio se guardó, pero no pudimos recargar/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^cancelar pedido$/i })).not.toBeInTheDocument()
    expect(screen.queryByText('El pedido fue cancelado correctamente.')).not.toBeInTheDocument()
  })

  it('recarga el estado real cuando el servidor rechaza cancelar por estar en proceso', async () => {
    mocks.cancel.mockRejectedValueOnce({ isAxiosError: true, response: { status: 409, data: { error: 'El pedido ya está en proceso.' } } })
    mocks.detail.mockResolvedValueOnce(detail).mockResolvedValueOnce({ ...detail, estado_actual: { id: 2, nombre: 'Rackeado', orden: 2 } })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /^cancelar pedido$/i }))
    await userEvent.click(screen.getByRole('button', { name: /sí, cancelar pedido/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El pedido ya está en proceso.')
    expect(screen.getByRole('button', { name: /^cancelar pedido$/i })).toBeDisabled()
  })

  it('ignora una respuesta tardía después de navegar a otro pedido', async () => {
    let finishFirst!: (value: typeof detail) => void
    mocks.detail.mockImplementation((id: number) => id === 42 ? new Promise(resolve => { finishFirst = resolve }) : Promise.resolve({ ...detail, id: 43 }))
    render(<MemoryRouter initialEntries={['/pedidos/42']}><Link to="/pedidos/43">Otro pedido</Link><Routes><Route path="/pedidos/:pedidoId" element={<OrderDetailPage/>}/></Routes></MemoryRouter>)
    await userEvent.click(screen.getByRole('link', { name: 'Otro pedido' }))
    expect(await screen.findByRole('heading', { name: '#SLV-0043' })).toBeInTheDocument()
    finishFirst(detail)
    await waitFor(() => expect(screen.queryByRole('heading', { name: '#SLV-0042' })).not.toBeInTheDocument())
  })

  it('bloquea estados terminales incluso si el catálogo contiene otros órdenes posteriores', async () => {
    mocks.detail.mockResolvedValue({ ...detail, estado_actual: { id: 3, nombre: 'Entregado', orden: 3 } })
    mocks.statuses.mockResolvedValue([{ id: 9, nombre: 'Otro', orden: 5 }])
    renderPage(true)
    expect(await screen.findByText('Este pedido ya no tiene estados pendientes.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nuevo estado')).not.toBeInTheDocument()
  })

  it('limita observaciones según bytes UTF-8 del contrato backend', async () => {
    renderPage(true)
    await userEvent.selectOptions(await screen.findByLabelText('Nuevo estado'), '2')
    await userEvent.type(screen.getByLabelText('Observaciones'), 'ñ'.repeat(128))
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar estado' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('demasiado largas')
    expect(mocks.updateStatus).not.toHaveBeenCalled()
  })

  it('muestra prendas vacías y pagos devueltos por el backend', async () => {
    mocks.detail.mockResolvedValue({ ...detail, prendas: [], pagos: [{ id: 1, monto: 20, fecha_pago: '2026-09-05T10:00:00Z', referencia: 'ABC', metodo_pago: { id: 1, nombre: 'Efectivo', activo: true } }] })
    renderPage()
    expect(await screen.findByText('Este pedido no tiene prendas registradas.')).toBeInTheDocument()
    expect(screen.getByText('Efectivo')).toBeInTheDocument()
    expect(screen.getByText(/ABC/)).toBeInTheDocument()
  })
})
