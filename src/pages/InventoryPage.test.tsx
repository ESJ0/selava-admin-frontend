import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InventoryPage } from './InventoryPage'
import { useAuth } from '../store/auth'

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), deactivate: vi.fn(), movement: vi.fn() }))
vi.mock('../api/inventory', () => ({
  listInputs: mocks.list,
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
    mocks.create.mockResolvedValue(input)
    mocks.update.mockResolvedValue(input)
    mocks.deactivate.mockResolvedValue(undefined)
    mocks.movement.mockResolvedValue({ id: 1, insumo_id: 1, usuario_id: 1, tipo_movimiento: 'salida', cantidad: 4 })
  })

  it('lista insumos con sus stocks y unidad', async () => {
    render(<InventoryPage/>)
    expect(await screen.findByText('Detergente')).toBeInTheDocument()
    expect(screen.getByText('L')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Stock actual' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Stock mínimo' })).toBeInTheDocument()
  })

  it('crea un insumo y refresca el listado', async () => {
    const user = userEvent.setup()
    render(<InventoryPage/>)
    await user.click(await screen.findByRole('button', { name: /nuevo insumo/i }))
    await user.type(screen.getByLabelText('Nombre *'), 'Cloro')
    await user.type(screen.getByLabelText('Unidad de medida *'), 'L')
    await user.clear(screen.getByLabelText('Stock actual *'))
    await user.type(screen.getByLabelText('Stock actual *'), '8')
    await user.clear(screen.getByLabelText('Stock mínimo *'))
    await user.type(screen.getByLabelText('Stock mínimo *'), '3')
    await user.click(screen.getByRole('button', { name: 'Guardar insumo' }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Cloro', unidad_medida: 'L', stock_actual: 8, stock_minimo: 3 })))
    expect(mocks.list).toHaveBeenCalledTimes(2)
  })

  it('edita un insumo usando el contrato real', async () => {
    const user = userEvent.setup()
    render(<InventoryPage/>)
    await user.click(await screen.findByRole('button', { name: 'Editar' }))
    await user.clear(screen.getByLabelText('Stock mínimo *'))
    await user.type(screen.getByLabelText('Stock mínimo *'), '7')
    await user.click(screen.getByRole('button', { name: 'Guardar insumo' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(1, expect.objectContaining({ nombre: 'Detergente', unidad_medida: 'L', stock_minimo: 7 })))
  })

  it('valida stocks negativos antes de llamar la API', async () => {
    const user = userEvent.setup()
    render(<InventoryPage/>)
    await user.click(await screen.findByRole('button', { name: /nuevo insumo/i }))
    await user.type(screen.getByLabelText('Nombre *'), 'Cloro')
    await user.type(screen.getByLabelText('Unidad de medida *'), 'L')
    await user.clear(screen.getByLabelText('Stock actual *'))
    await user.type(screen.getByLabelText('Stock actual *'), '-1')
    fireEvent.submit(screen.getByRole('form', { name: 'Formulario de insumo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('no puede ser negativo')
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('registra una salida con el contrato real y refresca el stock', async () => {
    const user = userEvent.setup()
    render(<InventoryPage/>)
    await user.click(await screen.findByRole('button', { name: 'Registrar movimiento' }))
    const form = screen.getByRole('form', { name: 'Formulario de movimiento de inventario' })
    await user.selectOptions(within(form).getByLabelText('Insumo'), '1')
    expect(within(form).getByText('10 L')).toBeInTheDocument()
    await user.selectOptions(within(form).getByLabelText('Tipo de movimiento'), 'salida')
    await user.type(within(form).getByLabelText('Cantidad'), '4')
    await user.type(within(form).getByLabelText('Motivo u observación'), ' Uso diario ')
    await user.click(within(form).getByRole('button', { name: 'Registrar movimiento' }))
    await waitFor(() => expect(mocks.movement).toHaveBeenCalledWith({ insumo_id: 1, tipo_movimiento: 'salida', cantidad: 4, motivo: 'Uso diario' }))
    expect(mocks.list).toHaveBeenCalledTimes(2)
    expect(await screen.findByText('Salida registrada correctamente.')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Formulario de movimiento de inventario' })).not.toBeInTheDocument()
  })

  it('impide una salida mayor al stock antes de llamar la API', async () => {
    const user = userEvent.setup()
    render(<InventoryPage/>)
    await user.click(await screen.findByRole('button', { name: 'Registrar movimiento' }))
    const form = screen.getByRole('form', { name: 'Formulario de movimiento de inventario' })
    await user.selectOptions(within(form).getByLabelText('Insumo'), '1')
    await user.selectOptions(within(form).getByLabelText('Tipo de movimiento'), 'salida')
    await user.type(within(form).getByLabelText('Cantidad'), '11')
    fireEvent.submit(form)
    expect(await within(form).findByRole('alert')).toHaveTextContent('supera el stock disponible')
    expect(mocks.movement).not.toHaveBeenCalled()
  })

  it('muestra el error del backend cuando rechaza el movimiento', async () => {
    const user = userEvent.setup()
    mocks.movement.mockRejectedValueOnce({ isAxiosError: true, response: { status: 409, data: { error: 'stock insuficiente para registrar la salida' } } })
    render(<InventoryPage/>)
    await user.click(await screen.findByRole('button', { name: 'Registrar movimiento' }))
    const form = screen.getByRole('form', { name: 'Formulario de movimiento de inventario' })
    await user.selectOptions(within(form).getByLabelText('Insumo'), '1')
    await user.selectOptions(within(form).getByLabelText('Tipo de movimiento'), 'salida')
    await user.type(within(form).getByLabelText('Cantidad'), '4')
    await user.click(within(form).getByRole('button', { name: 'Registrar movimiento' }))
    expect(await within(form).findByRole('alert')).toHaveTextContent('stock insuficiente')
  })

  it('permite movimientos al Operario sin mostrar acciones de catálogo', async () => {
    useAuth.setState({ roleId: 3 })
    render(<InventoryPage/>)
    expect(await screen.findByRole('button', { name: 'Registrar movimiento' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /nuevo insumo/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
  })
})
