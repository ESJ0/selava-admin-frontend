import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CatalogPage } from './CatalogPage'
import { useAuth } from '../store/auth'

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), deactivate: vi.fn() }))
vi.mock('../api/catalogs', () => ({ listCatalog: mocks.list, createCatalog: mocks.create, updateCatalog: mocks.update, deactivateCatalog: mocks.deactivate }))

const shirt = { id: 2, nombre: 'Camisa', descripcion: 'Manga larga', precio: 25, activo: true }
describe('CatalogPage SEL-107', () => {
  beforeEach(() => {
    vi.resetAllMocks(); useAuth.setState({ roleId: 1 })
    mocks.list.mockResolvedValue([shirt]); mocks.create.mockResolvedValue({}); mocks.update.mockResolvedValue({})
  })
  it('muestra el precio y estado del tipo de prenda y permite editarlo', async () => {
    const user = userEvent.setup(); render(<CatalogPage kind="tipos-prenda" />)
    expect(await screen.findByText('Q25.00')).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /editar/i }))
    const price = screen.getByLabelText('Precio (Q) *'); expect(price).toHaveValue(25)
    await user.clear(price); await user.type(price, '30.50')
    await user.click(screen.getByRole('button', { name: /guardar tipo/i }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('tipos-prenda', 2, { nombre: 'Camisa', descripcion: 'Manga larga', precio: 30.5 }))
  })
  it.each(['', '0', '-1', '25.001'])('rechaza precio inválido %s antes de guardar', async (value) => {
    const user = userEvent.setup(); render(<CatalogPage kind="tipos-prenda" />)
    await screen.findByText('Camisa'); await user.click(screen.getByRole('button', { name: /nuevo tipo/i }))
    await user.type(screen.getByLabelText(/nombre/i), 'Pantalón')
    if (value) await user.type(screen.getByLabelText(/precio/i), value)
    await user.click(screen.getByRole('button', { name: /guardar tipo/i }))
    expect(screen.getByText(/El precio debe/)).toBeInTheDocument(); expect(mocks.create).not.toHaveBeenCalled()
  })
  it('crea un tipo con precio en quetzales', async () => {
    const user = userEvent.setup(); render(<CatalogPage kind="tipos-prenda" />)
    await screen.findByText('Camisa'); await user.click(screen.getByRole('button', { name: /nuevo tipo/i }))
    await user.type(screen.getByLabelText(/nombre/i), 'Pantalón'); await user.type(screen.getByLabelText(/precio/i), '30.25')
    await user.click(screen.getByRole('button', { name: /guardar tipo/i }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith('tipos-prenda', { nombre: 'Pantalón', descripcion: '', precio: 30.25 }))
  })
  it('muestra errores de precio devueltos por el backend', async () => {
    const user = userEvent.setup()
    mocks.create.mockRejectedValue(new AxiosError('validation', 'ERR_BAD_REQUEST', undefined, undefined, { status: 422, data: { errores: [{ field: 'precio', message: 'precio rechazado por el servidor' }] } } as never))
    render(<CatalogPage kind="tipos-prenda" />)
    await screen.findByText('Camisa'); await user.click(screen.getByRole('button', { name: /nuevo tipo/i }))
    await user.type(screen.getByLabelText(/nombre/i), 'Pantalón'); await user.type(screen.getByLabelText(/precio/i), '30')
    await user.click(screen.getByRole('button', { name: /guardar tipo/i }))
    expect(await screen.findByText('precio: precio rechazado por el servidor')).toBeInTheDocument()
  })
  it('identifica tipos anteriores pendientes de configurar', async () => {
    mocks.list.mockResolvedValue([{ ...shirt, precio: null }]); render(<CatalogPage kind="tipos-prenda" />)
    expect(await screen.findByText('Pendiente de configurar')).toBeInTheDocument(); expect(screen.queryByText('Q0.00')).not.toBeInTheDocument()
  })
  it('crea y edita servicios sin formularios ni columnas de precio', async () => {
    const user = userEvent.setup()
    mocks.list.mockResolvedValue([{ id: 1, nombre: 'Lavado', descripcion: 'En máquina', precio_base: 99, tiempo_estimado_horas: 2, activo: true }])
    render(<CatalogPage kind="servicios" />); await screen.findByText('Lavado')
    expect(screen.queryByText(/Q99|Precio/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /nuevo servicio/i })); expect(screen.queryByLabelText(/precio/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /guardar servicio/i })); expect(mocks.create).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText(/nombre/i), 'Doblado'); await user.type(screen.getByLabelText(/tiempo estimado/i), '3')
    await user.click(screen.getByRole('button', { name: /guardar servicio/i }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith('servicios', { nombre: 'Doblado', descripcion: '', tiempo_estimado_horas: 3 }))
    await user.click(screen.getByRole('button', { name: /editar/i })); await user.clear(screen.getByLabelText(/nombre/i)); await user.type(screen.getByLabelText(/nombre/i), 'Lavado especial')
    await user.click(screen.getByRole('button', { name: /guardar servicio/i }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('servicios', 1, { nombre: 'Lavado especial', descripcion: 'En máquina', tiempo_estimado_horas: 2 }))
  })
  it('no muestra filas del catálogo anterior al cambiar de catálogo', async () => {
    const { rerender } = render(<CatalogPage kind="tipos-prenda" />); await screen.findByText('Q25.00')
    mocks.list.mockResolvedValueOnce([{ id: 1, nombre: 'Lavado', activo: true }]); rerender(<CatalogPage kind="servicios" />)
    expect(screen.getByText(/cargando servicios/i)).toBeInTheDocument(); await screen.findByText('Lavado'); expect(screen.queryByText('Q25.00')).not.toBeInTheDocument()
  })
})
