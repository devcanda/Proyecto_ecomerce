"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Search, ShoppingCart, Heart, User, LogOut, Settings, Package, ChevronDown, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "./ThemeToggle"
import { MobileNav } from "./MobileNav"
import { Logo } from "./Logo"
import { MainNav } from "./MainNav"
import { SearchBar } from "./SearchBar"
import { useCartStore } from "@/stores/cart-store"
import { cn } from "@/lib/utils"

export function Header() {
  const [mounted, setMounted] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  // Panel de busqueda para escritorio mediano (donde solo se ve el icono)
  const [searchOpen, setSearchOpen] = useState(false)
  const itemCount = useCartStore((state) => state.getItemCount())
  const { data: session, status } = useSession()
  const pathname = usePathname()

  // En el index el header va transparente sobre el slider hasta hacer scroll
  const isHome = pathname === "/"
  const transparent = isHome && !scrolled

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isHome) return
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [isHome])

  const searchInputClass = cn(
    transparent && "border-white/25 bg-white/10 text-white placeholder:text-white/60 dark:bg-white/10"
  )
  const searchIconClass = cn(transparent && "text-white/60 hover:text-white")

  return (
    <header
      className={cn(
        "top-0 z-50 w-full transition-colors duration-300",
        isHome ? "fixed inset-x-0" : "sticky",
        transparent
          ? "border-transparent bg-transparent text-white"
          : "border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      )}
    >
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center">
            <Logo
              variant={transparent ? "light" : "auto"}
              className="h-9 sm:h-11"
              priority
            />
          </Link>

          {/* Search Bar - Tablet (en escritorio su lugar lo ocupa el menu) */}
          <div className="hidden flex-1 max-w-xl md:flex lg:hidden">
            <SearchBar inputClassName={searchInputClass} iconClassName={searchIconClass} />
          </div>

          {/* Navigation - Desktop */}
          <div className="hidden flex-1 justify-center lg:flex">
            <MainNav transparent={transparent} />
          </div>

          {/* Actions */}
          <div
            className={cn(
              "flex items-center gap-1",
              transparent && "[&_button:hover]:bg-white/15 [&_button:hover]:text-white"
            )}
          >
            {/* Search - Escritorio mediano (icono que abre el panel) */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden h-9 w-9 lg:inline-flex xl:hidden"
              onClick={() => setSearchOpen((value) => !value)}
              aria-expanded={searchOpen}
            >
              {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
              <span className="sr-only">{searchOpen ? "Cerrar busqueda" : "Buscar"}</span>
            </Button>

            {/* Search - Escritorio grande (compacto) */}
            <SearchBar
              className="mr-1 hidden w-52 xl:block"
              inputClassName={cn(searchInputClass, "h-9")}
              iconClassName={searchIconClass}
              dropdownClassName="left-auto right-0 w-[26rem]"
            />

            <ThemeToggle />

            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Heart className="h-4 w-4" />
              <span className="sr-only">Favoritos</span>
            </Button>

            <Link href="/cart">
              <Button variant="ghost" size="icon" className="relative h-9 w-9">
                <ShoppingCart className="h-4 w-4" />
                {mounted && itemCount > 0 && (
                  <Badge
                    className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
                    variant="destructive"
                  >
                    {itemCount > 99 ? "99+" : itemCount}
                  </Badge>
                )}
                <span className="sr-only">Carrito</span>
              </Button>
            </Link>

            {/* Auth Section */}
            {mounted && status !== "loading" && (
              <>
                {session ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="hidden h-9 gap-1 px-2 sm:flex">
                        <User className="h-4 w-4" />
                        <span className="max-w-24 truncate text-sm">
                          {session.user?.name?.split(" ")[0]}
                        </span>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>
                        <div className="flex flex-col">
                          <span className="font-medium">{session.user?.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {session.user?.email}
                          </span>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/profile" className="cursor-pointer">
                          <User className="mr-2 h-4 w-4" />
                          Mi Perfil
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/profile/orders" className="cursor-pointer">
                          <Package className="mr-2 h-4 w-4" />
                          Mis Pedidos
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/profile/settings" className="cursor-pointer">
                          <Settings className="mr-2 h-4 w-4" />
                          Configuración
                        </Link>
                      </DropdownMenuItem>
                      {session.user?.role === "ADMIN" && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link href="/admin" className="cursor-pointer">
                              <Settings className="mr-2 h-4 w-4" />
                              Panel Admin
                            </Link>
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className="cursor-pointer text-destructive focus:text-destructive"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Cerrar Sesión
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <div className="hidden items-center gap-2 sm:flex">
                    <Link href="/login">
                      <Button variant="ghost" size="sm">
                        Ingresar
                      </Button>
                    </Link>
                    <Link href="/register">
                      <Button
                        size="sm"
                        className="font-semibold"
                      >
                        Registrarse
                      </Button>
                    </Link>
                  </div>
                )}
              </>
            )}

            {/* Mobile Menu */}
            <MobileNav />
          </div>
        </div>

        {/* Search Bar - Mobile */}
        <div className="pb-3 md:hidden">
          <SearchBar
            inputClassName={searchInputClass}
            iconClassName={searchIconClass}
            dropdownClassName="min-w-0"
          />
        </div>

        {/* Search Panel - Escritorio mediano */}
        {searchOpen && (
          <div
            className="hidden pb-4 lg:block xl:hidden"
            onKeyDown={(event) => event.key === "Escape" && setSearchOpen(false)}
          >
            <SearchBar
              className="mx-auto max-w-2xl"
              inputClassName={searchInputClass}
              iconClassName={searchIconClass}
              autoFocus
              onNavigate={() => setSearchOpen(false)}
            />
          </div>
        )}
      </div>
    </header>
  )
}
