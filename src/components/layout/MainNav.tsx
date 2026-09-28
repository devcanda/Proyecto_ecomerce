"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { mainNav, categoryNav, isNavActive } from "./nav-links"

interface MainNavProps {
  // true cuando el header va transparente sobre el slider del index
  transparent?: boolean
}

export function MainNav({ transparent }: MainNavProps) {
  const pathname = usePathname()

  const linkClass = (active: boolean) =>
    cn(
      "relative inline-flex items-center gap-1 px-3 py-2 text-[13px] font-semibold uppercase tracking-wide transition-colors",
      "after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:rounded-full after:transition-transform after:origin-left",
      "after:bg-brand",
      active
        ? cn("after:scale-x-100", transparent ? "text-white" : "text-foreground")
        : cn(
            "after:scale-x-0 hover:after:scale-x-100",
            transparent ? "text-white/80 hover:text-white" : "text-muted-foreground hover:text-foreground"
          )
    )

  const [inicio, productos, ...rest] = mainNav

  return (
    <nav className="hidden items-center lg:flex">
      {[inicio, productos].map((item) => (
        <Link key={item.href} href={item.href} className={linkClass(isNavActive(pathname, item.href))}>
          {item.name}
        </Link>
      ))}

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger className={cn(linkClass(false), "outline-none data-[state=open]:after:scale-x-100")}>
          Categorias
          <ChevronDown className="h-3.5 w-3.5 transition-transform [[data-state=open]>&]:rotate-180" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-56">
          {categoryNav.map((category) => (
            <DropdownMenuItem key={category.href} asChild>
              <Link href={category.href} className="cursor-pointer">
                <category.icon className="mr-2 h-4 w-4" />
                {category.name}
              </Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/products" className="cursor-pointer font-medium">
              Ver todos los productos
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {rest.map((item) => (
        <Link key={item.href} href={item.href} className={linkClass(isNavActive(pathname, item.href))}>
          {item.name}
        </Link>
      ))}
    </nav>
  )
}
