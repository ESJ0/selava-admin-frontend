import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NewOrderPage } from './NewOrderPage'
import { createOrder } from '../api/orders'

vi.mock('../api/orders', () => ({
  listClients: vi.fn().mockResolvedValue([{ id:1,nombre:'Ana',apellido:'Martínez',telefono:'5555',activo:true }]),
  listGarmentTypes: vi.fn().mockResolvedValue([{ id:2,nombre:'Camisa',descripcion:'',activo:true }]),
  createOrder: vi.fn().mockResolvedValue({ id: 42, cliente_id: 1, prendas: [] }),
  listServices: vi.fn().mockResolvedValue([{ id:3,nombre:'Lavado',precio_base:25,activo:true }]),
}))
describe('NewOrderPage', () => {
  it('requiere cliente, permite seleccionarlo y agregar varias prendas', async () => {
    const user=userEvent.setup(); render(<NewOrderPage/>); await screen.findByText('Ana Martínez'); await user.click(screen.getByRole('button',{name:/siguiente/i})); expect(screen.getByText('Selecciona un cliente para continuar.')).toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:/ana martínez/i})); await user.click(screen.getByRole('button',{name:/siguiente/i})); expect(screen.getByText('Prenda 1')).toBeInTheDocument(); await user.click(screen.getByRole('button',{name:/agregar otra prenda/i})); expect(screen.getByText('Prenda 2')).toBeInTheDocument();
  })
  it('valida tipo y cantidad de cada prenda', async () => {
    const user=userEvent.setup(); render(<NewOrderPage/>); await user.click(await screen.findByRole('button',{name:/ana martínez/i})); await user.click(screen.getByRole('button',{name:/siguiente/i})); await user.click(screen.getByRole('button',{name:/siguiente/i})); expect(screen.getByText(/selecciona el tipo y una cantidad/i)).toBeInTheDocument()
  })
  it('envía cliente, fecha y prendas en una sola llamada a createOrder', async () => {
    const user = userEvent.setup()
    render(<NewOrderPage/>)
    await user.click(await screen.findByRole('button',{name:/ana martínez/i}))
    await user.click(screen.getByRole('button',{name:/siguiente/i})) // -> paso 2 (prendas)
    await user.selectOptions(screen.getByLabelText(/tipo de prenda/i), '2')
    await user.click(screen.getByRole('button',{name:/siguiente/i})) // -> paso 3 (servicios)
    await user.click(screen.getByRole('checkbox', { name: /lavado/i }))
    await user.click(screen.getByRole('button',{name:/siguiente/i})) // -> paso 4 (fecha)
    await user.type(screen.getByLabelText(/fecha estimada de entrega/i), '2026-09-01')
    await user.click(screen.getByRole('button',{name:/siguiente/i})) // -> paso 5 (resumen)
    await user.click(screen.getByRole('button',{name:/crear pedido/i}))

    expect(createOrder).toHaveBeenCalledTimes(1)
    expect(createOrder).toHaveBeenCalledWith(
      1,
      '2026-09-01',
      '',
      [expect.objectContaining({ tipo_prenda_id: 2, cantidad: 1, servicio_ids: [3] })],
    )
    expect(await screen.findByText('Pedido creado correctamente')).toBeInTheDocument()
  })
})
