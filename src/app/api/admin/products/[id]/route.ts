import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-guard"

type Params = Promise<{ id: string }>

// GET /api/admin/products/:id -> datos del producto para el formulario de edicion
export async function GET(_request: NextRequest, { params }: { params: Params }) {
  const denied = await requireAdmin()
  if (denied) return denied

  try {
    const { id } = await params
    const product = await prisma.product.findUnique({ where: { id } })

    if (!product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
    }

    return NextResponse.json({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description ?? "",
      price: Number(product.price),
      comparePrice: product.comparePrice ? Number(product.comparePrice) : undefined,
      stock: product.stock,
      images: product.images,
      isNew: product.isNew,
      isFeatured: product.isFeatured,
      categoryId: product.categoryId,
      brandId: product.brandId,
      modelId: product.modelId ?? undefined,
    })
  } catch (error) {
    console.error("Error fetching product for edit:", error)
    return NextResponse.json({ error: "Error fetching product" }, { status: 500 })
  }
}
