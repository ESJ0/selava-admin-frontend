export const promotionMoney = (value: number) => new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(value)
export const promotionMeasure = (value: number, mode: string) => `${new Intl.NumberFormat('es-GT', { maximumFractionDigits: 3 }).format(value)} ${mode === 'LIBRA' ? 'lb' : mode === 'METRO' ? 'm' : value === 1 ? 'unidad' : 'unidades'}`
