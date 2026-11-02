import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { useAuth } from './store/auth'

describe('App', () => {
  beforeEach(() => {
    sessionStorage.removeItem('selava_token')
    useAuth.setState({ token: null, roleId: null })
  })

  it('protege la ruta /clientes y redirige a login sin token', async () => {
    render(<MemoryRouter initialEntries={['/clientes']}><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Acceso SELAVA' })).toBeInTheDocument()
  })

  it('muestra login en la ruta /login', () => {
    render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Acceso SELAVA' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'SELAVA, Lavandería y Dry Clean' })).toHaveAttribute('src', '/selava-logo.png')
  })

  it('despide al usuario después de cerrar sesión', () => {
    sessionStorage.setItem('selava_logout', '1')
    render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Sesión cerrada' })).toBeInTheDocument()
    expect(sessionStorage.getItem('selava_logout')).toBeNull()
  })
})
