import { expect, it } from 'vitest'
import { chargeSubtotal } from './chargePricing'

it.each([[2.01, 0.5, 1.01], [1.23, 0.5, 0.62], [1.01, 0.5, 0.51], [25, 2, 50], [20, 2.125, 42.5], [30, 1.25, 37.5]])('cobra Q%s por %s = Q%s con centavos decimales', (price, measure, expected) => {
  expect(chargeSubtotal(price, measure)).toBe(expected)
})
