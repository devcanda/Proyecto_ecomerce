"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, ShoppingCart } from "lucide-react"
import { Product } from "@/types"
import { useCartStore } from "@/stores/cart-store"
import { Price } from "@/components/ui/price"

interface HomeProductCardProps {
  product: Product
}

const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1629429408209-1f912961dbd8?w=600&h=600&fit=crop"

export function HomeProductCard({ product }: HomeProductCardProps) {
  const router = useRouter()
  const addItem = useCartStore((state) => state.addItem)
  const [added, setAdded] = useState(false)

  const outOfStock = product.stock === 0
  const productImage = product.images?.[0] || PLACEHOLDER_IMAGE

  const handleAddToCart = () => {
    addItem(product)
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  const handleBuyNow = () => {
    addItem(product)
    router.push("/cart")
  }

  return (
    <div className="group flex flex-col">
      <Link
        href={`/products/${product.slug}`}
        className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted"
      >
        <Image
          src={productImage}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </Link>

      <div className="mt-3 flex items-center justify-between gap-2 sm:mt-4">
        <span className="text-lg font-semibold sm:text-2xl"><Price amount={product.price} /></span>
        <span className="hidden rounded-full bg-muted px-3 py-1 text-[11px] capitalize text-muted-foreground sm:inline">
          {product.category}
        </span>
      </div>

      <Link href={`/products/${product.slug}`}>
        <h3 className="mt-1 text-sm font-medium transition-colors hover:text-brand-link sm:mt-2 sm:text-base">
          {product.name}
        </h3>
      </Link>
      <p className="mt-1 line-clamp-2 min-h-8 text-xs text-muted-foreground">
        {product.description}
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row sm:gap-3">
        {/* Al pasar el cursor el boton se ensancha para mostrar "Agregar al carrito" */}
        <button
          onClick={handleAddToCart}
          disabled={outOfStock}
          aria-label="Agregar al carrito"
          className="group/add inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-brand-blue/85 px-3 py-2.5 text-sm font-bold text-white lg:max-xl:text-xs transition-[flex-grow,background-color] duration-200 hover:bg-brand-blue enabled:hover:grow-[1.8] enabled:focus-visible:grow-[1.8] disabled:opacity-50"
        >
          {added ? <Check className="h-3.5 w-3.5 shrink-0" /> : <ShoppingCart className="h-3.5 w-3.5 shrink-0" />}
          {outOfStock ? (
            "Agotado"
          ) : added ? (
            "Agregado"
          ) : (
            <>
              <span className="group-hover/add:hidden group-focus-visible/add:hidden">Agregar</span>
              <span className="hidden group-hover/add:inline group-focus-visible/add:inline">
                Agregar al carrito
              </span>
            </>
          )}
        </button>
        <button
          onClick={handleBuyNow}
          disabled={outOfStock}
          className="min-w-0 flex-1 whitespace-nowrap rounded-md bg-brand/85 px-3 py-2.5 text-sm font-bold text-brand-foreground lg:max-xl:text-xs transition-colors hover:bg-brand-hover/85 disabled:opacity-50"
        >
          Comprar
        </button>
      </div>
    </div>
  )
}
