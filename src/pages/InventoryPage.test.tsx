import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InventoryPage } from './InventoryPage'
import { useAuth } from '../store/auth'

const mocks = vi.hoisted(() => ({ list: vi.fn(), lowStock: vi.fn(), create: vi.fn(), update: vi.fn(), deactivate: vi.fn(), movement: vi.fn() }))
vi.mock('../api/inventory', () => ({
  listInputs: mocks.list,
  listLowStockInputs: mocks.lowStock,
  createInput: mocks.create,
  updateInput: mocks.update,
  deactivateInput: mocks.deactivate,
  registerInventoryMovement: mocks.movement,
}))

const input = { id: 1, nombre: 'Detergente', descripcion: 'Líquido', unidad_medida: 'L', stock_actual: 10, stock_minimo: 5, activo: true, created_at: '2026-09-21T10:00:00Z', updated_at: '2026-09-21T10:00:00Z' }

describe('InventoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.setState({ roleId: 1 })
    mocks.list.mockResolvedValue([input])
    mocks.lowStock.mockResolvedValue([])
    mocks.create.mockResolvedValue(input)
    mocks.update.mockResolvedValue(input)
    mocks.deactivate.mockResolvedValue(undefined)
    mocks.movement.mockResolvedValue({ id: 1, insumo_id: 1, usuario_id: 1, tipo_movimiento: 'salida', cantidad: 4 })
  })

  it('lista insumos con sus stocks y unidad', async () => {
    render(<InventoryPage/>)
    const card = await screen.findByRole('article', { name: 'Detergente' })
    expect(within(card).getByText('Disponible')).toBeInTheDocument()
    expect(within(card).getByRole('img', { name: 'Stock 10 de mínimo 5' })).toBeInTheDocument()
    expect(within(card).getByText('5 L')).toBeInTheDocument()
    expect(within(card).getByRole('switch', { name: /detergente/i })).toHaveAttribute('aria-checked', 'true')
  })

  it('advierte cuando el stock alcanza el mínimo y cuando se agota', async () => {
    mocks.list.mockResolvedValue([{ ...input, stock_actual: 5 }, { ...input, id: 2, nombre: 'Cloro', stock_actual: 0 }])
    render(<InventoryPage/>)
    expect(await within(await screen.findByRole('article', { name: 'Detergente' })).findByText('Stock bajo')).toBeInTheDocument()
    expect(within(screen.getByRole('article', { name: 'Cloro' })).getByText('Agotado')).toBeInTheDocument()
  })

  it('crea un insumo y refresca el listado', async () => {
    const user = userEvent.setup()
    render(<InventoryPage/>)
    await user.click(await screen.findByRole('button', { name: /nuevo insumo/i }))
    const form = within(screen.getByRole('form', { name: 'Formulario de insumo' }))
    await user.type(form.getByLabelText(/^Nombre/), 'Cloro')
    await user.click(form.getByRole('button', { name: 'L' }))
    expect(form.getByLabelText(/^Unidad de medida/)).toHaveValue('L')
    await user.clear(form.getByLabelText(/^Stock actual/))
    await user.type(form.getByLabelText(/^Stock actual/), '8')
    await user.clear(form.getByLabelText(/^Stock mínimo/))
    await user.type(form.getByLabelText(/^Stock mínimo/), '3')
    await user.click(form.getByRole('button', { name: 'Guardar insumo' }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Cloro', unidad_medida: 'L', stock_actual: 8, stock_minimo: 3 })))
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Insumo creado')).toBeInTheDocument()
  })

  it('edita un insumo usando el contrato real', async () => {
    const user = userEvent.setup()
    render(<InventoryPage/>)
    await user.click(await screen.findByRole('button', { name: 'Editar Detergente' }))
    const form = within(screen.getByRole('form', { name: 'Formulario de insumo' }))
    await user.clear(form.getByLabelText(/^Stock mínimo/))
    await user.type(form.getByLabelText(/^Stock mínimo/), '7')
    await user.click(form.getByRole('button', { name: 'Guardar insumo' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(1, expect.objectContaining({ nombre: 'Detergente', unidad_medida: 'L', stock_minimo: 7 })))
  })

  it('valida campos obligatorios antes de llamar la API', async () => {
    const user = userEvent.setup()
    render(<InventoryPage/>)
    await user.click(await screen.findByRole('button', { name: /nuevo insumo/i }))
    const form = within(screen.getByRole('form', { name: 'Formulario de insumo' }))
    await user.clear(form.getByLabelText(/^Stock actual/))
    await user.type(form.getByLabelText(/^Stock actual/), '-1')
    expect(form.getByLabelText(/^Stock actual/)).toHaveValue('1')
    await user.clear(form.getByLabelText(/^Stock mínimo/))
    await user.click(form.getByRole('button', { name: 'Guardar insumo' }))
    expect(form.getByText('Escribe un nombre.')).toBeInTheDocument()
    expect(form.getByText('Indica la unidad.')).toBeInTheDocument()
    expect(form.getByText('Número igual o mayor que cero.')).toBeInTheDocument()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('desactiva un insumo con el interruptor', async () => {
    const user = userEvent.setup()
    render(<InventoryPage/>)
    const toggle = await screen.findByRole('switch', { name: /detergente/i })
    await user.click(toggle)
    expect(mocks.deactivate).toHaveBeenCalledWith(1)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'))
  })

  it('registra una salida con el contrato real y refresca el stock', async () => {
    const user = userEvent.setup()
    render(<InventoryPage/>)
    await user.click(await screen.findByRole('button', { name: 'Registrar movimiento' }))
    const form = within(screen.getByRole('form', { name: 'Formulario de movimiento de inventario' }))
    await user.click(form.getByRole('radio', { name: /detergente/i }))
    await user.click(form.getByRole('radio', { name: /salida/i }))
    await user.type(form.getByLabelText(/^Cantidad/), '4')
    expect(within(screen.getByRole('dialog')).getByText('−4')).toBeInTheDocument()
    await user.type(form.getByLabelText(/^Motivo/), ' Uso diario ')
    await user.click(form.getByRole('button', { name: 'Registrar movimiento' }))
    await waitFor(() => expect(mocks.movement).toHaveBeenCalledWith({ insumo_id: 1, tipo_movimiento: 'salida', cantidad: 4, motivo: 'Uso diario' }))
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Salida registrada correctamente.')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Formulario de movimiento de inventario' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('complementary', { name: 'Movimientos recientes' })).getByText('−4 L')).toBeInTheDocument()
  })

  it('abre el movimiento desde la tarjeta con el insumo elegido', async () => {
    const user = userEvent.setup()
    render(<InventoryPage/>)
    await user.click(await screen.findByRole('button', { name: 'Registrar movimiento de Detergente' }))
    expect(within(screen.getByRole('dialog')).getByRole('radio', { name: /detergente/i })).toHaveAttribute('aria-checked', 'true')
  })

  it('impide una salida mayor al stock antes de llamar la API', async () => {
    const user = userEvent.setup()
    render(<InventoryPage/>)
    await user.click(await screen.findByRole('button', { name: 'Registrar movimiento' }))
    const form = within(screen.getByRole('form', { name: 'Formulario de movimiento de inventario' }))
    await user.click(form.getByRole('radio', { name: /detergente/i }))
    await user.click(form.getByRole('radio', { name: /salida/i }))
    await user.type(form.getByLabelText(/^Cantidad/), '11')
    expect(form.getByText(/No hay suficiente stock/)).toBeInTheDocument()
    await user.click(form.getByRole('button', { name: 'Registrar movimiento' }))
    expect(mocks.movement).not.toHaveBeenCalled()
  })

  it('muestra el error del backend cuando rechaza el movimiento', async () => {
    const user = userEvent.setup()
    mocks.movement.mockRejectedValueOnce({ isAxiosError: true, response: { status: 409, data: { error: 'stock insuficiente para registrar la salida' } } })
    render(<InventoryPage/>)
    await user.click(await screen.findByRole('button', { name: 'Registrar movimiento' }))
    const form = within(screen.getByRole('form', { name: 'Formulario de movimiento de inventario' }))
    await user.click(form.getByRole('radio', { name: /detergente/i }))
    await user.click(form.getByRole('radio', { name: /salida/i }))
    await user.type(form.getByLabelText(/^Cantidad/), '4')
    await user.click(form.getByRole('button', { name: 'Registrar movimiento' }))
    expect(await form.findByRole('alert')).toHaveTextContent('stock insuficiente')
  })

  it('permite movimientos al Operario sin mostrar acciones de catálogo', async () => {
    useAuth.setState({ roleId: 3 })
    render(<InventoryPage/>)
    expect(await screen.findByRole('button', { name: 'Registrar movimiento' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /nuevo insumo/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
  })

  it('muestra el indicador accesible usando la alerta devuelta por backend', async () => {
    mocks.lowStock.mockResolvedValue([input])
    render(<InventoryPage/>)
    const card = await screen.findByRole('article', { name: 'Detergente' })
    expect(within(card).getByText('Stock bajo')).toBeInTheDocument()
    expect(within(card).getByText('5 L')).toBeInTheDocument()
    expect(mocks.lowStock).toHaveBeenCalledWith(expect.any(AbortSignal))
  })
})
