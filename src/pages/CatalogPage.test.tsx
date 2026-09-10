import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CatalogPage } from './CatalogPage'
import { useAuth } from '../store/auth'

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), deactivate: vi.fn() }))
vi.mock('../api/catalogs', () => ({ listCatalog: mocks.list, createCatalog: mocks.create, updateCatalog: mocks.update, deactivateCatalog: mocks.deactivate }))

describe('CatalogPage', () => {
  beforeEach(() => { vi.clearAllMocks(); useAuth.setState({ roleId: 1 }); mocks.list.mockResolvedValue([{ id:1, nombre:'Lavado', descripcion:'En máquina', precio_base:25, tiempo_estimado_horas:2, activo:true }]) })
  it('renderiza el listado recibido de la API', async () => { render(<CatalogPage kind="servicios"/>); expect(await screen.findByText('Lavado')).toBeInTheDocument(); expect(screen.getByText('Q25.00')).toBeInTheDocument() })
  it('no renderiza datos del catálogo anterior mientras cambia a servicios', async () => {
    mocks.list.mockResolvedValueOnce([{ id: 2, nombre: 'Camisa', descripcion: 'Manga larga', activo: true }])
    const { rerender } = render(<CatalogPage kind="tipos-prenda" />)
    expect(await screen.findByText('Camisa')).toBeInTheDocument()
    mocks.list.mockResolvedValueOnce([{ id: 1, nombre: 'Lavado', precio_base: 25, activo: true }])
    rerender(<CatalogPage kind="servicios" />)
    expect(screen.getByText(/cargando servicios/i)).toBeInTheDocument()
    expect(await screen.findByText('Q25.00')).toBeInTheDocument()
  })
  it('valida y crea un servicio', async () => {
    const user = userEvent.setup(); mocks.create.mockResolvedValue({}); render(<CatalogPage kind="servicios"/>); await screen.findByText('Lavado'); await user.click(screen.getByRole('button',{name:/nuevo servicio/i}));
    await user.click(screen.getByRole('button',{name:/guardar servicio/i})); expect(mocks.create).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(/nombre/i),'Doblado'); await user.type(screen.getByLabelText(/precio base/i),'5'); await user.click(screen.getByRole('button',{name:/guardar servicio/i}));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith('servicios', expect.objectContaining({ nombre:'Doblado', precio_base:5 })))
  })
})
