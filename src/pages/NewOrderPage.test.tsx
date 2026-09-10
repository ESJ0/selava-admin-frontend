import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createOrder } from '../api/orders'
import { NewOrderPage } from './NewOrderPage'

vi.mock('../api/orders', () => ({
  listClients: vi.fn().mockResolvedValue([{ id: 1, nombre: 'Ana', apellido: 'Martínez', telefono: '5555', activo: true }]),
  listGarmentTypes: vi.fn().mockResolvedValue([{ id: 2, nombre: 'Camisa', descripcion: '', activo: true }]),
  createOrder: vi.fn().mockResolvedValue({ id: 42, cliente_id: 1, prendas: [] }),
  listServices: vi.fn().mockResolvedValue([{ id: 3, nombre: 'Lavado', precio_base: 25, activo: true }, { id: 4, nombre: 'Lavado en seco', precio_base: 35, activo: true }]),
}))

async function openGarmentsStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /ana martínez/i }))
  await user.click(screen.getByRole('button', { name: /siguiente/i }))
}

describe('NewOrderPage', () => {
  it('requiere cliente y permite agregar varios tipos de prenda', async () => {
    const user = userEvent.setup()
    render(<NewOrderPage />)
    await screen.findByText('Ana Martínez')
    await user.click(screen.getByRole('button', { name: /siguiente/i }))
    expect(screen.getByText('Selecciona un cliente para continuar.')).toBeInTheDocument()
    await openGarmentsStep(user)
    expect(screen.getByText('Tipo de prenda 1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /agregar otro tipo de prenda/i }))
    expect(screen.getByText('Tipo de prenda 2')).toBeInTheDocument()
  })

  it('valida tipo y cantidad de cada detalle', async () => {
    const user = userEvent.setup()
    render(<NewOrderPage />)
    await openGarmentsStep(user)
    await user.click(screen.getByRole('button', { name: /siguiente/i }))
    expect(screen.getByText(/selecciona el tipo y una cantidad/i)).toBeInTheDocument()
  })

  it('envía cliente, fecha y grupos de prendas en una sola llamada', async () => {
    const user = userEvent.setup()
    render(<NewOrderPage />)
    await openGarmentsStep(user)
    await user.selectOptions(screen.getByLabelText('Tipo de prenda *', { selector: 'select' }), '2')
    await user.click(screen.getByRole('checkbox', { name: 'Lavado' }))
    await user.click(screen.getByRole('button', { name: /siguiente/i }))
    await user.type(screen.getByLabelText(/fecha de entrega/i), '2026-09-01')
    await user.click(screen.getByRole('button', { name: /siguiente/i }))
    await user.click(screen.getByRole('button', { name: /crear pedido/i }))

    expect(createOrder).toHaveBeenCalledWith(
      1,
      '2026-09-01',
      '',
      [expect.objectContaining({ tipo_prenda_id: 2, cantidad: 1, detalles: [expect.objectContaining({ cantidad: 1, servicio_ids: [3] })] })],
    )
    expect(await screen.findByText('Pedido creado correctamente')).toBeInTheDocument()
  })

  it('requiere al menos un servicio para cada detalle', async () => {
    const user = userEvent.setup()
    render(<NewOrderPage />)
    await openGarmentsStep(user)
    await user.selectOptions(screen.getByLabelText('Tipo de prenda *', { selector: 'select' }), '2')
    await user.click(screen.getByRole('button', { name: /siguiente/i }))
    expect(screen.getByText('Selecciona al menos un servicio para cada detalle de prenda.')).toBeInTheDocument()
  })

  it('bloquea lavado y lavado en seco como servicios simultáneos', async () => {
    const user = userEvent.setup()
    render(<NewOrderPage />)
    await openGarmentsStep(user)
    await user.selectOptions(screen.getByLabelText('Tipo de prenda *', { selector: 'select' }), '2')
    const lavado = screen.getByRole('checkbox', { name: 'Lavado' })
    const lavadoEnSeco = screen.getByRole('checkbox', { name: 'Lavado en seco' })
    await user.click(lavado)
    expect(lavadoEnSeco).toBeDisabled()
    expect(screen.getAllByText(/no se pueden aplicar juntos por seguridad/i)).toHaveLength(1)
    await user.click(lavado)
    expect(lavadoEnSeco).not.toBeDisabled()
    await user.click(lavadoEnSeco)
    expect(lavado).toBeDisabled()
  })

  it('genera una subsección por prenda y permite aplicar servicios por tipo', async () => {
    const user = userEvent.setup()
    render(<NewOrderPage />)
    await openGarmentsStep(user)
    await user.selectOptions(screen.getByLabelText('Tipo de prenda *', { selector: 'select' }), '2')
    await user.clear(screen.getByLabelText('Cantidad de prendas'))
    await user.type(screen.getByLabelText('Cantidad de prendas'), '3')
    expect(screen.getAllByText(/Prenda \d de 3/)).toHaveLength(3)

    const commonOption = screen.getByRole('checkbox', { name: /aplicar los mismos servicios a este tipo/i })
    await user.click(commonOption)
    expect(screen.getAllByRole('checkbox', { name: 'Lavado' })).toHaveLength(1)
    await user.click(screen.getByRole('checkbox', { name: 'Lavado' }))
    await user.click(screen.getByRole('button', { name: /siguiente/i }))
    expect(screen.getByLabelText(/fecha de entrega/i)).toBeInTheDocument()
  })
})
