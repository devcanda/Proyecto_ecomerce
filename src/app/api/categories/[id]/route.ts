import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireProductManager } from "@/lib/admin-guard"
import { transformCategory } from "@/lib/transformers"
import { isVariantType } from "@/lib/category-type"

type Params = Promise<{ id: string }>

// PATCH /api/categories/:id { variantType } -> cambia el tipo de tallas de la categoria
export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const denied = await requireProductManager()
  if (denied) return denied

  try {
    const { id } = await params
    const body = await request.json()

    if (!isVariantType(body.variantType)) {
      return NextResponse.json({ error: "Tipo de categoria no valido" }, { status: 400 })
    }

    const category = await prisma.category.update({
      where: { id },
      data: { variantType: body.variantType },
      include: { _count: { select: { products: true } } },
    })

    return NextResponse.json(transformCategory(category))
  } catch (error) {
    console.error("Error updating category:", error)
    return NextResponse.json({ error: "Error updating category" }, { status: 500 })
  }
}
