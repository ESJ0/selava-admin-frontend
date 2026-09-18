import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PaymentHistory } from './PaymentHistory'

const payments = [
  {
    id: 1,
    monto: 20,
    fecha_pago: '2026-09-05T10:00:00Z',
    referencia: 'AUTH-123',
    metodo_pago: { id: 1, nombre: 'Tarjeta', activo: true },
    usuario: { id: 7, nombre: 'Luis', apellido: 'Pérez' },
  },
  {
    id: 2,
    monto: 15,
    fecha_pago: '2026-09-06T11:30:00Z',
    metodo_pago: { id: 2, nombre: 'Efectivo', activo: true },
  },
]

describe('PaymentHistory', () => {
  it('muestra los pagos, sus detalles y los totales del pedido', () => {
    render(<MemoryRouter><PaymentHistory orderId={42} payments={payments} total={50} canRegister/></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Historial de pagos' })).toBeInTheDocument()
    expect(screen.getByText('2 pagos')).toBeInTheDocument()
    expect(screen.getByText('Tarjeta')).toBeInTheDocument()
    expect(screen.getByText('Efectivo')).toBeInTheDocument()
    expect(screen.getByText(/Ref\. AUTH-123 · Registrado por Luis Pérez/)).toBeInTheDocument()
    expect(screen.getByText(/Q\s*35\.00/)).toBeInTheDocument()
    expect(screen.getAllByText(/Q\s*15\.00/)).toHaveLength(2)
    expect(screen.getByRole('link', { name: /registrar pago/i })).toHaveAttribute('href', '/pedidos/42/cobrar')
  })

  it('muestra el estado vacío', () => {
    render(<MemoryRouter><PaymentHistory orderId={42} payments={[]} total={50}/></MemoryRouter>)
    expect(screen.getByText('Este pedido todavía no tiene pagos registrados.')).toBeInTheDocument()
    expect(screen.getByText('0 pagos')).toBeInTheDocument()
  })

  it('oculta la acción de cobro cuando el pedido ya está pagado', () => {
    render(<MemoryRouter><PaymentHistory orderId={42} payments={payments} total={35} canRegister/></MemoryRouter>)
    expect(screen.queryByRole('link', { name: /registrar pago/i })).not.toBeInTheDocument()
    expect(screen.getByText(/Q\s*0\.00/)).toBeInTheDocument()
  })
})
