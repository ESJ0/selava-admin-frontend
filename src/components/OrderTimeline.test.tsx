import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { HistorialEstado } from '../types'
import { OrderTimeline } from './OrderTimeline'

const entry = (id: number, state: string, date: string): HistorialEstado => ({
  id, pedido_id: 42, estado_id: id, usuario_id: 7, fecha_cambio: date,
  estado: { id, nombre: state, orden: id },
  usuario: { id: 7, nombre: 'Ana', apellido: 'Pérez' },
})

describe('OrderTimeline', () => {
  it('presenta primero el cambio más reciente aunque la respuesta llegue desordenada', () => {
    render(<OrderTimeline history={[
      entry(3, 'Finalizado', '2026-10-03T10:00:00Z'),
      entry(1, 'Recibido', '2026-10-01T10:00:00Z'),
      entry(2, 'Rackeado', '2026-10-02T10:00:00Z'),
    ]}/>)

    const items = within(screen.getByRole('list', { name: 'Historial de estados' })).getAllByRole('listitem')
    expect(items.map(item => item.textContent)).toEqual([
      expect.stringContaining('Finalizado'),
      expect.stringContaining('Rackeado'),
      expect.stringContaining('Recibido'),
    ])
    expect(items[0]).toHaveClass('latest')
  })

  it('muestra el estado vacío sin inventar movimientos', () => {
    render(<OrderTimeline history={[]}/>)
    expect(screen.getByText('Este pedido todavía no tiene cambios registrados.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Historial de estados' })).not.toBeInTheDocument()
  })
})
