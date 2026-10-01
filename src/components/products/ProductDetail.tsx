"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Heart, ShoppingCart, Star, Minus, Plus, Truck, RotateCcw, ShieldCheck, Check, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Product } from "@/types"
import { useCartStore } from "@/stores/cart-store"
import { Price } from "@/components/ui/price"
import { formatPrice } from "@/lib/format"
import { VariantPicker } from "./VariantPicker"
import { genderLabel } from "@/lib/category-type"

interface ProductDetailProps {
  product: Product
  // Fotos del color elegido, para mostrarlas en la galeria
  onColorImagesChange?: (images: string[]) => void
}

export function ProductDetail({ product, onColorImagesChange }: ProductDetailProps) {
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const addItem = useCartStore((state) => state.addItem)
  const router = useRouter()

  // Tallas y colores
  const variants = product.variants ?? []
  const hasVariants = variants.length > 0
  const needsSize = variants.some((variant) => variant.size)
  const needsColor = variants.some((variant) => variant.color)
  const onlyColor = needsColor ? [...new Set(variants.map((variant) => variant.color))] : []
  const [selectedSize, setSelectedSize] = useState<string | undefined>()
  // Si solo hay un color se deja elegido
  const [selectedColor, setSelectedColor] = useState<string | undefined>(
    onlyColor.length === 1 ? onlyColor[0] : undefined
  )
  const [selectionError, setSelectionError] = useState<string | null>(null)

  const selectedVariant = hasVariants
    ? variants.find(
        (variant) =>
          (!needsSize || variant.size === selectedSize) && (!needsColor || variant.color === selectedColor)
      )
    : undefined

  // Precio: el de la talla elegida; si aun no se elige y los precios cambian, se muestra "Desde"
  const variantPrices = variants.map((variant) => variant.price)
  const minPrice = hasVariants ? Math.min(...variantPrices) : product.price
  const pricesVary = hasVariants && new Set(variantPrices).size > 1
  const displayPrice = selectedVariant?.price ?? minPrice
  const availableStock = selectedVariant ? selectedVariant.stock : product.stock

  const hasDiscount = product.originalPrice && product.originalPrice > displayPrice
  const discountPercent = hasDiscount
    ? Math.round(((product.originalPrice! - displayPrice) / product.originalPrice!) * 100)
    : 0

  const handleSelectSize = (size: string) => {
    setSelectedSize(size)
    setSelectionError(null)
    setQuantity(1)
  }

  const handleSelectColor = (color: string) => {
    setSelectedColor(color)
    onColorImagesChange?.(variants.find((variant) => variant.color === color && variant.images?.length)?.images ?? [])
    setSelectionError(null)
    setQuantity(1)
    // Si la talla elegida no existe en ese color, se limpia
    if (selectedSize && !variants.some((variant) => variant.color === color && variant.size === selectedSize && variant.stock > 0)) {
      setSelectedSize(undefined)
    }
  }

  const decreaseQuantity = () => {
    if (quantity > 1) setQuantity(quantity - 1)
  }

  const increaseQuantity = () => {
    if (quantity < availableStock) setQuantity(quantity + 1)
  }

  // Con tallas/colores hay que elegir antes de agregar
  const ensureSelection = () => {
    if (!hasVariants) return true
    if (selectedVariant) return true
    setSelectionError(
      needsSize && !selectedSize ? "Elige una talla para continuar" : "Elige un color para continuar"
    )
    return false
  }

  const handleAddToCart = () => {
    if (!ensureSelection()) return
    addItem(product, quantity, selectedVariant)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  // Compra directa: agrega la cantidad elegida y lleva al carrito para finalizar
  const handleBuyNow = () => {
    if (!ensureSelection()) return
    addItem(product, quantity, selectedVariant)
    router.push("/cart")
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Badges y marca */}
      <div className="flex flex-col gap-3">
        {(product.isNew || hasDiscount) && (
          <div className="flex gap-2">
            {product.isNew && (
              <Badge className="bg-primary text-primary-foreground">Nuevo</Badge>
            )}
            {hasDiscount && <Badge variant="destructive">-{discountPercent}%</Badge>}
          </div>
        )}
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-link">
          {product.brand}
          {product.gender && (
            <span className="rounded-full bg-muted px-2 py-0.5 normal-case tracking-normal text-muted-foreground">
              {genderLabel(product.gender)}
            </span>
          )}
        </p>

        {/* Name */}
        <h1 className="text-2xl font-bold sm:text-3xl">{product.name}</h1>
      </div>

      {/* Rating */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${
                i < Math.floor(product.rating)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground"
              }`}
            />
          ))}
        </div>
        <span className="text-sm font-medium">{product.rating}</span>
        <span className="text-sm text-muted-foreground">(128 resenas)</span>
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-3">
        {pricesVary && !selectedVariant && (
          <span className="text-sm font-medium text-muted-foreground">Desde</span>
        )}
        <span className="text-3xl font-bold">
          <Price amount={displayPrice} />
        </span>
        {hasDiscount && (
          <span className="text-lg text-muted-foreground line-through">
            <Price amount={product.originalPrice!} />
          </span>
        )}
      </div>

      {/* Stock */}
      <p className="text-sm">
        {availableStock > 0 ? (
          <span className="text-green-600 dark:text-green-400">
            {availableStock} {availableStock === 1 ? "unidad disponible" : "unidades disponibles"}
            {selectedVariant?.size && ` en talla ${selectedVariant.size}`}
          </span>
        ) : (
          <span className="text-destructive">Agotado</span>
        )}
      </p>

      <Separator />

      {/* Description */}
      <div>
        <h3 className="font-semibold mb-2">Descripcion</h3>
        <p className="text-sm text-muted-foreground">{product.description}</p>
      </div>

      <Separator />

      {hasVariants && (
        <VariantPicker
          variants={variants}
          variantType={product.variantType}
          brand={product.brand}
          sizeGuide={product.sizeGuide}
          selectedSize={selectedSize}
          selectedColor={selectedColor}
          onSelectSize={handleSelectSize}
          onSelectColor={handleSelectColor}
          error={selectionError}
        />
      )}

      {/* Quantity & Add to Cart */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Quantity Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Cantidad:</span>
          <div className="flex items-center rounded-md border">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-r-none"
              onClick={decreaseQuantity}
              disabled={quantity <= 1}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-12 text-center text-sm font-medium">{quantity}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-l-none"
              onClick={increaseQuantity}
              disabled={quantity >= availableStock}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {/* Favoritos - celular (junto a la cantidad para que los botones quepan) */}
          <Button variant="outline" size="icon" className="ml-auto h-9 w-9 sm:hidden">
            <Heart className="h-4 w-4" />
            <span className="sr-only">Agregar a favoritos</span>
          </Button>
        </div>

        {/* Add to Cart y Comprar ahora en la misma linea */}
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button
            // Mismos colores que en el index: azul para agregar, naranja para comprar
            className="min-w-0 bg-brand-blue/85 px-2 text-[13px] font-bold text-white hover:bg-brand-blue sm:w-48 sm:px-4 sm:text-sm"
            size="lg"
            disabled={product.stock === 0 || added}
            onClick={handleAddToCart}
          >
            {added ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Agregado
              </>
            ) : (
              <>
                <ShoppingCart className="mr-0.5 h-4 w-4 sm:mr-2" />
                Agregar al Carrito
              </>
            )}
          </Button>
          <button
            type="button"
            onClick={handleBuyNow}
            disabled={product.stock === 0}
            className="flex h-10 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-brand/85 px-2 text-[13px] font-bold text-brand-foreground transition-colors hover:bg-brand-hover/85 disabled:pointer-events-none disabled:opacity-50 sm:w-48 sm:gap-2 sm:px-4 sm:text-sm"
          >
            <Zap className="h-4 w-4" />
            Comprar ahora
          </button>
          <Button variant="outline" size="lg" className="hidden sm:inline-flex">
            <Heart className="h-4 w-4" />
            <span className="sr-only">Agregar a favoritos</span>
          </Button>
        </div>
      </div>

      <Separator />

      {/* Benefits */}
      <div className="grid gap-4 rounded-xl bg-muted/60 p-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 text-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-brand-link">
            <Truck className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="font-medium">Envio gratis</p>
            <p className="text-xs text-muted-foreground">En pedidos desde {formatPrice(200)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-brand-link">
            <RotateCcw className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="font-medium">Devoluciones</p>
            <p className="text-xs text-muted-foreground">30 dias para devolver</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-brand-link">
            <ShieldCheck className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="font-medium">Garantia</p>
            <p className="text-xs text-muted-foreground">1 ano de garantia</p>
          </div>
        </div>
      </div>

      {/* Specs */}
      {Object.keys(product.specs).length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="font-semibold mb-3">Especificaciones</h3>
            {/* Tabla con filas alternadas */}
            <dl className="overflow-hidden rounded-xl border text-sm">
              {Object.entries(product.specs).map(([key, value]) => (
                <div key={key} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] even:bg-muted/40 odd:bg-muted/80">
                  <dt className="px-4 py-2.5 font-medium">{key}</dt>
                  <dd className="px-4 py-2.5 text-muted-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </>
      )}
    </div>
  )
}
