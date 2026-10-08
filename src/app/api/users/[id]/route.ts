import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { isAssignableRole, isUserStatus, MIN_PASSWORD_LENGTH, normalizeEmail } from "@/lib/roles"

type Params = Promise<{ id: string }>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Solo administradores. Devuelve el id del administrador que hace la peticion.
async function adminId() {
  const session = await auth()
  if (!session?.user) return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) }
  if (session.user.role !== "ADMIN") return { error: NextResponse.json({ error: "No autorizado" }, { status: 403 }) }
  return { id: session.user.id as string }
}

// Cuantos administradores activos quedarian si se quita/desactiva este
const otherActiveAdmins = (id: string) =>
  prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE", id: { not: id } } })

// GET /api/users/:id -> datos para editar
export async function GET(_request: NextRequest, { params }: { params: Params }) {
  const me = await adminId()
  if (me.error) return me.error

  const { id } = await params
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, phone: true, role: true, status: true, createdAt: true, _count: { select: { orders: true } } },
  })
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? "",
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    orders: user._count.orders,
    isSelf: user.id === me.id,
  })
}

// PATCH /api/users/:id -> edita datos, rol, estado y (opcional) contraseña
export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const me = await adminId()
  if (me.error) return me.error

  try {
    const { id } = await params
    const current = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, status: true } })
    if (!current) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })

    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.name !== undefined) {
      const name = String(body.name).trim()
      if (!name) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 })
      data.name = name
    }
    if (body.email !== undefined) {
      const email = normalizeEmail(String(body.email))
      if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ error: "El correo no es válido" }, { status: 400 })
      const taken = await prisma.user.findFirst({ where: { email, id: { not: id } }, select: { id: true } })
      if (taken) return NextResponse.json({ error: "Ya existe otro usuario con ese correo" }, { status: 409 })
      data.email = email
    }
    if (body.phone !== undefined) data.phone = String(body.phone).trim() || null

    const role = body.role !== undefined ? String(body.role).toUpperCase() : current.role
    const status = body.status !== undefined ? String(body.status).toUpperCase() : current.status
    if (body.role !== undefined && !isAssignableRole(role)) {
      return NextResponse.json({ error: "Rol no válido" }, { status: 400 })
    }
    if (body.status !== undefined && !isUserStatus(status)) {
      return NextResponse.json({ error: "Estado no válido" }, { status: 400 })
    }

    // Protecciones: no quedarse sin administradores ni sacarse a uno mismo del panel
    const losesAdmin = current.role === "ADMIN" && current.status === "ACTIVE" && (role !== "ADMIN" || status !== "ACTIVE")
    if (losesAdmin && id === me.id) {
      return NextResponse.json(
        { error: "No puedes quitarte el rol de administrador ni desactivar tu propia cuenta" },
        { status: 400 }
      )
    }
    if (losesAdmin && (await otherActiveAdmins(id)) === 0) {
      return NextResponse.json({ error: "Debe quedar al menos un administrador activo" }, { status: 400 })
    }
    data.role = role
    data.status = status

    if (body.password) {
      const password = String(body.password)
      if (password.length < MIN_PASSWORD_LENGTH) {
        return NextResponse.json(
          { error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` },
          { status: 400 }
        )
      }
      data.password = await bcrypt.hash(password, 10)
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, status: true },
    })
    return NextResponse.json(user)
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json({ error: "No se pudo actualizar el usuario" }, { status: 500 })
  }
}

// DELETE /api/users/:id
export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  const me = await adminId()
  if (me.error) return me.error

  try {
    const { id } = await params
    if (id === me.id) {
      return NextResponse.json({ error: "No puedes eliminar tu propia cuenta" }, { status: 400 })
    }
    const user = await prisma.user.findUnique({
      where: { id },
      select: { role: true, status: true, _count: { select: { orders: true } } },
    })
    if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })

    if (user.role === "ADMIN" && user.status === "ACTIVE" && (await otherActiveAdmins(id)) === 0) {
      return NextResponse.json({ error: "Debe quedar al menos un administrador activo" }, { status: 400 })
    }
    // Los pedidos guardan quien compro: un usuario con pedidos se desactiva en lugar de borrarse
    if (user._count.orders > 0) {
      return NextResponse.json(
        {
          error: `Este usuario tiene ${user._count.orders} ${user._count.orders === 1 ? "pedido" : "pedidos"}. Para conservar el historial, desactívalo en lugar de eliminarlo.`,
        },
        { status: 409 }
      )
    }

    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting user:", error)
    return NextResponse.json({ error: "No se pudo eliminar el usuario" }, { status: 500 })
  }
}
