"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Store } from "lucide-react"
import { useAdminNav } from "./admin-nav"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/layout/Logo"
import { ThemeToggle } from "@/components/layout/ThemeToggle"


export function AdminSidebar() {
  const pathname = usePathname()
  const { items, badge } = useAdminNav()

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b px-6">
        <Logo className="h-9" />
        <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {badge}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {items.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Back to Store y modo claro/oscuro */}
      <div className="flex items-center gap-2 border-t p-4">
        <Button asChild variant="outline" className="flex-1 justify-start">
          <Link href="/">
            <Store className="mr-2 h-4 w-4" />
            Volver a la Tienda
          </Link>
        </Button>
        <ThemeToggle />
      </div>
    </aside>
  )
}
