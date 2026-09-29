"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import Autoplay from "embla-carousel-autoplay"
import { ArrowLeft, ArrowRight } from "lucide-react"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel"
import { cn } from "@/lib/utils"

const slides = [
  {
    id: 1,
    title: "Tecnología que eleva tu setup cada día",
    cta: "Comprar ahora",
    href: "/products",
    image: "https://images.unsplash.com/photo-1616588589676-62b3bd4ff6d2?w=1800",
  },
  {
    id: 2,
    title: "Juega sin límites con lo último en gaming",
    cta: "Ver componentes",
    href: "/products?category=componentes",
    image: "https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=1800",
  },
  {
    id: 3,
    title: "Monitores que transforman tu espacio",
    cta: "Ver monitores",
    href: "/products?category=monitores",
    image: "https://images.unsplash.com/photo-1587831990711-23ca6441447b?w=1800",
  },
]

export function HeroBanner() {
  const plugin = React.useRef(
    Autoplay({ delay: 6000, stopOnInteraction: true })
  )
  const [api, setApi] = React.useState<CarouselApi>()
  const [current, setCurrent] = React.useState(0)

  React.useEffect(() => {
    if (!api) return
    const onSelect = () => setCurrent(api.selectedScrollSnap())
    onSelect()
    api.on("select", onSelect)
    return () => {
      api.off("select", onSelect)
    }
  }, [api])

  return (
    <section>
      <Carousel
        setApi={setApi}
        plugins={[plugin.current]}
        opts={{ loop: true }}
        className="relative overflow-hidden"
      >
        <CarouselContent className="ml-0">
          {slides.map((slide) => (
            <CarouselItem key={slide.id} className="pl-0">
              <div className="relative h-[560px] sm:h-[620px] lg:h-[720px] xl:h-[780px]">
                <Image
                  src={slide.image}
                  alt=""
                  fill
                  priority={slide.id === 1}
                  sizes="100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent" />
                {/* Oscurece la parte superior para que el menu sea legible */}
                <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/50 to-transparent" />

                <div className="container relative z-10 mx-auto flex h-full flex-col justify-center px-4 pt-28 md:pt-16">
                  <h1 className="max-w-md text-balance font-jakarta text-4xl font-bold leading-[1.1] tracking-tight text-cream sm:max-w-lg sm:text-5xl lg:max-w-2xl lg:text-[3.5rem] xl:text-6xl">
                    {slide.title}
                  </h1>
                  <Link
                    href={slide.href}
                    className="mt-8 inline-flex w-fit items-center rounded-lg bg-brand/85 px-8 py-3.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-hover/85"
                  >
                    {slide.cta}
                  </Link>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>

        {/* Controles: puntos + flechas, alineados al margen del contenido */}
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 sm:bottom-10">
          <div className="container mx-auto flex justify-end px-4">
            <div className="pointer-events-auto flex items-center gap-3">
              <div className="flex gap-1.5">
                {slides.map((slide, index) => (
                  <button
                    key={slide.id}
                    onClick={() => api?.scrollTo(index)}
                    className={cn(
                      "h-2 rounded-full transition-all",
                      current === index ? "w-6 bg-white" : "w-2 bg-white/50"
                    )}
                    aria-label={`Ir al slide ${index + 1}`}
                  />
                ))}
              </div>
              <button
                onClick={() => api?.scrollPrev()}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-dark text-white transition-colors hover:bg-brand hover:text-brand-foreground"
                aria-label="Anterior"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => api?.scrollNext()}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-dark text-white transition-colors hover:bg-brand hover:text-brand-foreground"
                aria-label="Siguiente"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </Carousel>
    </section>
  )
}
