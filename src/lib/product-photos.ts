import { prisma } from "@/lib/prisma"
import { MAX_COLOR_IMAGES } from "@/lib/variants"
import { matchKey, type PhotoTarget } from "@/lib/photo-names"

// Maximo de fotos generales por producto
export const MAX_PRODUCT_IMAGES = 10

const isImageUrl = (value: unknown): value is string =>
  typeof value === "string" && /^(\/uploads\/|https?:\/\/)/.test(value)

// Productos con sus fotos actuales (generales y por color)
export async function listPhotoTargets(ids?: string[]): Promise<PhotoTarget[]> {
  const products = await prisma.product.findMany({
    where: ids ? { id: { in: ids } } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      sku: true,
      name: true,
      slug: true,
      images: true,
      brand: { select: { name: true } },
      model: { select: { name: true } },
      variants: { orderBy: { position: "asc" }, select: { color: true, images: true } },
    },
  })
  return products.map((product) => {
    // Un color aparece una vez aunque tenga varias tallas
    const colors = new Map<string, { name: string; images: string[] }>()
    for (const variant of product.variants) {
      if (!variant.color) continue
      const key = matchKey(variant.color)
      const current = colors.get(key)
      if (!current) colors.set(key, { name: variant.color, images: variant.images })
      else if (!current.images.length && variant.images.length) current.images = variant.images
    }
    return {
      id: product.id,
      sku: product.sku ?? undefined,
      name: product.name,
      slug: product.slug,
      brand: product.brand.name,
      model: product.model?.name,
      images: product.images,
      colors: [...colors.values()],
    }
  })
}

export async function getPhotoTarget(id: string) {
  return (await listPhotoTargets([id]))[0] ?? null
}

export class PhotoAssignError extends Error {}

// Agrega (o reemplaza) fotos de un producto o de uno de sus colores
export async function assignPhotos(input: {
  productId: string
  color?: string | null
  urls: unknown[]
  mode: "append" | "replace"
}) {
  const urls = [...new Set(input.urls.filter(isImageUrl))]
  if (!urls.length) throw new PhotoAssignError("No hay fotos para guardar")

  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { id: true, images: true, variants: { select: { id: true, color: true, images: true } } },
  })
  if (!product) throw new PhotoAssignError("El producto ya no existe")

  const merge = (current: string[], max: number) =>
    (input.mode === "replace" ? urls : [...new Set([...current, ...urls])]).slice(0, max)

  if (!input.color) {
    const images = merge(product.images, MAX_PRODUCT_IMAGES)
    await prisma.product.update({ where: { id: product.id }, data: { images } })
    return { images }
  }

  // Las fotos de un color se comparten entre todas sus tallas
  const key = matchKey(input.color)
  const variants = product.variants.filter((variant) => variant.color && matchKey(variant.color) === key)
  if (!variants.length) throw new PhotoAssignError(`El producto no tiene el color "${input.color}"`)
  const current = variants.find((variant) => variant.images.length)?.images ?? []
  const images = merge(current, MAX_COLOR_IMAGES)
  await prisma.productVariant.updateMany({ where: { id: { in: variants.map((variant) => variant.id) } }, data: { images } })
  return { images }
}
