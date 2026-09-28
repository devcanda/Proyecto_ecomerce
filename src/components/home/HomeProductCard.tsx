"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check } from "lucide-react"
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

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-2xl font-semibold"><Price amount={product.price} /></span>
        <span className="rounded-full bg-muted px-3 py-1 text-[11px] capitalize text-muted-foreground">
          {product.category}
        </span>
      </div>

      <Link href={`/products/${product.slug}`}>
        <h3 className="mt-2 font-medium transition-colors hover:text-brand-link">
          {product.name}
        </h3>
      </Link>
      <p className="mt-1 line-clamp-2 min-h-8 text-xs text-muted-foreground">
        {product.description}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={handleAddToCart}
          disabled={outOfStock}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-brand-blue/10 px-4 py-2.5 text-xs font-semibold text-brand-link transition-colors hover:bg-brand-blue/20 disabled:opacity-50"
        >
          {added && <Check className="h-3.5 w-3.5" />}
          {outOfStock ? "Agotado" : added ? "Agregado" : "Agregar"}
        </button>
        <button
          onClick={handleBuyNow}
          disabled={outOfStock}
          className="rounded-md bg-brand px-4 py-2.5 text-xs font-semibold text-brand-foreground transition-colors hover:bg-brand-hover disabled:opacity-50"
        >
          Comprar
        </button>
      </div>
    </div>
  )
}
