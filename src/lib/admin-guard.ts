import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { canManageProducts } from "@/lib/roles"

// Devuelve una respuesta de error si quien llama no es administrador; null si puede continuar
export async function requireAdmin() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  return null
}

// Administradores y editores de productos (crear/editar productos, fotos, categorias, marcas)
export async function requireProductManager() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }
  if (!canManageProducts(session.user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  return null
}
