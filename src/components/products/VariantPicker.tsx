"use client"

import Image from "next/image"
import { ChevronRight, Ruler } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { ProductVariant, VariantType } from "@/types"
import { cn } from "@/lib/utils"
import { compareSizes } from "@/lib/category-type"

interface VariantPickerProps {
  variants: ProductVariant[]
  variantType?: VariantType
  brand: string
  sizeGuide?: string
  selectedSize?: string
  selectedColor?: string
  onSelectSize: (size: string) => void
  onSelectColor: (color: string) => void
  error?: string | null
}

const unique = (items: (string | undefined)[]) => [...new Set(items.filter((item): item is string => Boolean(item)))]

export function VariantPicker({
  variants,
  variantType,
  brand,
  sizeGuide,
  selectedSize,
  selectedColor,
  onSelectSize,
  onSelectColor,
  error,
}: VariantPickerProps) {
  // De menor a mayor, sin importar el orden en que se cargaron los colores
  const sizes = unique(variants.map((variant) => variant.size)).sort(compareSizes)
  const colors = unique(variants.map((variant) => variant.color))

  // Una talla/color esta agotada si ninguna combinacion posible tiene stock
  const sizeAvailable = (size: string) =>
    variants.some(
      (variant) =>
        variant.size === size && variant.stock > 0 && (!selectedColor || variant.color === selectedColor)
    )
  const colorAvailable = (color: string) =>
    variants.some(
      (variant) =>
        variant.color === color && variant.stock > 0 && (!selectedSize || variant.size === selectedSize)
    )

  const optionClass = (active: boolean, available: boolean) =>
    cn(
      "rounded-md border px-3 py-2 text-sm font-semibold transition-colors",
      active
        ? "border-foreground bg-foreground text-background"
        : available
          ? "border-neutral-300 bg-background hover:border-foreground dark:border-input"
          : "cursor-not-allowed border-neutral-200 bg-muted/50 text-muted-foreground/50 line-through dark:border-border"
    )

  return (
    <div className="space-y-5">
      {colors.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wider">
            Color{selectedColor && <span className="ml-1 font-normal normal-case text-muted-foreground">: {selectedColor}</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            {colors.map((color) => {
              const available = colorAvailable(color)
              const image = variants.find((variant) => variant.color === color && variant.images?.length)?.images?.[0]
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => onSelectColor(color)}
                  disabled={!available}
                  aria-pressed={selectedColor === color}
                  className={cn(optionClass(selectedColor === color, available), image && "flex items-center gap-2 py-1.5 pl-1.5")}
                >
                  {image && (
                    <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-muted">
                      <Image src={image} alt="" fill sizes="32px" className="object-cover" />
                    </span>
                  )}
                  {color}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {sizes.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider">
              Talla{variantType === "FOOTWEAR" && <span className="ml-1 font-normal normal-case text-muted-foreground">(COL)</span>}
            </p>
            {sizeGuide && (
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:text-brand-link hover:underline"
                  >
                    <Ruler className="h-4 w-4" />
                    Guía de tallas
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                  <DialogTitle>Guía de tallas {brand}</DialogTitle>
                  <DialogDescription>
                    Usa la guía para encontrar tu talla. Es una aproximación: lo mejor es elegir la que ya usas en
                    otro calzado.
                  </DialogDescription>
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-white">
                    <Image
                      src={sizeGuide}
                      alt={`Guia de tallas ${brand}`}
                      fill
                      className="object-contain"
                      sizes="(max-width: 768px) 100vw, 768px"
                    />
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {sizes.map((size) => {
              const available = sizeAvailable(size)
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => onSelectSize(size)}
                  disabled={!available}
                  aria-pressed={selectedSize === size}
                  className={cn("min-w-14", optionClass(selectedSize === size, available))}
                >
                  {size}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  )
}
