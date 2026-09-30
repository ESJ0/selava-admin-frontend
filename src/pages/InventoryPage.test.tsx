import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InventoryPage } from './InventoryPage'
import { useAuth } from '../store/auth'

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), deactivate: vi.fn() }))
vi.mock('../api/inventory', () => ({
  listInputs: mocks.list,
  createInput: mocks.create,
  updateInput: mocks.update,
  deactivateInput: mocks.deactivate,
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
  })

  it('lista insumos con sus stocks y unidad', async () => {
    render(<InventoryPage/>)
    expect(await screen.findByText('Detergente')).toBeInTheDocument()
    expect(screen.getByText('L')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Stock actual' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Stock mínimo' })).toBeInTheDocument()
    expect(screen.getByText('Disponible')).toBeInTheDocument()
  })

  it('advierte cuando el stock alcanza el mínimo', async () => {
    mocks.list.mockResolvedValue([{ ...input, stock_actual: 5 }])
    render(<InventoryPage/>)
    expect(await screen.findByText('Stock bajo')).toBeInTheDocument()
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
})
