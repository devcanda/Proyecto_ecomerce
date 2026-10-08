"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Search, UserPlus, MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useAdminStore } from "@/stores/admin-store"
import { Price } from "@/components/ui/price"

const statusConfig = {
  active: { label: "Activo", variant: "default" as const, className: "bg-green-600" },
  inactive: { label: "Inactivo", variant: "secondary" as const, className: "" },
  suspended: { label: "Suspendido", variant: "destructive" as const, className: "" },
}

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  editor: "Editor de productos",
  customer: "Cliente",
  moderator: "Moderador",
}

function UsersSkeleton() {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Pedidos</TableHead>
              <TableHead>Total Gastado</TableHead>
              <TableHead>Registro</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3, 4, 5].map((i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="mt-1 h-3 w-32" />
                    </div>
                  </div>
                </TableCell>
                <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export default function AdminUsersPage() {
  const { users, loading, fetchUsers } = useAdminStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [roleFilter, setRoleFilter] = useState("all")
  const { data: session } = useSession()
  const [deleteUser, setDeleteUser] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!deleteUser) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const response = await fetch(`/api/users/${deleteUser.id}`, { method: "DELETE" })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || "No se pudo eliminar el usuario")
      setDeleteUser(null)
      fetchUsers()
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "No se pudo eliminar el usuario")
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || user.status === statusFilter
    const matchesRole = roleFilter === "all" || user.role === roleFilter
    return matchesSearch && matchesStatus && matchesRole
  })

  const activeUsers = users.filter((u) => u.status === "active").length
  const adminUsers = users.filter((u) => u.role === "admin").length
  const totalSpent = users.reduce((sum, u) => sum + u.totalSpent, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuarios</h1>
          <p className="text-muted-foreground">
            Administra los usuarios y clientes de tu tienda
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/users/new">
            <UserPlus className="mr-2 h-4 w-4" />
            Nuevo Usuario
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Usuarios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{users.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Usuarios Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{activeUsers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Administradores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{adminUsers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Gastado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold"><Price amount={totalSpent} /></p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar usuarios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
            <SelectItem value="suspended">Suspendidos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="customer">Clientes</SelectItem>
            <SelectItem value="editor">Editores</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading && users.length === 0 ? (
        <UsersSkeleton />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Pedidos</TableHead>
                  <TableHead>Total Gastado</TableHead>
                  <TableHead>Registro</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No se encontraron usuarios
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const status = statusConfig[user.status as keyof typeof statusConfig] || statusConfig.active
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback>
                                {user.name.split(" ").map((n) => n[0]).join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{user.name}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={user.role === "admin" ? "default" : "outline"}
                            className={user.role === "editor" ? "border-brand-blue/40 bg-brand-blue/10 text-brand-link" : ""}
                          >
                            {roleLabels[user.role] || user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className={status.className}>
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.orders}</TableCell>
                        <TableCell><Price amount={user.totalSpent} /></TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString("es-CO")}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/users/${user.id}/edit`}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Editar
                                </Link>
                              </DropdownMenuItem>
                              {user.id !== session?.user?.id && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => {
                                      setDeleteError(null)
                                      setDeleteUser({ id: user.id, name: user.name })
                                    }}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Eliminar
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar usuario</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que quieres eliminar a <b>{deleteUser?.name}</b>? Esta acción no se puede deshacer. Si solo
              quieres impedir que entre, mejor edítalo y cambia su estado a Inactivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                handleDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
