// Moneda de la tienda: pesos colombianos
export const CURRENCY = "COP"
const LOCALE = "es-CO"

/**
 * Formatea un monto al estilo colombiano: punto para miles y coma para decimales.
 * Los decimales solo se muestran si existen: 159990 -> "159.990", 1299.5 -> "1.299,50"
 */
export function formatAmount(amount: number): string {
  const fractionDigits = Number.isInteger(amount) ? 0 : 2
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping: true,
  }).format(amount)
}

/** Monto con la moneda al final: "159.990 COP" */
export function formatPrice(amount: number): string {
  return `${formatAmount(amount)} ${CURRENCY}`
}
