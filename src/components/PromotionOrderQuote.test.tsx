import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { quotePromotions } from '../api/promotions'
import { applied, group } from '../test/promotionFixtures'
import type { PrendaDraft } from '../types'
import { PromotionOrderQuote } from './PromotionOrderQuote'

vi.mock('../api/promotions', () => ({ quotePromotions: vi.fn() }))
const garments: PrendaDraft[] = [{ tipo_prenda_id: 2, cantidad: 5, aplicar_servicio_comun: false, servicio_ids_comunes: [], detalles: [{ cantidad: 5, color: '', descripcion: '', servicio_ids: [1, 2] }] }]
beforeEach(() => vi.resetAllMocks())
it('selecciona una promoción elegible y presenta aplicaciones, cubiertas y sobrantes del servidor', async () => {
  const user = userEvent.setup(), status = vi.fn()
  vi.mocked(quotePromotions).mockResolvedValueOnce({ grupos: [group], total: 125 }).mockResolvedValueOnce({ grupos: [{ ...group, aplicada: applied, subtotal_total: 105 }], total: 105 })
  render(<PromotionOrderQuote garments={garments} onStatus={status} />)
  expect(screen.getByRole('status')).toHaveTextContent('Calculando')
  await user.selectOptions(await screen.findByLabelText('Promoción para Camisa'), '8')
  expect(await screen.findByText('4 unidades')).toBeInTheDocument()
  expect(screen.getByText(/1 unidad × Q\s*25\.00/)).toBeInTheDocument()
  expect(screen.getByText(/Q\s*80\.00/)).toBeInTheDocument()
  expect(within(screen.getByRole('article')).getByText(/Q\s*105\.00/)).toBeInTheDocument()
  expect(quotePromotions).toHaveBeenLastCalledWith(garments, [{ tipo_prenda_id: 2, promocion_id: 8 }], expect.any(AbortSignal))
  expect(status).toHaveBeenLastCalledWith(expect.objectContaining({ ready: true, quote: expect.objectContaining({ total: 105 }) }))
})
it.each([['LIBRA', 12.5, 10, 2.5, '10 lb', '2.5 lb'], ['METRO', 5.5, 4, 1.5, '4 m', '1.5 m']] as const)('presenta medidas decimales en %s', async (mode, measure, covered, remainder, expectedCovered, expectedRemainder) => {
  const p = { ...applied, modalidad_cobro_aplicada: mode, medida_disponible: measure, medida_cubierta: covered, sobrante: remainder }
  vi.mocked(quotePromotions).mockResolvedValue({ grupos: [{ ...group, modalidad_cobro: mode, aplicada: p }], total: 105 })
  render(<PromotionOrderQuote garments={garments} onStatus={vi.fn()} />)
  expect(await screen.findByText(expectedCovered)).toBeInTheDocument()
  expect(screen.getByText(new RegExp(expectedRemainder+' ×'))).toBeInTheDocument()
})
it('maneja error, reintento y catálogo sin promociones elegibles', async () => {
  const user = userEvent.setup()
  vi.mocked(quotePromotions).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ grupos: [{ ...group, elegibles: [] }], total: 125 })
  render(<PromotionOrderQuote garments={garments} onStatus={vi.fn()} />)
  await screen.findByRole('alert'); await user.click(screen.getByRole('button', { name: 'Reintentar cotización' }))
  expect(await screen.findByText('No hay promociones elegibles para esta medida.')).toBeInTheDocument()
})
it('ignora respuestas anteriores al cambiar las prendas', async () => {
  let resolveFirst!: (value: { grupos: typeof group[]; total: number }) => void
  vi.mocked(quotePromotions).mockReturnValueOnce(new Promise(resolve => { resolveFirst = resolve })).mockResolvedValueOnce({ grupos: [group], total: 105 })
  const status = vi.fn(), next = [{ ...garments[0], cantidad: 7 }]
  const view = render(<PromotionOrderQuote garments={garments} onStatus={status} />)
  view.rerender(<PromotionOrderQuote garments={next} onStatus={status} />)
  await waitFor(() => expect(status).toHaveBeenLastCalledWith(expect.objectContaining({ quote: expect.objectContaining({ total: 105 }) })))
  await act(async () => { resolveFirst({ grupos: [], total: 999 }) })
  await waitFor(() => expect(status).not.toHaveBeenCalledWith(expect.objectContaining({ quote: expect.objectContaining({ total: 999 }) })))
})
