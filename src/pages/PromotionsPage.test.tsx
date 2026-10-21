import { render, screen, within } from '@testing-library/react'
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
it('lista paquetes, modalidad, vigencia y permite desactivar y activar', async () => {
  const user = userEvent.setup()
  render(<PromotionsPage />)
  expect(screen.getByRole('status')).toHaveTextContent('Cargando')
  expect(await screen.findByText('Dos por cuarenta')).toBeInTheDocument()
  expect(screen.getByText('UNIDAD')).toBeInTheDocument(); expect(screen.getByText('Vigente')).toBeInTheDocument()
  vi.mocked(listPromotions).mockResolvedValue([{ ...promotion, activo: false }])
  await user.click(screen.getByRole('button', { name: 'Desactivar' }))
  expect(setPromotionActive).toHaveBeenCalledWith(8, false)
  await user.click(await screen.findByRole('button', { name: 'Activar' }))
  expect(setPromotionActive).toHaveBeenCalledWith(8, true)
})
it('edita una promoción sin cambiar el precio base del tipo', async () => {
  const user = userEvent.setup()
  render(<PromotionsPage />); await user.click(await screen.findByRole('button', { name: 'Editar' }))
  const form = within(screen.getByRole('dialog'))
  await user.clear(form.getByLabelText('Nombre *')); await user.type(form.getByLabelText('Nombre *'), 'Nuevo nombre')
  await user.click(form.getByRole('button', { name: 'Guardar promoción' }))
  expect(savePromotion).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Nuevo nombre', tipo_prenda_id: 2, precio_promocional: 40, modalidad_cobro: 'UNIDAD' }), 8)
})
it.each([['UNIDAD', 'Cantidad requerida'], ['LIBRA', 'Libras requeridas'], ['METRO', 'Metros requeridos']] as const)('crea con medida y modalidad compatible en %s', async (mode, label) => {
  const user = userEvent.setup(), saved = vi.fn()
  render(<PromotionForm item={null} types={[{ ...type, modalidad_cobro: mode }]} onClose={vi.fn()} onSaved={saved} />)
  await user.type(screen.getByLabelText('Nombre *'), 'Paquete')
  await user.selectOptions(screen.getByLabelText('Tipo de prenda *'), '2')
  await user.type(screen.getByLabelText(label+' *'), mode === 'UNIDAD' ? '2' : '2.5')
  await user.type(screen.getByLabelText('Precio promocional (Q) *'), '40')
  await user.type(screen.getByLabelText('Inicio *'), '2026-10-01T10:00'); await user.type(screen.getByLabelText('Fin *'), '2026-12-01T10:00')
  await user.click(screen.getByRole('button', { name: 'Guardar promoción' }))
  expect(savePromotion).toHaveBeenCalledWith(expect.objectContaining({ modalidad_cobro: mode, medida_requerida: mode === 'UNIDAD' ? 2 : 2.5 }), undefined)
  expect(saved).toHaveBeenCalled()
})
it('muestra validación antes de enviar un formulario vacío', async () => {
  const user = userEvent.setup(); render(<PromotionForm item={null} types={[type]} onClose={vi.fn()} onSaved={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: 'Guardar promoción' })); expect(screen.getByRole('alert')).toHaveTextContent('Ingresa un nombre'); expect(savePromotion).not.toHaveBeenCalled()
})
it('presenta error, reintento y estado vacío', async () => {
  vi.mocked(listPromotions).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([])
  const user = userEvent.setup(); render(<PromotionsPage />); await screen.findByRole('alert'); await user.click(screen.getByRole('button', { name: 'Reintentar' })); expect(await screen.findByText('Aún no hay promociones.')).toBeInTheDocument()
})
it('recepción consulta sin botones para administrar el catálogo', async () => {
  useAuth.setState({ roleId: 2 }); render(<PromotionsPage />); await screen.findByText('Dos por cuarenta'); expect(screen.queryByRole('button', { name: 'Nueva promoción' })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
})
