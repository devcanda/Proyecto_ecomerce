"use client"

import { useState, useSyncExternalStore } from "react"
import Image from "next/image"
import Link from "next/link"
import { ShoppingBag, ShoppingCart } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Price } from "@/components/ui/price"
import { useCartStore } from "@/stores/cart-store"

const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1629429408209-1f912961dbd8?w=100&h=100&fit=crop"

export function CartPopover() {
  const [open, setOpen] = useState(false)
  const items = useCartStore((state) => state.items)
  const itemCount = useCartStore((state) => state.getItemCount())
  const subtotal = useCartStore((state) => state.getSubtotal())

  // El carrito se guarda en localStorage: el contador solo se muestra en el cliente
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  const close = () => setOpen(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <ShoppingCart className="h-4 w-4" />
          {mounted && itemCount > 0 && (
            <Badge
              className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
              variant="destructive"
            >
              {itemCount > 99 ? "99+" : itemCount}
            </Badge>
          )}
          <span className="sr-only">Carrito</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-[calc(100vw-2rem)] max-w-sm p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-semibold">Tu carrito</p>
          {itemCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {itemCount} {itemCount === 1 ? "producto" : "productos"}
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
            <ShoppingBag className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Tu carrito esta vacio</p>
            <Button asChild size="sm" variant="outline">
              <Link href="/products" onClick={close}>
                Ver productos
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <ul className="max-h-80 divide-y overflow-y-auto">
              {items.map(({ product, quantity }) => (
                <li key={product.id}>
                  <Link
                    href={`/products/${product.slug}`}
                    onClick={close}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent"
                  >
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                      <Image
                        src={product.images?.[0] || PLACEHOLDER_IMAGE}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Cantidad: {quantity}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">
                      <Price amount={product.price * quantity} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="space-y-3 border-t px-4 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-bold">
                  <Price amount={subtotal} />
                </span>
              </div>
              <Button asChild className="w-full font-bold">
                <Link href="/cart" onClick={close}>
                  Ir al carrito
                </Link>
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
