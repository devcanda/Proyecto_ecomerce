"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Heart, ShoppingCart, Star, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Product } from "@/types"
import { useCartStore } from "@/stores/cart-store"
import { Price } from "@/components/ui/price"

interface ProductCardProps {
  product: Product
}

const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1629429408209-1f912961dbd8?w=400&h=400&fit=crop"

export function ProductCard({ product }: ProductCardProps) {
  const router = useRouter()
  const addItem = useCartStore((state) => state.addItem)
  const [added, setAdded] = useState(false)

  const hasDiscount = product.originalPrice && product.originalPrice > product.price
  const discountPercent = hasDiscount
    ? Math.round(((product.originalPrice! - product.price) / product.originalPrice!) * 100)
    : 0

  const productImage = product.images?.[0] || PLACEHOLDER_IMAGE

  // Productos con tallas/colores: se elige la talla en la pagina del producto
  const needsOptions = Boolean(product.variants?.length)

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (needsOptions) {
      router.push(`/productos/${product.slug}`)
      return
    }
    addItem(product)
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  return (
    <Card className="group overflow-hidden border-black/[0.06] shadow-[0_1px_3px_rgb(0_0_0/0.06),0_6px_16px_rgb(0_0_0/0.06)] transition-all hover:shadow-[0_12px_28px_rgb(0_0_0/0.12)] dark:border-border dark:shadow-sm dark:hover:shadow-lg">
      <div className="relative aspect-square overflow-hidden bg-muted">
        {/* Badges */}
        <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
          {product.isNew && (
            <Badge className="bg-primary text-primary-foreground">Nuevo</Badge>
          )}
          {hasDiscount && (
            <Badge variant="destructive">-{discountPercent}%</Badge>
          )}
        </div>

        {/* Favorite Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 z-10 h-8 w-8 rounded-full bg-background/80 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Heart className="h-4 w-4" />
          <span className="sr-only">Agregar a favoritos</span>
        </Button>

        {/* Image */}
        <Link href={`/productos/${product.slug}`}>
          <div className="relative h-full w-full">
            <Image
              src={productImage}
              alt={product.name}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          </div>
        </Link>

        {/* Quick Add Button */}
        <div className="absolute bottom-2 left-2 right-2 z-20 pointer-events-none translate-y-full opacity-0 transition-all group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
          <Button
            className="w-full"
            size="sm"
            onClick={handleAddToCart}
            disabled={product.stock === 0}
            variant={added ? "secondary" : "default"}
          >
            {added ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Agregado
              </>
            ) : (
              <>
                <ShoppingCart className="mr-2 h-4 w-4" />
                {needsOptions ? "Elegir talla" : "Agregar"}
              </>
            )}
          </Button>
        </div>
      </div>

      <CardContent className="p-3 sm:p-4">
        {/* Brand */}
        <p className="text-xs text-muted-foreground">{product.brand}</p>

        {/* Name */}
        <Link href={`/productos/${product.slug}`}>
          <h3 className="mt-1 font-medium leading-tight line-clamp-2 hover:text-brand-link transition-colors">
            {product.name}
          </h3>
        </Link>

        {/* Rating */}
        <div className="mt-2 flex items-center gap-1">
          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
          <span className="text-sm font-medium">{product.rating}</span>
        </div>

        {/* Price */}
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-bold">
            <Price amount={product.price} />
          </span>
          {hasDiscount && (
            <span className="text-sm text-muted-foreground line-through">
              <Price amount={product.originalPrice!} />
            </span>
          )}
        </div>

        {/* Stock */}
        <p className="mt-1 text-xs text-muted-foreground">
          {product.stock > 0 ? (
            <span className="text-green-600 dark:text-green-400">
              {product.stock} disponibles
            </span>
          ) : (
            <span className="text-destructive">Agotado</span>
          )}
        </p>
      </CardContent>
    </Card>
  )
}
