import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UsersPage } from './UsersPage'
import { useAuth } from '../store/auth'

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), setActive: vi.fn() }))
vi.mock('../api/users', () => ({ listUsers: mocks.list, createUser: mocks.create, updateUser: mocks.update, setUserActive: mocks.setActive }))

const base = { cliente_id: undefined, created_at: '', updated_at: '' }
const users = [
  { ...base, id: 1, rol_id: 1, rol: 'Administrador', nombre: 'Admin', apellido: 'Prueba', email: 'admin@selava.local', telefono: '55550000', activo: true },
  { ...base, id: 2, rol_id: 2, rol: 'Recepcionista', nombre: 'Rita', apellido: 'López', email: 'rita@selava.local', telefono: '41330121', activo: true },
  { ...base, id: 3, rol_id: 4, rol: 'Cliente', nombre: 'Ana', apellido: 'Pérez', email: 'ana@correo.com', telefono: '', activo: false },
]
const b64 = (value: object) => btoa(JSON.stringify(value))
const dialog = () => within(screen.getByRole('dialog'))

describe('UsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.setState({ roleId: 1, token: `${b64({ alg: 'none' })}.${b64({ sub: '1', rol_id: 1 })}.x` })
    mocks.list.mockResolvedValue(users)
    mocks.create.mockResolvedValue({ ...users[1], id: 9 })
    mocks.update.mockResolvedValue(users[1])
    mocks.setActive.mockResolvedValue(users[1])
  })

  it('muestra gafetes por rol, marca la sesión actual y filtra', async () => {
    const user = userEvent.setup()
    render(<UsersPage />)
    const mine = await screen.findByRole('article', { name: 'Admin Prueba' })
    expect(within(mine).getByText('Tú')).toBeInTheDocument()
    expect(within(mine).getByText('Tu sesión actual')).toBeInTheDocument()
    expect(within(mine).queryByRole('switch')).not.toBeInTheDocument()
    expect(within(screen.getByRole('article', { name: 'Rita López' })).getByText('+502 4133-0121')).toBeInTheDocument()
    expect(within(screen.getByRole('article', { name: 'Ana Pérez' })).getByText('Sin teléfono')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Recepcionistas/ }))
    expect(screen.getAllByRole('article')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: /Todos/ }))
    await user.click(screen.getByRole('tab', { name: 'Inactivos' }))
    expect(screen.getAllByRole('article').map((card) => card.getAttribute('aria-label'))).toEqual(['Ana Pérez'])
  })

  it('activa y desactiva cuentas con el interruptor', async () => {
    const user = userEvent.setup()
    render(<UsersPage />)
    const toggle = await screen.findByRole('switch', { name: /Rita López/ })
    await user.click(toggle)
    expect(mocks.setActive).toHaveBeenCalledWith(2, false)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'))
  })

  it('crea un usuario con rol, teléfono y contraseña válidos', async () => {
    const user = userEvent.setup()
    render(<UsersPage />)
    await user.click(await screen.findByRole('button', { name: /nuevo usuario/i }))
    await user.click(dialog().getByRole('button', { name: 'Crear usuario' }))
    expect(dialog().getByText('Elige un tipo de usuario.')).toBeInTheDocument()
    expect(mocks.create).not.toHaveBeenCalled()
    await user.click(dialog().getByRole('radio', { name: /Recepcionista/ }))
    await user.type(dialog().getByLabelText(/^Nombre/), 'Rosa')
    await user.type(dialog().getByLabelText(/^Apellido/), 'Gómez')
    await user.type(dialog().getByLabelText(/^Correo/), 'Rosa@Selava.local')
    await user.type(dialog().getByLabelText(/^Teléfono/), '5555a1234')
    expect(dialog().getByLabelText(/^Teléfono/)).toHaveValue('5555-1234')
    await user.type(dialog().getByLabelText(/^Contraseña/), 'Secreto#2026')
    expect(dialog().getByText(/Excelente/)).toBeInTheDocument()
    await user.click(dialog().getByRole('button', { name: 'Crear usuario' }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ rol_id: 2, email: 'rosa@selava.local', password: 'Secreto#2026', nombre: 'Rosa', apellido: 'Gómez', telefono: '55551234' }))
    expect(await screen.findByText('Usuario creado')).toBeInTheDocument()
  })

  it('genera una contraseña y avisa correos duplicados', async () => {
    const user = userEvent.setup()
    render(<UsersPage />)
    await user.click(await screen.findByRole('button', { name: /nuevo usuario/i }))
    await user.click(dialog().getByRole('button', { name: 'Generar' }))
    expect((dialog().getByLabelText(/^Contraseña/) as HTMLInputElement).value).toHaveLength(14)
    expect(dialog().getByLabelText(/^Contraseña/)).toHaveAttribute('type', 'text')
    await user.type(dialog().getByLabelText(/^Correo/), 'rita@selava.local')
    expect(dialog().getByText('Ya existe una cuenta con ese correo.')).toBeInTheDocument()
  })

  it('edita datos sin pedir rol ni contraseña', async () => {
    const user = userEvent.setup()
    render(<UsersPage />)
    await user.click(await screen.findByRole('button', { name: 'Editar Rita López' }))
    expect(dialog().queryByRole('radiogroup')).not.toBeInTheDocument()
    expect(dialog().queryByLabelText(/^Contraseña/)).not.toBeInTheDocument()
    await user.clear(dialog().getByLabelText(/^Nombre/)); await user.type(dialog().getByLabelText(/^Nombre/), 'RitA')
    await user.click(dialog().getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(2, { nombre: 'RitA', apellido: 'López', email: 'rita@selava.local', telefono: '41330121' }))
  })

  it('muestra el error del servidor dentro del modal', async () => {
    const user = userEvent.setup()
    mocks.update.mockRejectedValueOnce({ isAxiosError: true, response: { status: 409, data: { error: 'correo en uso' } } })
    render(<UsersPage />)
    await user.click(await screen.findByRole('button', { name: 'Editar Rita López' }))
    await user.click(dialog().getByRole('button', { name: 'Guardar cambios' }))
    expect(await dialog().findByRole('alert')).toHaveTextContent('correo en uso')
  })
})
