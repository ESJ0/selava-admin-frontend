import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import App from './App'
import { useAuth } from './store/auth'
import { api } from './api/client'

vi.mock('./api/catalogs', () => ({ listCatalog: vi.fn().mockResolvedValue([]), createCatalog: vi.fn(), updateCatalog: vi.fn(), deactivateCatalog: vi.fn() }))

describe('rutas protegidas', () => {
  beforeEach(() => { sessionStorage.clear(); useAuth.setState({ token: null, roleId: null }) })
  it('redirige al login sin JWT', () => { render(<MemoryRouter initialEntries={['/servicios']}><App/></MemoryRouter>); expect(screen.getByRole('heading',{name:/bienvenido/i})).toBeInTheDocument() })
  it('permite la aplicación con JWT', async () => { useAuth.setState({ token: 'token', roleId: 1 }); render(<MemoryRouter initialEntries={['/servicios']}><App/></MemoryRouter>); expect(await screen.findByRole('heading',{name:'Servicios'})).toBeInTheDocument() })
  it('inicia sesión y almacena el JWT', async () => {
    const user=userEvent.setup(); const token=`x.${btoa(JSON.stringify({rol_id:1,exp:Math.floor(Date.now()/1000)+3600}))}.x`
    vi.spyOn(api,'post').mockResolvedValueOnce({data:{token}})
    render(<MemoryRouter initialEntries={['/login']}><App/></MemoryRouter>)
    await user.type(screen.getByLabelText(/correo/i),'admin@selava.local'); await user.type(screen.getByLabelText(/contraseña/i),'local-password'); await user.click(screen.getByRole('button',{name:/ingresar/i}))
    expect(sessionStorage.getItem('selava_token')).toBe(token)
  })
})
