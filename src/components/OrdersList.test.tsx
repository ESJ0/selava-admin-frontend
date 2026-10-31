import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listOrders, listOrderStatuses } from '../api/orders'
import type { PedidoListResponse } from '../types'
import { OrdersList } from './OrdersList'
import { useOrdersOverview } from '../hooks/useOrdersOverview'

vi.mock('../api/orders', () => ({ listOrders: vi.fn(), listOrderStatuses: vi.fn() }))
const list = vi.mocked(listOrders)
const statuses = vi.mocked(listOrderStatuses)
const response: PedidoListResponse = {
  pedidos: [{ id: 42, fecha_recibido: '2026-10-05T16:00:00Z', fecha_entrega_estimada: '2026-10-07T18:00:00Z', total: 145, activo: true,
    cliente: { id: 1, nombre: 'Ana', apellido: 'Pérez', telefono: '55123456' }, estado_actual: { id: 3, nombre: 'Lavado', orden: 3 } }],
  total: 1, pagina: 1, limite: 10,
}

function renderList(path = '/pedidos', detailBase = '/pedidos') {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/pedidos" element={<OrdersList detailBase={detailBase}/>}/>
    <Route path={`${detailBase}/:id`} element={<h1>Detalle del pedido</h1>}/>
  </Routes></MemoryRouter>)
}

beforeEach(() => {
  useOrdersOverview.setState({ orders: [], total: 0, status: 'idle', error: '', loadedAt: 0 })
  vi.resetAllMocks()
  list.mockResolvedValue(response)
  statuses.mockResolvedValue([{ id: 1, nombre: 'Recibido', orden: 1 }, { id: 3, nombre: 'Lavado', orden: 3 }])
})

describe('listado de pedidos', () => {
  it('carga todos los pedidos y abre su detalle desde la lista', async () => {
    const user = userEvent.setup()
    renderList()
    expect(await screen.findByText('#SLV-0042')).toBeInTheDocument()
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getAllByText(/Q\s*145\.00/).length).toBeGreaterThan(0)
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ pagina: 1, limite: 10, orden: 'recientes', q: undefined, estado_id: undefined }), expect.any(AbortSignal))
    await user.click(screen.getByRole('link', { name: 'Ver pedido SLV-0042' }))
    expect(screen.getByRole('heading', { name: 'Detalle del pedido' })).toBeInTheDocument()
  })

  it('aplica al instante búsqueda, estado, fechas y orden y vuelve a la primera página', async () => {
    const user = userEvent.setup()
    list.mockResolvedValue({ ...response, total: 21, pagina: 2 })
    renderList('/pedidos?pagina=2&q=anterior')
    await screen.findByText('#SLV-0042')
    await user.clear(screen.getByLabelText('Buscar pedido o cliente'))
    await user.type(screen.getByLabelText('Buscar pedido o cliente'), '  Ana  ')
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'Ana', pagina: 1 }), expect.any(AbortSignal)))
    await user.click(await screen.findByRole('button', { name: /^Lavado/ }))
    fireEvent.change(screen.getByLabelText('Recibido desde'), { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByLabelText('Recibido hasta'), { target: { value: '2026-10-05' } })
    await user.selectOptions(screen.getByLabelText('Ordenar por'), 'antiguos')
    await waitFor(() => expect(list).toHaveBeenLastCalledWith({ q: 'Ana', estado_id: 3, fecha_desde: '2026-10-01', fecha_hasta: '2026-10-05', orden: 'antiguos', pagina: 1, limite: 10 }, expect.any(AbortSignal)))
    expect(screen.getByRole('button', { name: /^Lavado/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('rechaza fechas invertidas antes de consultar el servidor', async () => {
    renderList()
    await screen.findByText('#SLV-0042')
    const before = list.mock.calls.length
    fireEvent.change(screen.getByLabelText('Recibido hasta'), { target: { value: '2026-10-01' } })
    await waitFor(() => expect(list.mock.calls.length).toBeGreaterThan(before))
    const afterValidDate = list.mock.calls.length
    fireEvent.change(screen.getByLabelText('Recibido desde'), { target: { value: '2026-10-10' } })
    expect(screen.getByRole('alert')).toHaveTextContent('La fecha hasta no puede ser anterior')
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(list.mock.calls.length).toBe(afterValidDate)
  })

  it('pagina conservando filtros y los elimina al limpiar', async () => {
    const user = userEvent.setup()
    list.mockResolvedValue({ ...response, total: 21 })
    renderList('/pedidos?q=Ana&estado_id=3&fecha_desde=2026-10-01')
    await screen.findByText('#SLV-0042')
    await user.click(screen.getByRole('button', { name: 'Página siguiente de pedidos' }))
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'Ana', estado_id: 3, fecha_desde: '2026-10-01', pagina: 2 }), expect.any(AbortSignal)))
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ q: undefined, estado_id: undefined, fecha_desde: undefined, pagina: 1 }), expect.any(AbortSignal)))
    expect(screen.getByLabelText('Buscar pedido o cliente')).toHaveValue('')
    expect(screen.getByLabelText('Recibido desde')).toHaveValue('')
  })

  it('muestra errores y permite reintentar con los filtros aplicados', async () => {
    const user = userEvent.setup()
    list.mockRejectedValueOnce({ isAxiosError: true, response: { status: 500 } }).mockResolvedValue(response)
    renderList('/pedidos?q=Ana')
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos completar la operación')
    await user.click(screen.getByRole('button', { name: 'Reintentar listado' }))
    expect(await screen.findByText('#SLV-0042')).toBeInTheDocument()
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'Ana' }), expect.any(AbortSignal))
  })

  it('descarta una respuesta vieja después de cambiar la búsqueda', async () => {
    const user = userEvent.setup()
    let finishOld!: (value: PedidoListResponse) => void
    list.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
    list.mockResolvedValue({ ...response, pedidos: [{ ...response.pedidos[0], id: 43 }] })
    renderList()
    await user.type(screen.getByLabelText('Buscar pedido o cliente'), 'Ana')
    expect(await screen.findByText('#SLV-0043', {}, { timeout: 2000 })).toBeInTheDocument()
    await act(async () => { finishOld(response) })
    expect(screen.queryByText('#SLV-0042')).not.toBeInTheDocument()
  })

  it('mantiene el destino de actualización del operario y permite quitar filtros sin resultados', async () => {
    const user = userEvent.setup()
    list.mockResolvedValueOnce({ pedidos: [], total: 0, pagina: 1, limite: 10 }).mockResolvedValue(response)
    renderList('/pedidos?q=inexistente', '/operario/pedidos')
    expect(await screen.findByText('No hay pedidos que coincidan con los filtros.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver todos los pedidos' }))
    expect(await screen.findByRole('link', { name: 'Ver pedido SLV-0042' })).toHaveAttribute('href', '/operario/pedidos/42')
  })
})
