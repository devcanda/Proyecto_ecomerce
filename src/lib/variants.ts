import type { Prisma } from "@prisma/client"

export interface VariantInput {
  id?: string
  size?: string
  color?: string
  price?: number | null
  stock: number
  // Fotos del color (la primera es la portada)
  images: string[]
}

// Maximo de fotos por color
export const MAX_COLOR_IMAGES = 8

// Solo rutas propias (/uploads/...) o direcciones http(s)
const isImageUrl = (value: unknown): value is string =>
  typeof value === "string" && /^(\/uploads\/|https?:\/\/)/.test(value)

// Limpia las variantes que llegan del formulario (descarta filas sin talla ni color)
export function parseVariants(raw: unknown): VariantInput[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      const value = (item ?? {}) as Record<string, unknown>
      const size = typeof value.size === "string" ? value.size.trim() : ""
      const color = typeof value.color === "string" ? value.color.trim() : ""
      const price = typeof value.price === "number" && value.price > 0 ? value.price : null
      const stock = typeof value.stock === "number" && value.stock > 0 ? Math.floor(value.stock) : 0
      // Solo rutas propias (/uploads/...) o direcciones http(s)
      const images = Array.isArray(value.images)
        ? [...new Set(value.images.filter(isImageUrl))].slice(0, MAX_COLOR_IMAGES)
        : []
      return {
        id: typeof value.id === "string" && value.id ? value.id : undefined,
        size: size || undefined,
        color: color || undefined,
        price,
        stock,
        images,
      }
    })
    .filter((variant) => variant.size || variant.color)
}

export const totalVariantStock = (variants: VariantInput[]) =>
  variants.reduce((total, variant) => total + variant.stock, 0)

// Deja en la base de datos exactamente las variantes recibidas: actualiza las existentes,
// crea las nuevas y borra las que se quitaron (los pedidos antiguos conservan su texto de talla)
export async function syncVariants(
  tx: Prisma.TransactionClient,
  productId: string,
  variants: VariantInput[]
) {
  const existing = await tx.productVariant.findMany({
    where: { productId },
    select: { id: true },
  })
  const existingIds = new Set(existing.map((variant) => variant.id))
  const keptIds = variants.flatMap((variant) =>
    variant.id && existingIds.has(variant.id) ? [variant.id] : []
  )

  await tx.productVariant.deleteMany({
    where: { productId, id: { notIn: keptIds } },
  })

  for (const [position, variant] of variants.entries()) {
    const data = {
      size: variant.size ?? null,
      color: variant.color ?? null,
      price: variant.price ?? null,
      stock: variant.stock,
      images: variant.images,
      position,
    }
    if (variant.id && existingIds.has(variant.id)) {
      await tx.productVariant.update({ where: { id: variant.id }, data })
    } else {
      await tx.productVariant.create({ data: { ...data, productId } })
    }
  }
}

// Texto que se guarda en el pedido: "Talla 40 · Negro"
export function variantLabel(variant: { size?: string | null; color?: string | null }) {
  return [variant.size ? `Talla ${variant.size}` : null, variant.color || null]
    .filter(Boolean)
    .join(" · ")
}
