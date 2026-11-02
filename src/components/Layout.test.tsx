import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAuth } from '../store/auth'
import { Layout } from './Layout'

describe('Layout', () => {
  beforeEach(() => useAuth.setState({ token: 'test-token', roleId: 1 }))

  it('ordena los módulos y despliega las dos acciones al presionar Pedidos', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Layout><div>Contenido</div></Layout></MemoryRouter>)
    const nav = screen.getByRole('navigation')
    expect(within(nav).getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Operación', 'Catálogos', 'Administración', 'Reportes'])
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Inicio',
      'Clientes',
      'Nuevo pedido',
      'Consultar pedidos',
      'Tipos de prenda',
      'Promociones',
      'Tipos de servicio',
      'Insumos',
      'Métodos de pago',
      'Usuarios',
      'Reporte de ventas',
      'Pedidos por estado',
      'Consumo de insumos',
    ])
    const ordersButton = within(nav).getByRole('button', { name: 'Pedidos' })
    expect(ordersButton).toHaveAttribute('aria-expanded', 'true')
    await user.click(ordersButton)
    expect(ordersButton).toHaveAttribute('aria-expanded', 'false')
    expect(within(nav).queryByRole('link', { name: 'Nuevo pedido' })).not.toBeInTheDocument()
    await user.click(ordersButton)
    expect(ordersButton).toHaveAttribute('aria-expanded', 'true')
    const operation = within(nav).getByRole('region', { name: 'Operación' })
    expect(within(operation).getAllByRole('link').map((link) => link.textContent)).toEqual(['Clientes', 'Nuevo pedido', 'Consultar pedidos'])
    expect(within(nav).getByRole('region', { name: 'Pedidos' })).toBeInTheDocument()
  })

  it('solo muestra los reportes al administrador', () => {
    useAuth.setState({ token: 'test-token', roleId: 2 })
    render(<MemoryRouter><Layout><div>Contenido</div></Layout></MemoryRouter>)

    expect(screen.queryByRole('link', { name: 'Reporte de ventas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Pedidos por estado' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Consumo de insumos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Reportes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Métodos de pago' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Operación', 'Catálogos'])
  })

  it('muestra la pantalla de cierre con el logo antes de cerrar la sesión', async () => {
    const user = userEvent.setup()
    useAuth.setState({ token: 'test-token', roleId: 1 })
    render(<MemoryRouter><Layout><div>Contenido</div></Layout></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(screen.getByRole('heading', { name: 'Cerrando sesión' })).toBeInTheDocument()
    await waitFor(() => expect(useAuth.getState().token).toBeNull())
    expect(sessionStorage.getItem('selava_logout')).toBe('1')
  })
})
