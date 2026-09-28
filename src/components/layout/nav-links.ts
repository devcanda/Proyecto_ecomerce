import { Monitor, Keyboard, Mouse, Headphones, HardDrive, Cpu } from "lucide-react"

export const mainNav = [
  { name: "Inicio", href: "/" },
  { name: "Productos", href: "/products" },
  { name: "Nosotros", href: "/about" },
  { name: "Contacto", href: "/contact" },
]

export const categoryNav = [
  { name: "Computadoras", href: "/products?category=computadoras", icon: Monitor },
  { name: "Monitores", href: "/products?category=monitores", icon: Monitor },
  { name: "Teclados", href: "/products?category=teclados", icon: Keyboard },
  { name: "Mouse", href: "/products?category=mouse", icon: Mouse },
  { name: "Audifonos", href: "/products?category=audifonos", icon: Headphones },
  { name: "Almacenamiento", href: "/products?category=almacenamiento", icon: HardDrive },
  { name: "Componentes", href: "/products?category=componentes", icon: Cpu },
]

export function isNavActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href)
}
