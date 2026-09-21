import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClientsPage } from './ClientsPage'

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn() }))
vi.mock('../api/clients', () => ({
  listClients: mocks.list,
  createClient: mocks.create,
  clientFieldErrors: () => ({}),
}))

const clients = [
  { id: 1, nombre: 'María', apellido: 'López', telefono: '5512-3456', email: 'maria@example.com', direccion: 'Zona 1', activo: true, created_at: '2026-01-01T10:00:00Z', updated_at: '2026-01-01T10:00:00Z', nit: '4521986-3', tiene_alerta: true },
  { id: 2, nombre: 'Carlos', apellido: 'Hernández', telefono: '5523-4567', email: 'carlos@example.com', activo: false, created_at: '2026-01-02T10:00:00Z', updated_at: '2026-01-02T10:00:00Z' },
  { id: 3, nombre: 'Ana', apellido: 'Martínez', telefono: '5534-5678', activo: true, created_at: '2026-01-03T10:00:00Z', updated_at: '2026-01-03T10:00:00Z' },
  { id: 4, nombre: 'José', apellido: 'Ramírez', telefono: '5545-6789', activo: true, created_at: '2026-01-04T10:00:00Z', updated_at: '2026-01-04T10:00:00Z' },
  { id: 5, nombre: 'Sofía', apellido: 'Castillo', telefono: '5556-7890', activo: true, created_at: '2026-01-05T10:00:00Z', updated_at: '2026-01-05T10:00:00Z' },
  { id: 6, nombre: 'Luis', apellido: 'Morales', telefono: '5567-8901', activo: true, created_at: '2026-01-06T10:00:00Z', updated_at: '2026-01-06T10:00:00Z' },
]

function renderPage() {
  return render(<MemoryRouter><ClientsPage/></MemoryRouter>)
}

describe('ClientsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.list.mockResolvedValue(clients)
    mocks.create.mockResolvedValue(clients[0])
  })

  it('renderiza el listado real con estado y columnas previstas', async () => {
    renderPage()
    expect(screen.getByRole('status')).toHaveTextContent('Cargando clientes')
    expect(await screen.findByText('María López')).toBeInTheDocument()
    expect(screen.getByText('4521986-3')).toBeInTheDocument()
    expect(screen.getByLabelText('Cliente con alerta activa')).toHaveAttribute('title', 'Cliente con alerta activa')
    expect(screen.getAllByText('Activo').length).toBeGreaterThan(0)
    expect(screen.getByText('6 clientes')).toBeInTheDocument()
  })

  it('busca por nombre, teléfono y NIT sobre el listado real', async () => {
    const user = userEvent.setup()
    renderPage()
    const search = await screen.findByPlaceholderText('Buscar por nombre, teléfono o NIT...')
    await user.type(search, '5523')
    expect(screen.getByText('Carlos Hernández')).toBeInTheDocument()
    expect(screen.queryByText('María López')).not.toBeInTheDocument()
    await user.clear(search)
    await user.type(search, '4521986-3')
    expect(screen.getByText('María López')).toBeInTheDocument()
  })

  it('filtra clientes activos e inactivos', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('María López')
    await user.click(screen.getByRole('button', { name: 'Inactivo' }))
    expect(screen.getByText('Carlos Hernández')).toBeInTheDocument()
    expect(screen.queryByText('María López')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Activo' }))
    expect(screen.queryByText('Carlos Hernández')).not.toBeInTheDocument()
    expect(screen.getByText('María López')).toBeInTheDocument()
  })

  it('pagina cinco clientes y permite avanzar', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('María López')
    expect(screen.queryByText('Luis Morales')).not.toBeInTheDocument()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Página siguiente' }))
    expect(screen.getByText('Luis Morales')).toBeInTheDocument()
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
  })

  it('abre y cierra el modal de registro', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /nuevo cliente/i }))
    expect(screen.getByRole('dialog', { name: 'Registrar cliente' })).toBeInTheDocument()
    expect(screen.getByLabelText('NIT')).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('muestra validaciones por campo antes de llamar la API', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /nuevo cliente/i }))
    fireEvent.submit(screen.getByRole('form', { name: 'Formulario de cliente' }))
    expect(await screen.findByText('El nombre es obligatorio.')).toBeInTheDocument()
    expect(screen.getByText('El apellido es obligatorio.')).toBeInTheDocument()
    expect(screen.getByText('El teléfono es obligatorio.')).toBeInTheDocument()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('registra un cliente, cierra el modal y refresca la tabla', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /nuevo cliente/i }))
    const form = screen.getByRole('form', { name: 'Formulario de cliente' })
    await user.type(within(form).getByLabelText('Nombre *'), 'Elena')
    await user.type(within(form).getByLabelText('Apellido *'), 'Paz')
    await user.type(within(form).getByLabelText('Teléfono *'), '5512-8899')
    await user.type(within(form).getByLabelText('Correo electrónico'), 'elena@example.com')
    await user.type(within(form).getByLabelText('Dirección'), 'Zona 10')
    await user.click(within(form).getByRole('button', { name: 'Guardar cliente' }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ nombre: 'Elena', apellido: 'Paz', telefono: '5512-8899', email: 'elena@example.com', direccion: 'Zona 10' }))
    expect(await screen.findByText('Cliente registrado correctamente.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mocks.list).toHaveBeenCalledTimes(2)
  })

  it('muestra un error humano cuando backend rechaza el registro', async () => {
    const user = userEvent.setup()
    mocks.create.mockRejectedValueOnce({ isAxiosError: true, response: { status: 409, data: { error: 'el email ya está en uso por otro cliente' } } })
    renderPage()
    await user.click(await screen.findByRole('button', { name: /nuevo cliente/i }))
    const form = screen.getByRole('form', { name: 'Formulario de cliente' })
    await user.type(within(form).getByLabelText('Nombre *'), 'Elena')
    await user.type(within(form).getByLabelText('Apellido *'), 'Paz')
    await user.type(within(form).getByLabelText('Teléfono *'), '5512-8899')
    await user.type(within(form).getByLabelText('Correo electrónico'), 'usado@example.com')
    await user.click(within(form).getByRole('button', { name: 'Guardar cliente' }))
    expect(await within(form).findByRole('alert')).toHaveTextContent('el email ya está en uso')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('navega al detalle desde Ver', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/clientes']}><Routes><Route path="/clientes" element={<ClientsPage/>}/><Route path="/clientes/:clientId" element={<h1>Detalle destino</h1>}/></Routes></MemoryRouter>)
    await user.click((await screen.findAllByRole('link', { name: 'Ver' }))[0])
    expect(screen.getByRole('heading', { name: 'Detalle destino' })).toBeInTheDocument()
  })

  it('muestra el estado vacío', async () => {
    const { unmount } = renderPage()
    await screen.findByText('María López')
    unmount()
    mocks.list.mockResolvedValueOnce([])
    renderPage()
    expect(await screen.findByText('No hay clientes registrados.')).toBeInTheDocument()
  })

  it('muestra el estado sin resultados', async () => {
    const user = userEvent.setup()
    renderPage()
    const search = await screen.findByPlaceholderText('Buscar por nombre, teléfono o NIT...')
    await user.type(search, 'cliente inexistente')
    expect(screen.getByText('No se encontraron clientes.')).toBeInTheDocument()
  })

  it('muestra un error de carga y permite reintentar', async () => {
    mocks.list.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(clients)
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('No fue posible cargar los clientes.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('María López')).toBeInTheDocument()
  })
})
