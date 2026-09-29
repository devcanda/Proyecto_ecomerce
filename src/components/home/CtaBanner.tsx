import Link from "next/link"
import Image from "next/image"

export function CtaBanner() {
  return (
    <section className="container mx-auto px-4 py-16 sm:py-24">
      <div className="relative overflow-hidden rounded-2xl">
        <Image
          src="https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=1800"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative flex flex-col items-center px-6 py-20 text-center sm:py-28">
          <h2 className="max-w-3xl font-display text-3xl leading-tight text-white sm:text-5xl">
            Arma El Setup De Tus Sueños Con Tecnología Que Te Acompaña.
          </h2>
          <Link
            href="/products"
            className="mt-8 rounded-md bg-brand/85 px-6 py-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-hover/85"
          >
            Comprar Ahora
          </Link>
        </div>
      </div>
    </section>
  )
}
