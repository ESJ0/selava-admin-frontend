// Precio en centavos y medida en milesimas: redondeo decimal por subtotal,
// a medio centavo hacia arriba, igual que ROUND(numeric, 2) de PostgreSQL.
export function chargeSubtotal(price: number, measure: number): number {
  if (!Number.isFinite(price) || !Number.isFinite(measure) || price < 0 || measure < 0) return 0
  const cents = BigInt(Math.round(price * 100))
  const thousandths = BigInt(Math.round(measure * 1000))
  return Number((cents * thousandths + 500n) / 1000n) / 100
}
