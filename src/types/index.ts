// Tipo de tallas que usa una categoria
export type VariantType = "NONE" | "FOOTWEAR" | "CLOTHING" | "CLOTHING_MEN" | "CLOTHING_WOMEN"

// Para quien es el producto (sin valor = no aplica)
export type Gender = "MEN" | "WOMEN" | "UNISEX"

// Talla y/o color de un producto; price ya trae el precio final (el propio o el del producto)
export interface ProductVariant {
  id: string
  size?: string
  color?: string
  price: number
  stock: number
  // Fotos del color de esta variante (la primera es la portada)
  images?: string[]
}

export interface Product {
  id: string
  name: string
  slug: string
  brand: string
  category: string
  price: number
  originalPrice?: number
  images: string[]
  description: string
  specs: Record<string, string>
  stock: number
  // STOCK (inventario propio), SUPPLIER (proveedor/dropshipping) o PREORDER (bajo pedido, en camino)
  availability?: "STOCK" | "SUPPLIER" | "PREORDER"
  isNew: boolean
  isFeatured: boolean
  rating: number
  variantType?: VariantType
  variants?: ProductVariant[]
  // Imagen de la guia de tallas de la marca
  sizeGuide?: string
  model?: string
  gender?: Gender
}

export interface Category {
  id: string
  name: string
  slug: string
  icon: string
  productCount: number
  variantType?: VariantType
}

export interface Brand {
  id: string
  name: string
  logo?: string
  sizeGuide?: string
  productCount: number
}

export interface CartItem {
  product: Product
  quantity: number
  // Talla/color elegidos (solo en productos con variantes)
  variant?: ProductVariant
}

export interface FilterState {
  categories: string[]
  brands: string[]
  priceRange: [number, number]
  sortBy: 'popular' | 'price-asc' | 'price-desc' | 'newest' | 'rating'
  search: string
  genders: Gender[]
}
