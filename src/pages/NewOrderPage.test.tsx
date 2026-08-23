import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NewOrderPage } from './NewOrderPage'

vi.mock('../api/orders', () => ({
  listClients: vi.fn().mockResolvedValue([{ id:1,nombre:'Ana',apellido:'Martínez',telefono:'5555',activo:true }]),
  listGarmentTypes: vi.fn().mockResolvedValue([{ id:2,nombre:'Camisa',descripcion:'',activo:true }]), createOrder:vi.fn(), addGarments:vi.fn(),
}))
describe('NewOrderPage', () => {
  it('requiere cliente, permite seleccionarlo y agregar varias prendas', async () => {
    const user=userEvent.setup(); render(<NewOrderPage/>); await screen.findByText('Ana Martínez'); await user.click(screen.getByRole('button',{name:/siguiente/i})); expect(screen.getByText('Selecciona un cliente para continuar.')).toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:/ana martínez/i})); await user.click(screen.getByRole('button',{name:/siguiente/i})); expect(screen.getByText('Prenda 1')).toBeInTheDocument(); await user.click(screen.getByRole('button',{name:/agregar otra prenda/i})); expect(screen.getByText('Prenda 2')).toBeInTheDocument();
  })
  it('valida tipo y cantidad de cada prenda', async () => {
    const user=userEvent.setup(); render(<NewOrderPage/>); await user.click(await screen.findByRole('button',{name:/ana martínez/i})); await user.click(screen.getByRole('button',{name:/siguiente/i})); await user.click(screen.getByRole('button',{name:/siguiente/i})); expect(screen.getByText(/selecciona el tipo y una cantidad/i)).toBeInTheDocument()
  })
})
