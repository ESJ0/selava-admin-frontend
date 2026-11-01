import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CatalogPage } from './CatalogPage'
import { useAuth } from '../store/auth'

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), deactivate: vi.fn() }))
vi.mock('../api/catalogs', () => ({ listCatalog: mocks.list, createCatalog: mocks.create, updateCatalog: mocks.update, deactivateCatalog: mocks.deactivate }))

const shirt = { id: 2, nombre: 'Camisa', descripcion: 'Manga larga', precio: 25, modalidad_cobro: 'UNIDAD', activo: true }
const dialog = () => within(screen.getByRole('dialog'))

describe('CatalogPage SEL-107', () => {
  beforeEach(() => {
    vi.resetAllMocks(); useAuth.setState({ roleId: 1 })
    mocks.list.mockResolvedValue([shirt]); mocks.create.mockResolvedValue({ id: 9 }); mocks.update.mockResolvedValue({ id: 2 }); mocks.deactivate.mockResolvedValue(undefined)
  })

  it('muestra el precio y estado del tipo de prenda y permite editarlo', async () => {
    const user = userEvent.setup(); render(<CatalogPage kind="tipos-prenda" />)
    const card = await screen.findByRole('article')
    expect(within(card).getByText('25.00')).toBeInTheDocument()
    expect(within(card).getByText('por unidad')).toBeInTheDocument()
    expect(within(card).getByRole('switch', { name: /camisa/i })).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('button', { name: 'Editar Camisa' }))
    const price = dialog().getByLabelText(/precio por medida/i); expect(price).toHaveValue('25')
    await user.clear(price); await user.type(price, '30.50')
    await user.click(dialog().getByRole('radio', { name: /por libra/i }))
    await user.click(dialog().getByRole('button', { name: /guardar tipo/i }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('tipos-prenda', 2, { nombre: 'Camisa', descripcion: 'Manga larga', precio: 30.5, modalidad_cobro: 'LIBRA' }))
    expect(await screen.findByText('Tipo de prenda actualizado')).toBeInTheDocument()
  })

  it.each([['', 'Escribe un precio mayor que cero.'], ['0', 'Escribe un precio mayor que cero.'], ['25.001', 'Usa como máximo dos decimales.']])('rechaza precio inválido "%s" antes de guardar', async (value, message) => {
    const user = userEvent.setup(); render(<CatalogPage kind="tipos-prenda" />)
    await screen.findByText('Camisa'); await user.click(screen.getByRole('button', { name: /nuevo tipo/i }))
    await user.type(dialog().getByLabelText(/nombre/i), 'Pantalón')
    if (value) await user.type(dialog().getByLabelText(/precio/i), value)
    await user.click(dialog().getByRole('button', { name: /guardar tipo/i }))
    expect(dialog().getByText(message)).toBeInTheDocument(); expect(mocks.create).not.toHaveBeenCalled()
  })

  it('descarta caracteres no numéricos en el precio', async () => {
    const user = userEvent.setup(); render(<CatalogPage kind="tipos-prenda" />)
    await screen.findByText('Camisa'); await user.click(screen.getByRole('button', { name: /nuevo tipo/i }))
    await user.type(dialog().getByLabelText(/precio/i), '-1a2')
    expect(dialog().getByLabelText(/precio/i)).toHaveValue('12')
  })

  it('crea un tipo con precio en quetzales', async () => {
    const user = userEvent.setup(); render(<CatalogPage kind="tipos-prenda" />)
    await screen.findByText('Camisa'); await user.click(screen.getByRole('button', { name: /nuevo tipo/i }))
    expect(dialog().getByRole('radio', { name: /por unidad/i })).toHaveAttribute('aria-checked', 'true')
    await user.type(dialog().getByLabelText(/nombre/i), 'Pantalón'); await user.type(dialog().getByLabelText(/precio/i), '30.25')
    await user.click(dialog().getByRole('button', { name: /guardar tipo/i }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith('tipos-prenda', { nombre: 'Pantalón', descripcion: '', precio: 30.25, modalidad_cobro: 'UNIDAD' }))
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2))
  })

  it('muestra errores de precio devueltos por el backend', async () => {
    const user = userEvent.setup()
    mocks.create.mockRejectedValue(new AxiosError('validation', 'ERR_BAD_REQUEST', undefined, undefined, { status: 422, data: { errores: [{ field: 'precio', message: 'precio rechazado por el servidor' }] } } as never))
    render(<CatalogPage kind="tipos-prenda" />)
    await screen.findByText('Camisa'); await user.click(screen.getByRole('button', { name: /nuevo tipo/i }))
    await user.type(dialog().getByLabelText(/nombre/i), 'Pantalón'); await user.type(dialog().getByLabelText(/precio/i), '30')
    await user.click(dialog().getByRole('button', { name: /guardar tipo/i }))
    expect(await dialog().findByText('precio: precio rechazado por el servidor')).toBeInTheDocument()
  })

  it('identifica tipos anteriores pendientes de configurar y abre la edición', async () => {
    const user = userEvent.setup()
    mocks.list.mockResolvedValue([{ ...shirt, precio: null }]); render(<CatalogPage kind="tipos-prenda" />)
    await user.click(await screen.findByRole('button', { name: 'Pendiente de configurar precio' }))
    expect(screen.queryByText('Q0.00')).not.toBeInTheDocument()
    expect(dialog().getByRole('heading', { name: 'Editar tipo de prenda' })).toBeInTheDocument()
  })

  it('desactiva y activa con el interruptor', async () => {
    const user = userEvent.setup(); render(<CatalogPage kind="tipos-prenda" />)
    const toggle = await screen.findByRole('switch', { name: /camisa/i })
    await user.click(toggle)
    expect(mocks.deactivate).toHaveBeenCalledWith('tipos-prenda', 2)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'))
    await user.click(toggle)
    expect(mocks.update).toHaveBeenCalledWith('tipos-prenda', 2, { activo: true })
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
  })

  it('filtra por estado y búsqueda', async () => {
    const user = userEvent.setup()
    mocks.list.mockResolvedValue([shirt, { ...shirt, id: 3, nombre: 'Vestido', activo: false }]); render(<CatalogPage kind="tipos-prenda" />)
    await screen.findByText('Vestido')
    await user.click(screen.getByRole('tab', { name: 'Inactivos' }))
    expect(screen.queryByText('Camisa')).not.toBeInTheDocument(); expect(screen.getByText('Vestido')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Todos' }))
    await user.type(screen.getByPlaceholderText('Buscar tipo de prenda…'), 'zzz')
    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
  })

  it('crea y edita servicios sin formularios ni columnas de precio', async () => {
    const user = userEvent.setup()
    mocks.list.mockResolvedValue([{ id: 1, nombre: 'Lavado', descripcion: 'En máquina', precio_base: 99, tiempo_estimado_horas: 2, activo: true }])
    render(<CatalogPage kind="servicios" />); await screen.findByText('Lavado')
    expect(screen.queryByText(/Q99|Precio/i)).not.toBeInTheDocument()
    expect(screen.getByText('Listo el mismo día')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /nuevo servicio/i })); expect(dialog().queryByLabelText(/precio/i)).not.toBeInTheDocument()
    await user.click(dialog().getByRole('button', { name: /guardar servicio/i })); expect(mocks.create).not.toHaveBeenCalled()
    expect(dialog().getByText('Escribe un nombre.')).toBeInTheDocument()
    await user.type(dialog().getByLabelText(/nombre/i), 'Doblado')
    await user.clear(dialog().getByLabelText('Horas')); await user.type(dialog().getByLabelText('Horas'), '3')
    await user.click(dialog().getByRole('button', { name: /guardar servicio/i }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith('servicios', { nombre: 'Doblado', descripcion: '', tiempo_estimado_horas: 3 }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Editar Lavado' })); await user.clear(dialog().getByLabelText(/nombre/i)); await user.type(dialog().getByLabelText(/nombre/i), 'Lavado especial')
    await user.click(dialog().getByRole('button', { name: '48 h' }))
    await user.click(dialog().getByRole('button', { name: /guardar servicio/i }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('servicios', 1, { nombre: 'Lavado especial', descripcion: 'En máquina', tiempo_estimado_horas: 48 }))
  })

  it('advierte métodos de pago duplicados y no los guarda', async () => {
    const user = userEvent.setup()
    mocks.list.mockResolvedValue([{ id: 1, nombre: 'Efectivo', activo: true }])
    render(<CatalogPage kind="metodos-pago" />); expect(await screen.findByText('EFECTIVO')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /nuevo método/i }))
    await user.type(dialog().getByLabelText(/nombre/i), 'efectivo')
    expect(dialog().getByText('Ya existe un método con ese nombre.')).toBeInTheDocument()
    await user.click(dialog().getByRole('button', { name: /guardar método/i })); expect(mocks.create).not.toHaveBeenCalled()
    await user.clear(dialog().getByLabelText(/nombre/i)); await user.click(dialog().getByRole('button', { name: 'Código QR' }))
    await user.click(dialog().getByRole('button', { name: /guardar método/i }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith('metodos-pago', { nombre: 'Código QR' }))
  })

  it('recepción consulta sin acciones de administración', async () => {
    useAuth.setState({ roleId: 2 }); render(<CatalogPage kind="tipos-prenda" />)
    await screen.findByText('Camisa')
    expect(screen.queryByRole('button', { name: /nuevo tipo/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /camisa/i }).tagName).toBe('SPAN')
  })

  it('no muestra tarjetas del catálogo anterior al cambiar de catálogo', async () => {
    const { rerender } = render(<CatalogPage kind="tipos-prenda" />); await screen.findByText('Camisa')
    mocks.list.mockResolvedValueOnce([{ id: 1, nombre: 'Lavado', activo: true }]); rerender(<CatalogPage kind="servicios" />)
    expect(screen.getByText(/cargando servicios/i)).toBeInTheDocument(); await screen.findByText('Lavado'); expect(screen.queryByText('Camisa')).not.toBeInTheDocument()
  })
})
