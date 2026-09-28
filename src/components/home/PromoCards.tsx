import Link from "next/link"
import Image from "next/image"

const promos = [
  {
    id: 1,
    text: "Audio Que Te Envuelve. Cómodo, Duradero Y Con Sonido Que Se Siente.",
    cta: "Ver Audífonos",
    href: "/products?category=audifonos",
    image: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=800",
  },
  {
    id: 2,
    text: "Nuevos Lanzamientos. Teclados Icónicos Que Marcan La Diferencia.",
    cta: "Ver Teclados",
    href: "/products?category=teclados",
    image: "https://images.unsplash.com/photo-1547394765-185e1e68f34e?w=800",
  },
]

export function PromoCards() {
  return (
    <section className="container mx-auto px-4 pt-12 sm:pt-16 lg:pt-20">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-6">
        {promos.map((promo) => (
          <Link
            key={promo.id}
            href={promo.href}
            className="group relative aspect-[4/5] overflow-hidden rounded-2xl"
          >
            <Image
              src={promo.image}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-7">
              <p className="max-w-xs text-xl font-semibold leading-snug text-white">
                {promo.text}
              </p>
              <span className="mt-6 inline-flex rounded-lg bg-brand-dark px-5 py-3 text-sm font-medium text-white transition-colors group-hover:bg-brand">
                {promo.cta}
              </span>
            </div>
          </Link>
        ))}

        {/* Tarjeta destacada */}
        <Link
          href="/products"
          className="group relative aspect-[4/5] overflow-hidden rounded-2xl sm:col-span-2 sm:aspect-[8/5] lg:col-span-1 lg:aspect-[4/5]"
        >
          <Image
            src="https://images.unsplash.com/photo-1600861194942-f883de0dfe96?w=800"
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <p className="font-display text-4xl uppercase tracking-wide text-white xl:text-5xl">
              Setup Gamer
            </p>
            <span className="mt-5 inline-flex rounded-lg bg-white px-5 py-3 text-sm font-medium text-brand-dark transition-colors group-hover:bg-cream">
              Ver Productos
            </span>
          </div>
        </Link>
      </div>
    </section>
  )
}
