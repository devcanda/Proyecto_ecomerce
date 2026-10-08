import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireProductManager } from "@/lib/admin-guard"
import { transformBrand } from "@/lib/transformers"

type Params = Promise<{ id: string }>

// PATCH /api/brands/:id { sizeGuide } -> guarda (o quita con null) la guia de tallas de la marca
export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const denied = await requireProductManager()
  if (denied) return denied

  try {
    const { id } = await params
    const body = await request.json()

    if (body.sizeGuide !== null && typeof body.sizeGuide !== "string") {
      return NextResponse.json({ error: "Guia de tallas no valida" }, { status: 400 })
    }

    const brand = await prisma.brand.update({
      where: { id },
      data: { sizeGuide: body.sizeGuide || null },
      include: { _count: { select: { products: true } } },
    })

    return NextResponse.json(transformBrand(brand))
  } catch (error) {
    console.error("Error updating brand:", error)
    return NextResponse.json({ error: "Error updating brand" }, { status: 500 })
  }
}
