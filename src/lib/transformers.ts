import type { Product, Category, Brand } from "@/types"
import { sellsWithoutStock } from "@/lib/availability"
import type {
  Product as PrismaProduct,
  Category as PrismaCategory,
  Brand as PrismaBrand,
  ProductVariant as PrismaProductVariant,
  ProductModel as PrismaProductModel,
} from "@prisma/client"

type ProductWithRelations = PrismaProduct & {
  category: PrismaCategory
  brand: PrismaBrand
  variants?: PrismaProductVariant[]
  model?: PrismaProductModel | null
}

// Unidades que se pueden pedir por linea de un producto sin stock propio (proveedor o bajo pedido)
export const ON_DEMAND_MAX_QUANTITY = 10

// Imagen generica para productos que aun no tienen fotos
export const NO_PHOTO_IMAGE = "/producto-sin-foto.webp"

// Relaciones que necesita transformProduct (para usar en los include de Prisma)
export const productInclude = {
  category: true,
  brand: true,
  model: true,
  variants: { orderBy: { position: "asc" } },
} as const

type CategoryWithCount = PrismaCategory & {
  _count?: { products: number }
}

type BrandWithCount = PrismaBrand & {
  _count?: { products: number }
}

export function transformProduct(product: ProductWithRelations): Product {
  const price = Number(product.price)
  // Proveedor/dropshipping o bajo pedido: todas las tallas/colores se pueden comprar sin stock registrado
  const onDemand = sellsWithoutStock(product.availability)
  const variants = product.variants?.length
    ? product.variants.map((variant) => ({
        id: variant.id,
        size: variant.size || undefined,
        color: variant.color || undefined,
        price: variant.price !== null ? Number(variant.price) : price,
        stock: onDemand ? ON_DEMAND_MAX_QUANTITY : variant.stock,
        images: variant.images.length ? variant.images : undefined,
      }))
    : undefined

  // Sin fotos generales se usan las de los colores; sin ninguna, la imagen generica
  // (la portada de cada color)
  const colorImages = [...new Set(variants?.flatMap((variant) => variant.images?.slice(0, 1) ?? []) ?? [])]
  const images = product.images.length
    ? product.images
    : colorImages.length
      ? colorImages
      : [NO_PHOTO_IMAGE]

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    brand: product.brand.name,
    category: product.category.slug,
    price,
    originalPrice: product.comparePrice ? Number(product.comparePrice) : undefined,
    images,
    description: product.description || "",
    specs: (product.specs as Record<string, string>) || {},
    // Con variantes, el stock total es la suma de todas las tallas/colores
    stock: onDemand
      ? ON_DEMAND_MAX_QUANTITY
      : variants
        ? variants.reduce((total, variant) => total + variant.stock, 0)
        : product.stock,
    availability: product.availability,
    isNew: product.isNew,
    isFeatured: product.isFeatured,
    rating: 4.5, // Default rating - could be calculated from reviews in the future
    // Tipo de talla del propio producto
    variantType: product.sizeType,
    variants,
    sizeGuide: product.brand.sizeGuide || undefined,
    model: product.model?.name,
    gender: product.gender ?? undefined,
  }
}

export function transformCategory(category: CategoryWithCount): Category {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    icon: category.icon || "Package",
    productCount: category._count?.products || 0,
    variantType: category.variantType,
  }
}

export function transformBrand(brand: BrandWithCount): Brand {
  return {
    id: brand.id,
    name: brand.name,
    logo: brand.logo || undefined,
    sizeGuide: brand.sizeGuide || undefined,
    productCount: brand._count?.products || 0,
  }
}
