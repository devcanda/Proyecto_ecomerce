import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-guard"
import { slugify } from "@/lib/slug"
import { transformCategory } from "@/lib/transformers"

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: { products: { where: { isActive: true } } },
        },
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json(categories.map(transformCategory))
  } catch (error) {
    console.error("Error fetching categories:", error)
    return NextResponse.json(
      { error: "Error fetching categories" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  try {
    const body = await request.json()
    const name = typeof body.name === "string" ? body.name.trim() : ""
    if (!name) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 })
    }

    const slug = typeof body.slug === "string" && body.slug.trim() ? slugify(body.slug) : slugify(name)
    const include = { _count: { select: { products: true } } }

    // Si ya existe (mismo slug) se devuelve la existente en lugar de duplicarla
    const existing = await prisma.category.findUnique({ where: { slug }, include })
    if (existing) {
      return NextResponse.json(transformCategory(existing))
    }

    const category = await prisma.category.create({
      data: { name, slug, icon: body.icon },
      include,
    })

    return NextResponse.json(transformCategory(category), { status: 201 })
  } catch (error) {
    console.error("Error creating category:", error)
    return NextResponse.json(
      { error: "Error creating category" },
      { status: 500 }
    )
  }
}
