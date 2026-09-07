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

  it('redirige a login cuando se intenta acceder sin token', async () => {
    render(<MemoryRouter initialEntries={['/servicios']}><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Bienvenido' })).toBeInTheDocument()
  })

  it('muestra login en la ruta /login', () => {
    render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Bienvenido' })).toBeInTheDocument()
  })
})
