"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"

const promos = [
  {
    id: 1,
    text: "Audio Que Te Envuelve. Cómodo, Duradero Y Con Sonido Que Se Siente.",
    cta: "Ver Audífonos",
    href: "/productos?category=audifonos",
    image: "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=1600",
    // Zona de la foto que se mantiene visible al recortar (object-position)
    position: "50% 40%",
  },
  {
    id: 2,
    text: "Nuevos Lanzamientos. Teclados Icónicos Que Marcan La Diferencia.",
    cta: "Ver Teclados",
    href: "/productos?category=teclados",
    image: "https://images.unsplash.com/photo-1547394765-185e1e68f34e?w=1600",
    position: "50% 50%",
  },
]

// Celular: carrusel deslizable (cada tarjeta ocupa el 82% del ancho y se ve el borde de la siguiente)
// Tablet y PC: cuadricula (sin cambios)
const MOBILE_CARD = "w-[82%] shrink-0 snap-start aspect-[16/9] sm:w-auto sm:aspect-[8/5]"
const TOTAL_CARDS = promos.length + 1

export function PromoCards() {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  // Indice de la tarjeta visible segun la posicion del deslizamiento
  const handleScroll = () => {
    const el = scrollerRef.current
    if (!el) return
    const card = el.firstElementChild as HTMLElement | null
    if (!card) return
    const step = card.offsetWidth + parseFloat(getComputedStyle(el).columnGap || "0")
    setActive(Math.min(TOTAL_CARDS - 1, Math.round(el.scrollLeft / step)))
  }

  const goTo = (index: number) => {
    const card = scrollerRef.current?.children[index] as HTMLElement | undefined
    card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" })
  }

  return (
    <section className="container mx-auto px-4 pt-12 sm:pt-16 lg:pt-20">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 lg:grid-cols-3"
      >
        {promos.map((promo) => (
          <Link
            key={promo.id}
            href={promo.href}
            className={cn("group relative overflow-hidden rounded-2xl", MOBILE_CARD)}
          >
            <Image
              src={promo.image}
              alt=""
              fill
              sizes="(max-width: 640px) 82vw, (max-width: 1024px) 50vw, 33vw"
              style={{ objectPosition: promo.position }}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
              <p className="max-w-xs text-base font-semibold sm:text-lg leading-snug text-white">
                {promo.text}
              </p>
              <span className="mt-3 inline-flex rounded-lg bg-brand-dark px-4 py-2 text-sm font-medium text-white transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
                {promo.cta}
              </span>
            </div>
          </Link>
        ))}

        {/* Tarjeta destacada */}
        <Link
          href="/productos"
          // MOBILE_CARD va primero para que la proporcion ancha de tablet (16/5) tenga prioridad
          className={cn(MOBILE_CARD, "group relative overflow-hidden rounded-2xl sm:col-span-2 sm:aspect-[16/5] lg:col-span-1 lg:aspect-[8/5]")}
        >
          <Image
            src="https://images.unsplash.com/photo-1600861194942-f883de0dfe96?w=1600"
            alt=""
            fill
            sizes="(max-width: 640px) 82vw, (max-width: 1024px) 100vw, 33vw"
            // Mantiene visibles el monitor y el control en el bloque ancho de tablet
            style={{ objectPosition: "50% 70%" }}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <p className="font-jakarta text-3xl font-extrabold uppercase tracking-tight text-white xl:text-4xl">
              Setup Gamer
            </p>
            <span className="mt-3 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-medium text-brand-dark transition-colors group-hover:bg-brand">
              Ver Productos
            </span>
          </div>
        </Link>
      </div>

      {/* Indicadores del carrusel (solo celular) */}
      <div className="mt-4 flex justify-center gap-1.5 sm:hidden">
        {Array.from({ length: TOTAL_CARDS }).map((_, index) => (
          <button
            key={index}
            onClick={() => goTo(index)}
            aria-label={`Ver bloque ${index + 1}`}
            className={cn(
              "h-2 rounded-full transition-all",
              active === index ? "w-6 bg-brand" : "w-2 bg-muted-foreground/30"
            )}
          />
        ))}
      </div>
    </section>
  )
}
