/// <reference types="node" />

import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { FlujoOperativoPedido } from '../types'
import { OrderProgressTimeline } from './OrderProgressTimeline'
import { OrderStateControl } from './OrderStateControl'

const styles = readFileSync(resolve(process.cwd(), 'src/App.css'), 'utf8')

const flow: FlujoOperativoPedido = {
  progreso_porcentaje: 25,
  cancelado: false,
  siguiente_estado: { id: 2, nombre: 'En lavado', codigo: 'EN_LAVADO', orden: 20 },
  estados: [
    { id: 1, nombre: 'Recibido', codigo: 'RECIBIDO', orden: 10, servicios: [], completado: true, actual: true },
    { id: 2, nombre: 'En lavado', codigo: 'EN_LAVADO', orden: 20, servicios: [], completado: false, actual: false },
    { id: 3, nombre: 'Rackeado', codigo: 'RACKEADO', orden: 50, servicios: [], completado: false, actual: false },
    { id: 4, nombre: 'Finalizado', codigo: 'FINALIZADO', orden: 60, servicios: [], completado: false, actual: false },
  ],
}

describe.each([
  { device: 'móvil', width: 390 },
  { device: 'tablet', width: 768 },
  { device: 'escritorio', width: 1440 },
])('progreso responsive en $device', ({ width }) => {
  it('conserva todas las etapas y el control accesibles', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
    window.dispatchEvent(new Event('resize'))

    render(<><OrderProgressTimeline flow={flow}/><OrderStateControl flow={flow} observations="" submitting={false} onObservationsChange={vi.fn()} onAdvance={vi.fn()}/></>)

    expect(screen.getAllByRole('listitem')).toHaveLength(flow.estados.length)
    expect(screen.getByRole('button', { name: 'Avanzar a En lavado' })).toBeVisible()
    expect(screen.getByLabelText('Observaciones')).toBeVisible()
  })
})

describe('reglas responsive del progreso', () => {
  it('mantiene timeline horizontal en escritorio', () => {
    expect(styles).toContain('grid-template-columns: repeat(var(--stage-count), minmax(112px, 1fr))')
  })

  it('incluye un ajuste intermedio para tablet', () => {
    expect(styles).toContain('@media (min-width: 681px) and (max-width: 980px)')
    expect(styles).toContain('minmax(104px, 1fr)')
  })

  it('convierte timeline y controles a una columna en móvil', () => {
    expect(styles).toContain('@media (max-width: 680px)')
    expect(styles).toContain('.order-progress-timeline { grid-template-columns: 1fr')
    expect(styles).toContain('.confirm-modal footer{width:100%;flex-direction:column-reverse}')
  })
})
