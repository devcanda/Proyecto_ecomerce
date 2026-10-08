import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireProductManager } from "@/lib/admin-guard"
import { slugify } from "@/lib/slug"

// GET /api/models?brandId=... -> modelos de una marca
export async function GET(request: NextRequest) {
  try {
    const brandId = request.nextUrl.searchParams.get("brandId")
    if (!brandId) {
      return NextResponse.json({ error: "brandId es requerido" }, { status: 400 })
    }

    const models = await prisma.productModel.findMany({
      where: { brandId },
      select: { id: true, name: true, slug: true, brandId: true },
      orderBy: { name: "asc" },
    })

    return NextResponse.json(models)
  } catch (error) {
    console.error("Error fetching models:", error)
    return NextResponse.json(
      { error: "Error fetching models" },
      { status: 500 }
    )
  }
}

// POST /api/models { name, brandId } -> crea el modelo (o devuelve el existente)
export async function POST(request: NextRequest) {
  const denied = await requireProductManager()
  if (denied) return denied

  try {
    const body = await request.json()
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const brandId = typeof body.brandId === "string" ? body.brandId : ""
    if (!name || !brandId) {
      return NextResponse.json(
        { error: "El nombre y la marca son requeridos" },
        { status: 400 }
      )
    }

    const slug = slugify(name)
    const select = { id: true, name: true, slug: true, brandId: true }

    const existing = await prisma.productModel.findUnique({
      where: { brandId_slug: { brandId, slug } },
      select,
    })
    if (existing) {
      return NextResponse.json(existing)
    }

    const model = await prisma.productModel.create({
      data: { name, slug, brandId },
      select,
    })

    return NextResponse.json(model, { status: 201 })
  } catch (error) {
    console.error("Error creating model:", error)
    return NextResponse.json(
      { error: "Error creating model" },
      { status: 500 }
    )
  }
}
