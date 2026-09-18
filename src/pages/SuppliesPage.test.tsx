import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SuppliesPage } from './SuppliesPage'

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deactivate: vi.fn(),
}))

vi.mock('../api/supplies', () => ({
  listSupplies: mocks.list,
  createSupply: mocks.create,
  updateSupply: mocks.update,
  deactivateSupply: mocks.deactivate,
}))

const supplies = [
  { id: 1, nombre: 'Detergente', descripcion: 'Líquido', unidad_medida: 'litros', stock_actual: 2, stock_minimo: 5, activo: true },
  { id: 2, nombre: 'Bolsas', unidad_medida: 'unidades', stock_actual: 20, stock_minimo: 10, activo: true },
]

describe('SuppliesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.list.mockResolvedValue(supplies)
    mocks.create.mockResolvedValue({})
    mocks.update.mockResolvedValue({})
    mocks.deactivate.mockResolvedValue(undefined)
  })

  it('muestra stock actual, mínimo y alertas de nivel bajo', async () => {
    render(<SuppliesPage/>)

    expect(await screen.findByText('Detergente')).toBeInTheDocument()
    expect(screen.getByText('Bolsas')).toBeInTheDocument()
    expect(screen.getByLabelText('Resumen de inventario')).toHaveTextContent('1 con stock bajo')
    expect(screen.getByText('Stock bajo')).toBeInTheDocument()
    expect(screen.getByText('Disponible')).toBeInTheDocument()
    expect(screen.getByLabelText('Stock actual: 2 litros')).toBeInTheDocument()
    expect(screen.getByLabelText('Stock mínimo: 5 litros')).toBeInTheDocument()
  })

  it('crea un insumo con stock actual y mínimo', async () => {
    const user = userEvent.setup()
    render(<SuppliesPage/>)
    await screen.findByText('Detergente')
    await user.click(screen.getByRole('button', { name: /nuevo insumo/i }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText(/nombre/i), 'Suavizante')
    await user.type(within(dialog).getByLabelText(/descripción/i), 'Aroma floral')
    await user.type(within(dialog).getByLabelText(/unidad de medida/i), 'litros')
    await user.clear(within(dialog).getByLabelText(/stock actual/i))
    await user.type(within(dialog).getByLabelText(/stock actual/i), '12.5')
    await user.clear(within(dialog).getByLabelText(/stock mínimo/i))
    await user.type(within(dialog).getByLabelText(/stock mínimo/i), '3')
    await user.click(within(dialog).getByRole('button', { name: /guardar insumo/i }))

    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({
      nombre: 'Suavizante',
      descripcion: 'Aroma floral',
      unidad_medida: 'litros',
      stock_actual: 12.5,
      stock_minimo: 3,
    }))
  })

  it('permite editar los niveles de stock', async () => {
    const user = userEvent.setup()
    mocks.list.mockResolvedValue([supplies[0]])
    render(<SuppliesPage/>)
    await user.click(await screen.findByRole('button', { name: /editar/i }))
    const dialog = screen.getByRole('dialog')
    const minimum = within(dialog).getByLabelText(/stock mínimo/i)
    await user.clear(minimum)
    await user.type(minimum, '6')
    await user.click(within(dialog).getByRole('button', { name: /guardar insumo/i }))

    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(1, expect.objectContaining({ stock_actual: 2, stock_minimo: 6 })))
  })

  it('solicita confirmación antes de desactivar', async () => {
    const user = userEvent.setup()
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mocks.list.mockResolvedValue([supplies[0]])
    render(<SuppliesPage/>)
    await user.click(await screen.findByRole('button', { name: 'Desactivar' }))

    expect(confirmation).toHaveBeenCalledWith('¿Desactivar “Detergente”?')
    await waitFor(() => expect(mocks.deactivate).toHaveBeenCalledWith(1))
  })
})
