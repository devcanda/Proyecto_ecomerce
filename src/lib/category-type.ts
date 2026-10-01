import type { Gender, VariantType } from "@/types"

// Tipos de talla de un producto variable (y sugerencia por defecto de cada categoria)
export const VARIANT_TYPES: { value: VariantType; label: string; hint: string }[] = [
  { value: "NONE", label: "Sin talla", hint: "Solo colores: bolsos, termos, audífonos..." },
  { value: "FOOTWEAR", label: "Calzado", hint: "Tallas colombianas: 35, 35.5, 36..." },
  { value: "CLOTHING", label: "Ropa", hint: "XS, S, M, L... (según el género del producto)" },
]

// CLOTHING_MEN/WOMEN son tipos antiguos: hoy es "Ropa" + el genero del producto
export const isVariantType = (value: unknown): value is VariantType =>
  value === "CLOTHING_MEN" || value === "CLOTHING_WOMEN" || VARIANT_TYPES.some((type) => type.value === value)

// Convierte los tipos antiguos de ropa al tipo "Ropa" con su genero
export function normalizeSizeType(type: VariantType, gender?: Gender | null): { sizeType: VariantType; gender?: Gender } {
  if (type === "CLOTHING_MEN") return { sizeType: "CLOTHING", gender: gender ?? "MEN" }
  if (type === "CLOTHING_WOMEN") return { sizeType: "CLOTHING", gender: gender ?? "WOMEN" }
  return { sizeType: type, gender: gender ?? undefined }
}

export const GENDERS: { value: Gender; label: string }[] = [
  { value: "MEN", label: "Hombre" },
  { value: "WOMEN", label: "Mujer" },
  { value: "UNISEX", label: "Unisex" },
]

export const isGender = (value: unknown): value is Gender => GENDERS.some((gender) => gender.value === value)

export const genderLabel = (gender?: Gender | null) => GENDERS.find((item) => item.value === gender)?.label ?? ""

// Tallas que se ofrecen para marcar rapido en el formulario
export const FOOTWEAR_SIZES = Array.from({ length: 23 }, (_, i) => String(34 + i * 0.5))
export const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"]
const MEN_PANTS_SIZES = ["28", "30", "32", "34", "36", "38", "40", "42"]
const WOMEN_NUMERIC_SIZES = ["4", "6", "8", "10", "12", "14", "16", "18"]

export interface SizePresetGroup {
  label: string
  sizes: string[]
}

// Tallas sugeridas segun el tipo de talla y el genero del producto
export function sizePresets(type: VariantType, gender?: Gender): SizePresetGroup[] {
  const { sizeType, gender: resolvedGender } = normalizeSizeType(type, gender)
  if (sizeType === "FOOTWEAR") return [{ label: "Tallas COL", sizes: FOOTWEAR_SIZES }]
  if (sizeType !== "CLOTHING") return []
  if (resolvedGender === "MEN") {
    return [
      { label: "Camisas, camisetas y buzos", sizes: CLOTHING_SIZES },
      { label: "Pantalón hombre (cintura)", sizes: MEN_PANTS_SIZES },
    ]
  }
  if (resolvedGender === "WOMEN") {
    return [
      { label: "Blusas, camisetas y vestidos", sizes: CLOTHING_SIZES.slice(0, 6) },
      { label: "Pantalón y jean mujer (numérica)", sizes: WOMEN_NUMERIC_SIZES },
    ]
  }
  // Unisex o sin genero: letras y pantalon en cintura
  return [
    { label: "Camisas, camisetas y buzos", sizes: CLOTHING_SIZES },
    { label: "Pantalón (cintura)", sizes: MEN_PANTS_SIZES },
  ]
}

// Texto junto a "Talla" en la tienda
export function sizeTypeLabel(type?: VariantType) {
  switch (type) {
    case "FOOTWEAR":
      return "COL"
    default:
      return ""
  }
}

// Sugerencia de tipo al crear una categoria nueva a partir de su nombre
export function guessVariantType(name: string): VariantType {
  const text = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  if (/(calzado|zapat|teni|sandal|bota|chancla|zapatill|guayos)/.test(text)) return "FOOTWEAR"
  if (/(ropa|camis|pantal|buzo|chaquet|vestid|short|falda|blusa|sudadera|jean|licra)/.test(text)) return "CLOTHING"
  return "NONE"
}

// Sugerencia de genero a partir de un texto (nombre de categoria): "Calzado mujer" -> WOMEN
export function guessGender(name: string): Gender | undefined {
  const text = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  if (/unisex/.test(text)) return "UNISEX"
  if (/(mujer|dama|femenin)/.test(text)) return "WOMEN"
  if (/(hombre|caballero|masculin)/.test(text)) return "MEN"
  return undefined
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
  // Primero las tallas en letras y luego las numericas (ej. S, M, L, 28, 30)
  if ((ia !== -1) !== (ib !== -1)) return ia !== -1 ? -1 : 1
  if (aNumeric !== bNumeric) return aNumeric ? -1 : 1
  return a.localeCompare(b, "es", { numeric: true })
}
