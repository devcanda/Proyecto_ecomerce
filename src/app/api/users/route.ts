import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-guard"
import { isAssignableRole, MIN_PASSWORD_LENGTH, normalizeEmail } from "@/lib/roles"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// GET /api/users -> lista de usuarios (solo administradores)
export async function GET(request: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  try {
    const { searchParams } = new URL(request.url)
    const role = searchParams.get("role")
    const status = searchParams.get("status")

    const where: Record<string, unknown> = {}

    if (role) {
      where.role = role.toUpperCase()
    }

    if (status) {
      where.status = status.toUpperCase()
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        status: true,
        createdAt: true,
        _count: {
          select: { orders: true },
        },
        orders: {
          select: {
            total: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    const transformedUsers = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role.toLowerCase(),
      status: user.status.toLowerCase(),
      createdAt: user.createdAt.toISOString(),
      orders: user._count.orders,
      totalSpent: user.orders.reduce((sum, order) => sum + Number(order.total), 0),
    }))

    return NextResponse.json(transformedUsers)
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json(
      { error: "Error fetching users" },
      { status: 500 }
    )
  }
}

// POST /api/users -> crea un usuario desde el panel (solo administradores)
export async function POST(request: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  try {
    const body = await request.json()
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : ""
    const password = typeof body.password === "string" ? body.password : ""
    const role = typeof body.role === "string" ? body.role.toUpperCase() : "CUSTOMER"

    if (!name) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 })
    if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ error: "El correo no es válido" }, { status: 400 })
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` },
        { status: 400 }
      )
    }
    if (!isAssignableRole(role)) return NextResponse.json({ error: "Rol no válido" }, { status: 400 })

    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      return NextResponse.json({ error: "Ya existe un usuario con ese correo" }, { status: 409 })
    }

    const user = await prisma.user.create({
      data: {
        email,
        // La contraseña se guarda cifrada (el inicio de sesion compara contra este cifrado)
        password: await bcrypt.hash(password, 10),
        name,
        phone: typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null,
        role,
        status: "ACTIVE",
      },
    })

    return NextResponse.json(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.toLowerCase(),
        status: user.status.toLowerCase(),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating user:", error)
    return NextResponse.json(
      { error: "Error creating user" },
      { status: 500 }
    )
  }
}
