import { Monitor, Keyboard, Mouse, Headphones, HardDrive, Cpu } from "lucide-react"

export const mainNav = [
  { name: "Inicio", href: "/" },
  { name: "Productos", href: "/productos" },
  { name: "Nosotros", href: "/about" },
  { name: "Contacto", href: "/contact" },
]

export const categoryNav = [
  { name: "Computadoras", href: "/productos?category=computadoras", icon: Monitor },
  { name: "Monitores", href: "/productos?category=monitores", icon: Monitor },
  { name: "Teclados", href: "/productos?category=teclados", icon: Keyboard },
  { name: "Mouse", href: "/productos?category=mouse", icon: Mouse },
  { name: "Audifonos", href: "/productos?category=audifonos", icon: Headphones },
  { name: "Almacenamiento", href: "/productos?category=almacenamiento", icon: HardDrive },
  { name: "Componentes", href: "/productos?category=componentes", icon: Cpu },
]

export function isNavActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href)
}
