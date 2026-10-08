// Reglas para reconocer a que producto y color pertenece una foto por el nombre del archivo.
// Ej.: CAT-001.jpg, CAT-001-2.jpg, NIK-AF1_Negro.jpg, NIK-AF1_Negro-2.jpg, "NIK-AF1 Rosado Blanco (3).png"
// (se usa en el navegador y en el servidor)

// Producto al que se le pueden asignar fotos
export interface PhotoTarget {
  id: string
  sku?: string
  name: string
  slug: string
  brand: string
  model?: string
  images: string[]
  colors: { name: string; images: string[] }[]
}

export interface PhotoMatch {
  productId?: string
  // Color exacto del producto (undefined = fotos generales del producto)
  color?: string
  // Orden dentro del producto/color (1 = portada)
  position: number
  // Texto de color que no coincide con ningun color del producto
  unknownColor?: string
}

// Texto comparable: sin tildes, mayusculas ni simbolos ("Rosado/Blanco" = "rosado blanco" = "ROSADO-BLANCO")
export const matchKey = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "")

// Carpeta o nombre sin la extension
const baseName = (fileName: string) => fileName.split(/[\\/]/).pop()!.replace(/\.[a-z0-9]{2,5}$/i, "")

export function matchPhotoFile(fileName: string, targets: PhotoTarget[]): PhotoMatch {
  const base = baseName(fileName).trim()
  const lower = base.toLowerCase()

  // La referencia mas larga con la que empieza el nombre (CAT-001 antes que CAT-0)
  let best: { target: PhotoTarget; length: number } | null = null
  for (const target of targets) {
    if (!target.sku) continue
    const sku = target.sku.toLowerCase()
    if (!lower.startsWith(sku)) continue
    const next = lower.charAt(sku.length)
    // Despues de la referencia debe venir el final o un separador (CAT-001 no debe tomar CAT-0012)
    if (next && /[a-z0-9]/.test(next)) continue
    if (!best || sku.length > best.length) best = { target, length: sku.length }
  }
  if (!best) return { position: 1 }

  let rest = base.slice(best.length).trim()
  // Numero de foto al final: -2, _2, " 2", "(2)"
  let position = 1
  const number = rest.match(/[\s_-]*\(?(\d{1,2})\)?$/)
  if (number && number.index !== undefined) {
    position = Math.max(1, Number(number[1]))
    rest = rest.slice(0, number.index)
  }
  const colorText = rest.replace(/^[\s_-]+|[\s_-]+$/g, "")
  // Sin colores en el producto, el texto extra se ignora (ej. CAT-001_frente.jpg)
  if (!colorText || !best.target.colors.length) return { productId: best.target.id, position }

  const color = best.target.colors.find((item) => matchKey(item.name) === matchKey(colorText))
  if (color) return { productId: best.target.id, color: color.name, position }
  // Color que no existe en el producto: se pide elegirlo
  return { productId: best.target.id, position, unknownColor: colorText }
}

export const hasPhotos = (target: PhotoTarget) =>
  target.images.length > 0 || target.colors.some((color) => color.images.length > 0)

// Colores del producto que aun no tienen fotos
export const colorsWithoutPhotos = (target: PhotoTarget) => target.colors.filter((color) => color.images.length === 0)
