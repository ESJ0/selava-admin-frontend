import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { listPromotions, savePromotion, setPromotionActive } from '../api/promotions'
import { listGarmentTypes } from '../api/orders'
import { useAuth } from '../store/auth'
import { promotion } from '../test/promotionFixtures'
import { PromotionForm, PromotionsPage } from './PromotionsPage'

vi.mock('../api/promotions', () => ({ listPromotions: vi.fn(), savePromotion: vi.fn(), setPromotionActive: vi.fn() }))
vi.mock('../api/orders', () => ({ listGarmentTypes: vi.fn() }))
const type = { id: 2, nombre: 'Camisa', precio: 25, modalidad_cobro: 'UNIDAD' as const, activo: true }
beforeEach(() => { vi.resetAllMocks(); useAuth.setState({ roleId: 1 }); vi.mocked(listPromotions).mockResolvedValue([promotion]); vi.mocked(listGarmentTypes).mockResolvedValue([type]); vi.mocked(savePromotion).mockResolvedValue(promotion); vi.mocked(setPromotionActive).mockResolvedValue(promotion) })

it('lista paquetes, modalidad, vigencia, ahorro y permite desactivar y activar', async () => {
  const user = userEvent.setup()
  render(<PromotionsPage />)
  expect(screen.getByRole('status')).toHaveTextContent('Cargando')
  const row = await screen.findByRole('group', { name: 'Dos por cuarenta' })
  expect(within(row).getByText('Camisa · por unidad')).toBeInTheDocument()
  expect(within(row).getByText('2 u')).toBeInTheDocument(); expect(within(row).getByText('Q40')).toBeInTheDocument()
  expect(within(row).getByText('−20% · ahorra Q10.00')).toBeInTheDocument()
  const toggle = within(row).getByRole('switch', { name: /dos por cuarenta/i })
  expect(toggle).toHaveTextContent('Vigente')
  vi.mocked(setPromotionActive).mockResolvedValueOnce({ ...promotion, activo: false })
  await user.click(toggle)
  expect(setPromotionActive).toHaveBeenCalledWith(8, false)
  await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'))
  expect(toggle).toHaveTextContent('Inactiva')
  await user.click(toggle)
  expect(setPromotionActive).toHaveBeenCalledWith(8, true)
})
it('agrupa promociones repetidas y desactiva solo las copias', async () => {
  const user = userEvent.setup()
  vi.mocked(listPromotions).mockResolvedValue([promotion, { ...promotion, id: 9 }, { ...promotion, id: 10 }])
  render(<PromotionsPage />)
  await screen.findByRole('group', { name: 'Dos por cuarenta' })
  expect(screen.getAllByRole('group')).toHaveLength(1)
  await user.click(screen.getByRole('tab', { name: 'Repetidas (2)' }))
  const card = screen.getByRole('article', { name: 'Dos por cuarenta repetida' })
  expect(within(card).getByText('Camisa · 3 registros iguales')).toBeInTheDocument()
  await user.click(within(card).getByRole('button', { name: 'Dejar solo la original' }))
  await waitFor(() => expect(setPromotionActive).toHaveBeenCalledTimes(2))
  expect(setPromotionActive).toHaveBeenCalledWith(9, false); expect(setPromotionActive).toHaveBeenCalledWith(10, false)
  expect(await within(card).findByText('Copias desactivadas')).toBeInTheDocument()
  expect(within(card).getByRole('switch', { name: /original/ })).toHaveAttribute('aria-checked', 'true')
})
it('edita una promoción sin cambiar el precio base del tipo', async () => {
  const user = userEvent.setup()
  render(<PromotionsPage />); await user.click(await screen.findByRole('button', { name: 'Editar Dos por cuarenta' }))
  const form = within(screen.getByRole('dialog'))
  expect(form.getByRole('radio', { name: /camisa/i })).toHaveAttribute('aria-checked', 'true')
  await user.clear(form.getByLabelText(/^Nombre/)); await user.type(form.getByLabelText(/^Nombre/), 'Nuevo nombre')
  await user.click(form.getByRole('button', { name: 'Guardar promoción' }))
  expect(savePromotion).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Nuevo nombre', tipo_prenda_id: 2, precio_promocional: 40, modalidad_cobro: 'UNIDAD' }), 8)
})

it.each([['UNIDAD', 'Cantidad requerida'], ['LIBRA', 'Libras requeridas'], ['METRO', 'Metros requeridos']] as const)('crea con medida y modalidad compatible en %s', async (mode, label) => {
  const user = userEvent.setup(), saved = vi.fn()
  render(<PromotionForm item={null} types={[{ ...type, modalidad_cobro: mode }]} onClose={vi.fn()} onSaved={saved} />)
  await user.click(screen.getByRole('radio', { name: /camisa/i }))
  await user.type(screen.getByLabelText(new RegExp(`^${label}`)), mode === 'UNIDAD' ? '2' : '2.5')
  await user.type(screen.getByLabelText(/^Precio promocional/), '40')
  await user.click(screen.getByRole('button', { name: /^Usar/ }))
  expect(screen.getByLabelText(/^Nombre/)).toHaveValue(mode === 'UNIDAD' ? '2 unidades por Q40' : `2.5 ${mode === 'LIBRA' ? 'lb' : 'm'} por Q40`)
  fireEvent.change(screen.getByLabelText(/^Inicio/), { target: { value: '2026-10-01T10:00' } }); fireEvent.change(screen.getByLabelText(/^Fin/), { target: { value: '2026-12-01T10:00' } })
  await user.click(screen.getByRole('button', { name: 'Guardar promoción' }))
  expect(savePromotion).toHaveBeenCalledWith(expect.objectContaining({ modalidad_cobro: mode, medida_requerida: mode === 'UNIDAD' ? 2 : 2.5, activo: true }), undefined)
  expect(saved).toHaveBeenCalled()
})

it('muestra validación por campo antes de enviar un formulario vacío', async () => {
  const user = userEvent.setup(); render(<PromotionForm item={null} types={[type]} onClose={vi.fn()} onSaved={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: 'Guardar promoción' }))
  expect(screen.getByText('Elige un tipo de prenda.')).toBeInTheDocument()
  expect(screen.getByText('Escribe un nombre.')).toBeInTheDocument()
  expect(screen.getByText('Cantidad mayor que cero.')).toBeInTheDocument()
  expect(savePromotion).not.toHaveBeenCalled()
})

it('rechaza unidades fraccionarias y fin anterior al inicio', async () => {
  const user = userEvent.setup(); render(<PromotionForm item={null} types={[type]} onClose={vi.fn()} onSaved={vi.fn()} />)
  await user.click(screen.getByRole('radio', { name: /camisa/i }))
  await user.type(screen.getByLabelText(/^Cantidad requerida/), '1.5'); await user.type(screen.getByLabelText(/^Precio promocional/), '40'); await user.type(screen.getByLabelText(/^Nombre/), 'Paquete')
  fireEvent.change(screen.getByLabelText(/^Inicio/), { target: { value: '2026-12-01T10:00' } }); fireEvent.change(screen.getByLabelText(/^Fin/), { target: { value: '2026-10-01T10:00' } })
  await user.click(screen.getByRole('button', { name: 'Guardar promoción' }))
  expect(screen.getByText('Usa un número entero de unidades.')).toBeInTheDocument()
  expect(screen.getByText('El fin debe ser posterior al inicio.')).toBeInTheDocument()
  expect(savePromotion).not.toHaveBeenCalled()
})

it('presenta error, reintento y estado vacío', async () => {
  vi.mocked(listPromotions).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([])
  const user = userEvent.setup(); render(<PromotionsPage />); await screen.findByRole('alert'); await user.click(screen.getByRole('button', { name: 'Reintentar' })); expect(await screen.findByText('Aún no hay promociones.')).toBeInTheDocument()
})

it('recepción consulta sin botones para administrar el catálogo', async () => {
  useAuth.setState({ roleId: 2 }); render(<PromotionsPage />); await screen.findByText('Dos por cuarenta'); expect(screen.queryByRole('button', { name: 'Nueva promoción' })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
})
