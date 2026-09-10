import { render, screen, within } from '@testing-library/react'
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
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Tipos de prenda',
      'Tipos de servicio',
      'Métodos de pago',
    ])
    const ordersButton = within(nav).getByRole('button', { name: 'Pedidos' })
    expect(ordersButton).toHaveAttribute('aria-expanded', 'false')
    await user.click(ordersButton)
    expect(ordersButton).toHaveAttribute('aria-expanded', 'true')
    expect(within(nav).getAllByRole('link').slice(3).map((link) => link.textContent)).toEqual(['Consultar pedidos', 'Nuevo pedido'])
    expect(within(nav).getByRole('region', { name: 'Pedidos' })).toBeInTheDocument()
  })
})
