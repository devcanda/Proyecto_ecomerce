import Link from "next/link"
import Image from "next/image"
import { ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { SectionHeading } from "./SectionHeading"

interface TileProps {
  title: string
  cta: string
  href: string
  image: string
  className?: string
  sizes: string
  withArrow?: boolean
}

function Tile({ title, cta, href, image, className, sizes, withArrow }: TileProps) {
  return (
    <Link href={href} className={cn("group relative overflow-hidden rounded-2xl", className)}>
      <Image
        src={image}
        alt=""
        fill
        sizes={sizes}
        className="object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <div className="absolute bottom-0 left-0 p-5 sm:p-8">
        <p className="font-display text-3xl text-white sm:text-4xl">{title}</p>
        <span className="mt-3 inline-flex items-center gap-6 rounded-md bg-white px-4 py-2 text-xs font-medium text-brand-dark transition-colors group-hover:bg-cream">
          {cta}
          {withArrow && <ArrowUpRight className="h-4 w-4" />}
        </span>
      </div>
    </Link>
  )
}

export function RecommendedGrid() {
  return (
    <section className="container mx-auto px-4 pt-16 sm:pt-24">
      <SectionHeading
        title="Lo Más Recomendado Para Ti"
        subtitle="Explora nuestras categorías favoritas y encuentra el equipo ideal para trabajar, crear o jugar."
      />

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <Tile
          title="Zona Gamer"
          cta="Ver Productos"
          href="/products?category=componentes"
          image="https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200"
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="h-80 lg:row-span-2 lg:h-auto lg:min-h-[560px]"
        />
        <Tile
          title="Audífonos"
          cta="Ver Audífonos"
          href="/products?category=audifonos"
          image="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1000"
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="h-64 lg:h-[268px]"
        />
        <Tile
          title="Teclados"
          cta="Ver Teclados"
          href="/products?category=teclados"
          image="https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=1000"
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="h-64 lg:h-[268px]"
        />
        <Tile
          title="Tendencias"
          cta="Explorar Tienda"
          href="/products"
          image="https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=1800"
          sizes="100vw"
          withArrow
          className="h-72 sm:h-80 lg:col-span-2"
        />
      </div>
    </section>
  )
}
