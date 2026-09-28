import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"
import { Product } from "@/types"
import { HomeProductCard } from "./HomeProductCard"
import { SectionHeading } from "./SectionHeading"

interface ProductShowcaseProps {
  title: string
  subtitle: string
  products: Product[]
  moreHref: string
  titleFont?: "display" | "jakarta"
}

const PER_ROW = 4
const MAX_ROWS = 2

export function ProductShowcase({ title, subtitle, products, moreHref, titleFont }: ProductShowcaseProps) {
  // Solo filas completas de 4 (maximo 2 filas) para que la cuadricula no quede descuadrada
  const fullRows = Math.min(Math.floor(products.length / PER_ROW), MAX_ROWS)
  const visibleProducts =
    fullRows > 0 ? products.slice(0, fullRows * PER_ROW) : products

  return (
    <section className="container mx-auto px-4 pt-16 sm:pt-24">
      <SectionHeading title={title} subtitle={subtitle} font={titleFont} />

      <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {products.length === 0
          ? Array.from({ length: PER_ROW * MAX_ROWS }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[4/3] rounded-2xl" />
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))
          : visibleProducts.map((product) => (
              <HomeProductCard key={product.id} product={product} />
            ))}
      </div>

      <div className="mt-12 flex justify-center">
        <Link
          href={moreHref}
          className="rounded-md border border-brand/30 bg-brand/10 px-6 py-2.5 text-sm font-medium transition-colors hover:bg-brand/20"
        >
          Ver Más Productos
        </Link>
      </div>
    </section>
  )
}
