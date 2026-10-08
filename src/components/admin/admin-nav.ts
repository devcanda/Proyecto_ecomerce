"use client"

import { useSession } from "next-auth/react"
import { LayoutDashboard, Package, CreditCard, Users, Settings } from "lucide-react"

// Menu del panel. adminOnly = el editor de productos no lo ve
const navigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard, adminOnly: true },
  { name: "Productos", href: "/admin/products", icon: Package, adminOnly: false },
  { name: "Pagos", href: "/admin/payments", icon: CreditCard, adminOnly: true },
  { name: "Usuarios", href: "/admin/users", icon: Users, adminOnly: true },
  { name: "Configuracion", href: "/admin/settings", icon: Settings, adminOnly: true },
]

export function useAdminNav() {
  const { data: session } = useSession()
  const isEditor = session?.user?.role === "EDITOR"
  return {
    items: navigation.filter((item) => !isEditor || !item.adminOnly),
    badge: isEditor ? "Editor" : "Admin",
  }
}
