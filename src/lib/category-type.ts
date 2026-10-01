import type { VariantType } from "@/types"

export const VARIANT_TYPES: { value: VariantType; label: string; hint: string }[] = [
  { value: "NONE", label: "Sin tallas", hint: "Tecnologia, accesorios y articulos varios" },
  { value: "FOOTWEAR", label: "Calzado", hint: "Tallas colombianas: 35, 35.5, 36..." },
  { value: "CLOTHING", label: "Ropa", hint: "Tallas XS, S, M, L, XL..." },
]

export const isVariantType = (value: unknown): value is VariantType =>
  VARIANT_TYPES.some((type) => type.value === value)

// Tallas que se ofrecen para marcar rapido en el formulario
export const FOOTWEAR_SIZES = Array.from({ length: 23 }, (_, i) => String(34 + i * 0.5))
export const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"]

// Sugerencia de tipo al crear una categoria nueva a partir de su nombre
export function guessVariantType(name: string): VariantType {
  const text = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  if (/(calzado|zapat|teni|sandal|bota|chancla|zapatill|guayos)/.test(text)) return "FOOTWEAR"
  if (/(ropa|camis|pantal|buzo|chaquet|vestid|short|falda|blusa|sudadera|jean|licra)/.test(text))
    return "CLOTHING"
  return "NONE"
}

// Orden natural de tallas: numericas de menor a mayor (38, 38.5, 39...), ropa en su orden (XS, S, M...)
export function compareSizes(a: string, b: string) {
  const na = Number(a.replace(",", "."))
  const nb = Number(b.replace(",", "."))
  const aNumeric = a.trim() !== "" && Number.isFinite(na)
  const bNumeric = b.trim() !== "" && Number.isFinite(nb)
  if (aNumeric && bNumeric) return na - nb
  const ia = CLOTHING_SIZES.indexOf(a.toUpperCase())
  const ib = CLOTHING_SIZES.indexOf(b.toUpperCase())
  if (ia !== -1 && ib !== -1) return ia - ib
  if (aNumeric !== bNumeric) return aNumeric ? -1 : 1
  if ((ia !== -1) !== (ib !== -1)) return ia !== -1 ? -1 : 1
  return a.localeCompare(b, "es", { numeric: true })
}
