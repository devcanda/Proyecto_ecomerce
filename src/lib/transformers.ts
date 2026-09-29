import type { Product, Category, Brand } from "@/types"
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
  const variants = product.variants?.length
    ? product.variants.map((variant) => ({
        id: variant.id,
        size: variant.size || undefined,
        color: variant.color || undefined,
        price: variant.price !== null ? Number(variant.price) : price,
        stock: variant.stock,
      }))
    : undefined

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    brand: product.brand.name,
    category: product.category.slug,
    price,
    originalPrice: product.comparePrice ? Number(product.comparePrice) : undefined,
    images: product.images,
    description: product.description || "",
    specs: (product.specs as Record<string, string>) || {},
    // Con variantes, el stock total es la suma de todas las tallas/colores
    stock: variants ? variants.reduce((total, variant) => total + variant.stock, 0) : product.stock,
    isNew: product.isNew,
    isFeatured: product.isFeatured,
    rating: 4.5, // Default rating - could be calculated from reviews in the future
    variantType: product.category.variantType,
    variants,
    sizeGuide: product.brand.sizeGuide || undefined,
    model: product.model?.name,
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
