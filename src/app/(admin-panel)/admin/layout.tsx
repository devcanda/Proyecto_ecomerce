import { AdminSidebar } from "@/components/admin/AdminSidebar"
import { AdminMobileNav } from "@/components/admin/AdminMobileNav"
import { Logo } from "@/components/layout/Logo"
import { ThemeToggle } from "@/components/layout/ThemeToggle"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-muted/30">
      <AdminSidebar />
      <div className="lg:pl-64">
        {/* Barra superior - celular y tablet (en escritorio el menu y el tema estan en la barra lateral) */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b bg-background px-2 lg:hidden">
          <AdminMobileNav />
          <Logo className="h-8" />
          <ThemeToggle />
        </header>
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
