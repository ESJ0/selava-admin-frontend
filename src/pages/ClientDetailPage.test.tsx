import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClientDetailPage } from './ClientDetailPage'

const mocks = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), deactivate: vi.fn() }))
vi.mock('../api/clients', () => ({
  getClient: mocks.get,
  updateClient: mocks.update,
  deactivateClient: mocks.deactivate,
  clientFieldErrors: () => ({}),
}))

const client = { id: 1, nombre: 'María', apellido: 'López', telefono: '5512-3456', email: 'maria@example.com', direccion: 'Zona 1', activo: true, created_at: '2026-01-01T10:00:00Z', updated_at: '2026-01-01T10:00:00Z' }

function renderDetail() {
  return render(<MemoryRouter initialEntries={['/clientes/1']}><Routes><Route path="/clientes/:clientId" element={<ClientDetailPage/>}/></Routes></MemoryRouter>)
}

describe('ClientDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('confirm', vi.fn(() => true))
    mocks.get.mockResolvedValue(client)
    mocks.update.mockResolvedValue({ ...client, telefono: '5555-9999' })
    mocks.deactivate.mockResolvedValue(undefined)
  })

  it('carga y muestra la información real del cliente', async () => {
    renderDetail()
    expect(await screen.findByRole('heading', { name: 'María López' })).toBeInTheDocument()
    expect(screen.getByText('5512-3456')).toBeInTheDocument()
    expect(screen.getByText('maria@example.com')).toBeInTheDocument()
    expect(screen.getByText(/consulta de pedidos por cliente aún no está disponible/i)).toBeInTheDocument()
    expect(mocks.get).toHaveBeenCalledWith(1, expect.any(AbortSignal))
  })

  it('edita todos los campos soportados por la API', async () => {
    const user = userEvent.setup()
    renderDetail()
    await user.click(await screen.findByRole('button', { name: 'Editar cliente' }))
    const form = screen.getByRole('form', { name: 'Formulario de cliente' })
    await user.clear(within(form).getByLabelText('Teléfono *'))
    await user.type(within(form).getByLabelText('Teléfono *'), '5555-9999')
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(1, { nombre: 'María', apellido: 'López', telefono: '5555-9999', email: 'maria@example.com', direccion: 'Zona 1' }))
    expect(await screen.findByText('Cliente actualizado correctamente.')).toBeInTheDocument()
  })

  it('desactiva lógicamente y permite reactivar', async () => {
    const user = userEvent.setup()
    const { unmount } = renderDetail()
    await user.click(await screen.findByRole('button', { name: 'Desactivar' }))
    await waitFor(() => expect(mocks.deactivate).toHaveBeenCalledWith(1))
    expect(screen.getByText('Cliente desactivado correctamente.')).toBeInTheDocument()
    unmount()

    mocks.get.mockResolvedValueOnce({ ...client, activo: false })
    mocks.update.mockResolvedValueOnce({ ...client, activo: true })
    renderDetail()
    await user.click(await screen.findByRole('button', { name: 'Activar' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(1, { activo: true }))
    expect(screen.getByText('Cliente activado correctamente.')).toBeInTheDocument()
  })
})
