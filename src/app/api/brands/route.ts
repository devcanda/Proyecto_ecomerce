import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireProductManager } from "@/lib/admin-guard"
import { slugify } from "@/lib/slug"
import { transformBrand } from "@/lib/transformers"

export async function GET() {
  try {
    const brands = await prisma.brand.findMany({
      include: {
        _count: {
          select: { products: { where: { isActive: true } } },
        },
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json(brands.map(transformBrand))
  } catch (error) {
    console.error("Error fetching brands:", error)
    return NextResponse.json(
      { error: "Error fetching brands" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireProductManager()
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
    const existing = await prisma.brand.findUnique({ where: { slug }, include })
    if (existing) {
      return NextResponse.json(transformBrand(existing))
    }

    const brand = await prisma.brand.create({
      data: { name, slug, logo: body.logo },
      include,
    })

    return NextResponse.json(transformBrand(brand), { status: 201 })
  } catch (error) {
    console.error("Error creating brand:", error)
    return NextResponse.json(
      { error: "Error creating brand" },
      { status: 500 }
    )
  }
}
