import Link from "next/link"
import Image from "next/image"
import { NewsletterForm } from "./NewsletterForm"
import { Logo } from "./Logo"

const footerLinks = {
  categorias: [
    { name: "Computadoras", href: "/products?category=computadoras" },
    { name: "Monitores", href: "/products?category=monitores" },
    { name: "Teclados", href: "/products?category=teclados" },
    { name: "Mouse", href: "/products?category=mouse" },
    { name: "Audifonos", href: "/products?category=audifonos" },
    { name: "Componentes", href: "/products?category=componentes" },
  ],
  legal: [
    { name: "Politica de Privacidad", href: "/privacy" },
    { name: "Terminos y Condiciones", href: "/terms" },
    { name: "Devoluciones", href: "/returns" },
    { name: "Cookies", href: "/cookies" },
  ],
  ayuda: [
    { name: "Centro de Ayuda", href: "/help" },
    { name: "Envios y Entregas", href: "/shipping" },
    { name: "Garantia", href: "/warranty" },
    { name: "Preguntas Frecuentes", href: "/faq" },
    { name: "Contacto", href: "/contact" },
  ],
}

const socialLinks = [
  { name: "Facebook", href: "#" },
  { name: "Instagram", href: "#" },
  { name: "Twitter", href: "#" },
  { name: "YouTube", href: "#" },
]

function FooterColumn({ title, links }: { title: string; links: { name: string; href: string }[] }) {
  return (
    <div>
      <h3 className="font-display text-lg text-white">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.name}>
            <Link href={link.href} className="text-sm text-white/60 transition-colors hover:text-white">
              {link.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-brand-dark text-white">
      {/* Marca decorativa */}
      <Image
        src="/logo-icon.png"
        alt=""
        aria-hidden
        width={100}
        height={100}
        className="pointer-events-none absolute -bottom-12 -right-10 h-72 w-72 select-none opacity-[0.05] brightness-0 invert sm:h-96 sm:w-96"
      />

      <div className="container relative mx-auto px-4 pt-16 pb-8">
        <div className="grid gap-10 sm:grid-cols-3 lg:grid-cols-[1.6fr_repeat(3,auto)] lg:gap-x-16">
          <div className="sm:col-span-3 lg:col-span-1">
            <Link href="/" className="inline-flex">
              <Logo variant="light" className="h-14" />
            </Link>
            <p className="mt-4 max-w-sm text-sm text-white/60">
              Tu tienda de tecnologia de confianza. Los mejores productos de computacion a los mejores precios, con envio a todo Peru.
            </p>

            <p className="mt-8 font-display text-lg">Suscribete a nuestro boletin</p>
            <NewsletterForm />
          </div>

          <FooterColumn title="Categorias" links={footerLinks.categorias} />
          <FooterColumn title="Legal" links={footerLinks.legal} />
          <FooterColumn title="Ayuda" links={footerLinks.ayuda} />
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
          <p className="text-xs text-white/50">
            &copy; {new Date().getFullYear()} Compra En Linea. Todos los derechos reservados.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {socialLinks.map((social) => (
              <Link
                key={social.name}
                href={social.href}
                className="rounded-full bg-white/10 px-4 py-1.5 font-display text-sm text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              >
                {social.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
