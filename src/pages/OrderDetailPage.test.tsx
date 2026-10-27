import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OrderDetailPage } from './OrderDetailPage'
import { useAuth } from '../store/auth'
import { applied } from '../test/promotionFixtures'

const mocks = vi.hoisted(() => ({
  detail: vi.fn(),
  history: vi.fn(),
  statuses: vi.fn(),
  cancel: vi.fn(),
  updateStatus: vi.fn(),
  balance: vi.fn(),
  payments: vi.fn(),
  methods: vi.fn(),
  registerPayment: vi.fn(),
}))

vi.mock('../api/orders', () => ({
  getOrder: mocks.detail,
  getOrderHistory: mocks.history,
  listOrderStatuses: mocks.statuses,
  cancelOrder: mocks.cancel,
  updateOrderStatus: mocks.updateStatus,
}))

vi.mock('../api/payments', () => ({
  getOrderBalance: mocks.balance,
  getOrderPayments: mocks.payments,
  listPaymentMethods: mocks.methods,
  registerOrderPayment: mocks.registerPayment,
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
  flujo_operativo: {
    progreso_porcentaje: 25,
    cancelado: false,
    siguiente_estado: { id: 5, nombre: 'En lavado', orden: 20 },
    estados: [
      { id: 1, nombre: 'Recibido', orden: 10, servicios: [], completado: true, actual: true },
      { id: 5, nombre: 'En lavado', orden: 20, servicios: [{ id: 3, nombre: 'Lavado' }], completado: false, actual: false },
      { id: 2, nombre: 'Rackeado', orden: 50, servicios: [], completado: false, actual: false },
      { id: 3, nombre: 'Finalizado', orden: 60, servicios: [], completado: false, actual: false },
    ],
  },
  prendas: [{
    id: 9, pedido_id: 42, tipo_prenda_id: 2, cantidad: 2, color: 'Azul',
    tipo_prenda: { id: 2, nombre: 'Camisa', precio: 999, modalidad_cobro: 'UNIDAD', activo: true },
    servicios: [{ id: 5, prenda_id: 9, servicio_id: 3, precio_aplicado: 25, servicio: { id: 3, nombre: 'Lavado', activo: true, precio_base: 25 } }],
  }],
  pagos: [],
}

function renderPage(operatorMode = false) {
  return render(<MemoryRouter initialEntries={['/pedidos/42']}><Routes><Route path="/pedidos/:pedidoId" element={<OrderDetailPage operatorMode={operatorMode}/>} /></Routes></MemoryRouter>)
}

describe('OrderDetailPage', () => {
  it('presenta la promoción persistida aunque el catálogo tenga otro precio y modalidad', async () => {
    useAuth.setState({ roleId: 3 })
    mocks.detail.mockResolvedValue({ ...detail, total: 105, promociones_aplicadas: [applied] })
    mocks.history.mockResolvedValue([]); mocks.statuses.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('Dos por cuarenta')).toBeInTheDocument()
    expect(screen.getByText('4 unidades')).toBeInTheDocument()
    expect(screen.getByText(/Q\s*80\.00/)).toBeInTheDocument()
    expect(screen.getByText(/1 unidad × Q\s*25\.00/)).toBeInTheDocument()
    expect(screen.getAllByText(/Q\s*105\.00/).length).toBeGreaterThan(0)
  })
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
    mocks.balance.mockResolvedValue({ pedido_id: 42, total: 50, total_pagado: 0, saldo_pendiente: 50 })
    mocks.payments.mockResolvedValue([])
    mocks.methods.mockResolvedValue([{ id: 1, nombre: 'Efectivo', activo: true }])
    mocks.registerPayment.mockResolvedValue({})
  })

  it('usa modalidad congelada y redondeo decimal aun si cambió el catálogo', async () => {
    mocks.detail.mockResolvedValue({ ...detail, prendas: [{ ...detail.prendas[0], cantidad: 0.5, precio_aplicado: 1.23, modalidad_cobro_aplicada: 'LIBRA', tipo_prenda: { ...detail.prendas[0].tipo_prenda, modalidad_cobro: 'METRO' } }] })
    renderPage()
    expect(await screen.findByText('0.5 libras · Azul')).toBeInTheDocument()
    expect(screen.getByText(/0.5 libras ×.*por libra/)).toBeInTheDocument()
    expect(document.querySelector('.garment-detail-list article')).toHaveTextContent(/Q\s*0\.62/)
  })

  it('mantiene unidades en históricos sin instantánea aunque cambie el catálogo', async () => {
    mocks.detail.mockResolvedValue({ ...detail, prendas: [{ ...detail.prendas[0], tipo_prenda: { ...detail.prendas[0].tipo_prenda, modalidad_cobro: 'LIBRA' } }] })
    renderPage()
    expect(await screen.findByText('2 unidades · Azul')).toBeInTheDocument()
  })

  it('muestra la tarifa congelada de la prenda y no los precios actuales del catálogo', async () => {
    mocks.detail.mockResolvedValue({ ...detail, prendas: [{ ...detail.prendas[0], precio_aplicado: 25, servicios: [{ ...detail.prendas[0].servicios[0], precio_aplicado: 0 }] }] })
    renderPage()
    expect(await screen.findByText('Precio aplicado')).toBeInTheDocument()
    expect(screen.getByText('Lavado')).toBeInTheDocument()
    expect(screen.queryByText(/Q\s*999\.00/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Q\s*0\.00 por unidad/)).not.toBeInTheDocument()
    expect(screen.getAllByText(/Q\s*50\.00/).length).toBeGreaterThan(0)
  })

  it('muestra cliente, prendas, servicios, total e historial con responsable', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: '#SLV-0042' })).toBeInTheDocument()
    expect(screen.getByText('Ana Martínez')).toBeInTheDocument()
    expect(screen.getByText('2 unidades · Azul')).toBeInTheDocument()
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

  it('permite a la recepcionista avanzar únicamente a la etapa aplicable siguiente', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('Aplica por: Lavado')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Observaciones'), 'Lista para entregar')
    await user.click(screen.getByRole('button', { name: /avanzar a en lavado/i }))
    await waitFor(() => expect(mocks.updateStatus).toHaveBeenCalledWith(42, 5, 'Lista para entregar'))
  })

  it('muestra el timeline al operario sin permitirle cambiar el estado', async () => {
    useAuth.setState({ roleId: 3 })
    renderPage(true)

    expect(await screen.findByRole('list', { name: 'Etapas del pedido' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /avanzar a/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Observaciones')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^cancelar pedido$/i })).not.toBeInTheDocument()
  })

  it('solicita confirmación antes de avanzar a Finalizado', async () => {
    const finalStatus = { id: 3, nombre: 'Finalizado', codigo: 'FINALIZADO', orden: 60, es_terminal: true }
    mocks.detail.mockResolvedValue({
      ...detail,
      estado_actual: { id: 2, nombre: 'Rackeado', orden: 50 },
      flujo_operativo: { ...detail.flujo_operativo, siguiente_estado: finalStatus },
    })
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Avanzar a Finalizado' }))
    expect(mocks.updateStatus).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Finalizar pedido' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sí, finalizar pedido' }))
    await waitFor(() => expect(mocks.updateStatus).toHaveBeenCalledWith(42, 3, ''))
  })

  it('muestra el rechazo de una transición y recarga el progreso real', async () => {
    mocks.updateStatus.mockRejectedValueOnce({ isAxiosError: true, response: { status: 409, data: { error: 'La transición ya no está disponible.' } } })
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /avanzar a en lavado/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La transición ya no está disponible.')
    expect(mocks.detail).toHaveBeenCalledTimes(2)
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

  it('bloquea cambios cuando el flujo llegó a Finalizado', async () => {
    mocks.detail.mockResolvedValue({ ...detail, estado_actual: { id: 3, nombre: 'Finalizado', orden: 60 }, flujo_operativo: { ...detail.flujo_operativo, progreso_porcentaje: 100, siguiente_estado: undefined, estados: detail.flujo_operativo.estados.map(stage => ({ ...stage, completado: true, actual: stage.nombre === 'Finalizado' })) } })
    mocks.statuses.mockResolvedValue([{ id: 9, nombre: 'Otro', orden: 5 }])
    renderPage(true)
    expect(await screen.findByText('El flujo operativo está finalizado.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /avanzar a/i })).not.toBeInTheDocument()
  })

  it('limita observaciones según bytes UTF-8 del contrato backend', async () => {
    renderPage(true)
    fireEvent.change(await screen.findByLabelText('Observaciones'), { target: { value: 'ñ'.repeat(128) } })
    await userEvent.click(screen.getByRole('button', { name: /avanzar a en lavado/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('demasiado largas')
    expect(mocks.updateStatus).not.toHaveBeenCalled()
  })

  it('muestra prendas vacías y pagos del endpoint dedicado', async () => {
    mocks.detail.mockResolvedValue({ ...detail, prendas: [] })
    mocks.payments.mockResolvedValue([{ id: 1, pedido_id: 42, metodo_pago_id: 1, usuario_id: 7, monto: 20, fecha_pago: '2026-09-05T10:00:00Z', referencia: 'ABC', metodo_pago: { id: 1, nombre: 'Efectivo', activo: true }, usuario: { id: 7, nombre: 'Luis', apellido: 'Pérez' } }])
    renderPage()
    expect(await screen.findByText('Este pedido no tiene prendas registradas.')).toBeInTheDocument()
    expect((await screen.findAllByText('Efectivo')).length).toBeGreaterThan(0)
    expect(screen.getByText(/ABC/)).toBeInTheDocument()
    expect(screen.getAllByText(/Luis Pérez/).length).toBeGreaterThan(1)
  })
})
