import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createOrder, listGarmentTypes } from '../api/orders'
import { NewOrderPage } from './NewOrderPage'

vi.mock('../api/orders', () => ({
  listGarmentTypes: vi.fn().mockResolvedValue([{ id: 2, nombre: 'Camisa', descripcion: '', precio: 25, modalidad_cobro: 'UNIDAD', activo: true }]),
  createOrder: vi.fn().mockResolvedValue({ id: 42, cliente_id: 1, prendas: [] }),
  listServices: vi.fn().mockResolvedValue([{ id: 3, nombre: 'Lavado', precio_base: 25, activo: true }, { id: 4, nombre: 'Lavado en seco', precio_base: 35, activo: true }, { id: 5, nombre: 'Planchado', precio_base: 99, activo: true }]),
}))
vi.mock('../api/clients', () => ({
  listClients: vi.fn().mockResolvedValue([{ id: 1, nombre: 'Ana', apellido: 'Martínez', telefono: '5555', activo: true }]),
}))

async function openGarmentsStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /ana martínez/i }))
  await user.click(screen.getByRole('button', { name: /siguiente/i }))
}

describe('NewOrderPage', () => {
  it.each([
    ['UNIDAD', 'Cantidad de prendas', '1.5'],
    ['LIBRA', 'Peso en libras', '0'],
    ['LIBRA', 'Peso en libras', '-1'],
    ['LIBRA', 'Peso en libras', '1.0000000001'],
    ['METRO', 'Metros', '1.0001'],
  ] as const)('rechaza medida inválida en %s: %s = %s', async (mode, label, value) => {
    vi.mocked(listGarmentTypes).mockResolvedValueOnce([{ id: 2, nombre: 'Prueba', precio: 25, modalidad_cobro: mode, activo: true }])
    const user = userEvent.setup()
    render(<NewOrderPage />)
    await openGarmentsStep(user)
    await user.selectOptions(screen.getByLabelText('Tipo de prenda *', { selector: 'select' }), '2')
    await user.clear(screen.getByLabelText(label))
    await user.type(screen.getByLabelText(label), value)
    await user.click(screen.getByRole('button', { name: /siguiente/i }))
    expect(screen.getByText(/cantidad entera.*medida decimal/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/fecha de entrega/i)).not.toBeInTheDocument()
  })

  it('el resumen redondea medio centavo por línea igual que PostgreSQL', async () => {
    vi.mocked(listGarmentTypes).mockResolvedValueOnce([{ id: 2, nombre: 'Peso', precio: 1.23, modalidad_cobro: 'LIBRA', activo: true }])
    const user = userEvent.setup()
    render(<NewOrderPage />)
    await openGarmentsStep(user)
    await user.selectOptions(screen.getByLabelText('Tipo de prenda *', { selector: 'select' }), '2')
    await user.clear(screen.getByLabelText('Peso en libras'))
    await user.type(screen.getByLabelText('Peso en libras'), '0.5')
    await user.click(screen.getByRole('checkbox', { name: 'Lavado' }))
    await user.click(screen.getByRole('button', { name: /siguiente/i }))
    await user.type(screen.getByLabelText(/fecha de entrega/i), '2026-12-01')
    await user.click(screen.getByRole('button', { name: /siguiente/i }))
    expect(screen.getByText('Subtotal Q0.62')).toBeInTheDocument()
    expect(within(document.querySelector('.order-total') as HTMLElement).getByText('Q0.62')).toBeInTheDocument()
  })

  it('cobra cada prenda una sola vez aunque incluya varios servicios', async () => {
    const user = userEvent.setup()
    render(<NewOrderPage />)
    await openGarmentsStep(user)
    await user.selectOptions(screen.getByLabelText('Tipo de prenda *', { selector: 'select' }), '2')
    await user.clear(screen.getByLabelText('Cantidad de prendas'))
    await user.type(screen.getByLabelText('Cantidad de prendas'), '2')
    await user.click(screen.getByRole('checkbox', { name: /aplicar los mismos servicios/i }))
    await user.click(screen.getByRole('checkbox', { name: 'Lavado' }))
    await user.click(screen.getByRole('checkbox', { name: 'Planchado' }))
    expect(screen.queryByText('Q99.00')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /siguiente/i }))
    await user.type(screen.getByLabelText(/fecha de entrega/i), '2026-12-01')
    await user.click(screen.getByRole('button', { name: /siguiente/i }))
    expect(within(document.querySelector('.order-total') as HTMLElement).getByText('Q50.00')).toBeInTheDocument()
    expect(document.querySelectorAll('.summary-garment')).toHaveLength(2)
    expect(screen.getAllByText(/Subtotal Q25\.00/)).toHaveLength(2)
  })

  it('impide seleccionar tipos antiguos sin precio configurado', async () => {
    vi.mocked(listGarmentTypes).mockResolvedValueOnce([{ id: 2, nombre: 'Camisa', precio: null, modalidad_cobro: 'UNIDAD', activo: true }])
    const user = userEvent.setup()
    render(<NewOrderPage />)
    await openGarmentsStep(user)
    expect(screen.getByRole('option', { name: /Camisa — Precio pendiente/ })).toBeDisabled()
  })

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
    expect(screen.getByText(/cantidad entera.*medida decimal/i)).toBeInTheDocument()
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

  it('adapta medida, validación y resumen para libras y metros combinados', async () => {
    vi.mocked(listGarmentTypes).mockResolvedValueOnce([
      { id: 2, nombre: 'Camisa', precio: 25, modalidad_cobro: 'UNIDAD', activo: true },
      { id: 3, nombre: 'Canasta', precio: 20, modalidad_cobro: 'LIBRA', activo: true },
      { id: 4, nombre: 'Alfombra', precio: 30, modalidad_cobro: 'METRO', activo: true },
    ])
    const user = userEvent.setup()
    render(<NewOrderPage />)
    await openGarmentsStep(user)
    await user.selectOptions(screen.getByLabelText('Tipo de prenda *', { selector: 'select' }), '3')
    const pounds = screen.getByLabelText('Peso en libras')
    await user.clear(pounds); await user.type(pounds, '2.5')
    await user.click(screen.getByRole('checkbox', { name: 'Lavado' }))

    await user.click(screen.getByRole('button', { name: /agregar otro tipo/i }))
    await user.selectOptions(screen.getAllByLabelText('Tipo de prenda *', { selector: 'select' })[1], '4')
    const meters = screen.getByLabelText('Metros')
    await user.clear(meters); await user.type(meters, '1.25')
    await user.click(screen.getAllByRole('checkbox', { name: 'Lavado' })[1])

    await user.click(screen.getByRole('button', { name: /siguiente/i }))
    await user.type(screen.getByLabelText(/fecha de entrega/i), '2026-12-01')
    await user.click(screen.getByRole('button', { name: /siguiente/i }))
    expect(within(document.querySelector('.order-total') as HTMLElement).getByText('Q87.50')).toBeInTheDocument()
    expect(screen.getByText(/2\.5 libras × Q20\.00 por libra/)).toBeInTheDocument()
    expect(screen.getByText(/1\.25 metros × Q30\.00 por metro/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /crear pedido/i }))
    expect(createOrder).toHaveBeenCalledWith(1, '2026-12-01', '', [
      expect.objectContaining({ tipo_prenda_id: 3, cantidad: 2.5, detalles: [expect.objectContaining({ cantidad: 2.5 })] }),
      expect.objectContaining({ tipo_prenda_id: 4, cantidad: 1.25, detalles: [expect.objectContaining({ cantidad: 1.25 })] }),
    ])
  })
})
