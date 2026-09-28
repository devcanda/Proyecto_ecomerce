"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Search, ShoppingCart, Heart, User, LogOut, Settings, Package, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { useCartStore } from "@/stores/cart-store"
import { cn } from "@/lib/utils"

export function Header() {
  const [mounted, setMounted] = useState(false)
  const [scrolled, setScrolled] = useState(false)
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
    "w-full pl-10 pr-4",
    transparent && "border-white/25 bg-white/10 text-white placeholder:text-white/60 dark:bg-white/10"
  )

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

          {/* Search Bar - Desktop */}
          <div className="hidden flex-1 max-w-xl md:flex">
            <div className="relative w-full">
              <Search
                className={cn(
                  "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2",
                  transparent ? "text-white/60" : "text-muted-foreground"
                )}
              />
              <Input
                type="search"
                placeholder="Buscar productos..."
                className={searchInputClass}
              />
            </div>
          </div>

          {/* Actions */}
          <div
            className={cn(
              "flex items-center gap-1",
              transparent && "[&_button:hover]:bg-white/15 [&_button:hover]:text-white"
            )}
          >
            {/* Search - Mobile */}
            <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden">
              <Search className="h-4 w-4" />
              <span className="sr-only">Buscar</span>
            </Button>

            {/* Products Link */}
            <Link href="/products" className="hidden md:block">
              <Button variant="ghost" size="sm" className="font-semibold">
                PRODUCTOS
              </Button>
            </Link>

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
                        className={cn(transparent && "bg-cream text-brand-dark hover:bg-white hover:text-brand-dark")}
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
          <div className="relative w-full">
            <Search
              className={cn(
                "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2",
                transparent ? "text-white/60" : "text-muted-foreground"
              )}
            />
            <Input
              type="search"
              placeholder="Buscar productos..."
              className={searchInputClass}
            />
          </div>
        </div>
      </div>
    </header>
  )
}
