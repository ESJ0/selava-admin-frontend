/** Normaliza un NIT de Guatemala a "1234567-8" (o "CF"); devuelve el texto limpio si no puede. */
export function normalizeNit(value: string) {
  const clean = value.trim().toUpperCase().replace(/[\s.-]/g, '')
  if (!clean || clean === 'CF' || !/^[0-9]{1,12}[0-9K]$/.test(clean)) return clean
  return `${clean.slice(0, -1)}-${clean.slice(-1)}`
}

/** Verifica el dígito verificador (módulo 11, "K" = 10). Acepta "CF" para consumidor final. */
export function isValidNit(normalized: string) {
  if (normalized === 'CF') return true
  const match = /^([0-9]{1,12})-([0-9K])$/.exec(normalized)
  if (!match) return false
  const body = match[1]
  let sum = 0
  for (let i = 0; i < body.length; i++) sum += Number(body[body.length - 1 - i]) * (i + 2)
  const expected = (11 - (sum % 11)) % 11
  return match[2] === (expected === 10 ? 'K' : String(expected))
}
