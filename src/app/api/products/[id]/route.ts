import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { productInclude, transformProduct } from "@/lib/transformers"
import { parseGender, parseSizeType, parseVariants, syncVariants, totalVariantStock } from "@/lib/variants"
import { requireAdmin } from "@/lib/admin-guard"
import { slugify } from "@/lib/slug"

type Params = Promise<{ id: string }>

export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params

    // Try to find by slug first, then by id
    const product = await prisma.product.findFirst({
      where: {
        OR: [{ slug: id }, { id: id }],
        isActive: true,
      },
      include: productInclude,
    })

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    return NextResponse.json(transformProduct(product))
  } catch (error) {
    console.error("Error fetching product:", error)
    return NextResponse.json({ error: "Error fetching product" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  const denied = await requireAdmin()
  if (denied) return denied

  try {
    const { id } = await params
    const body = await request.json()
    // Solo se tocan las variantes si el formulario las envia
    const variants = body.variants === undefined ? null : parseVariants(body.variants)

    const product = await prisma.$transaction(async (tx) => {
      if (variants) await syncVariants(tx, id, variants)
      return tx.product.update({
        where: { id },
        data: {
          name: body.name,
          slug:
            typeof body.slug === "string" && body.slug.trim()
              ? body.slug.trim()
              : body.name
                ? slugify(String(body.name))
                : undefined,
          description: body.description,
          price: body.price,
          comparePrice: body.comparePrice,
          stock: variants?.length ? totalVariantStock(variants) : body.stock,
          images: body.images,
          specs: body.specs,
          isNew: body.isNew,
          isFeatured: body.isFeatured,
          isActive: body.isActive,
          categoryId: body.categoryId,
          brandId: body.brandId,
          // undefined = no cambia; null = quitar el modelo
          modelId: body.modelId === undefined ? undefined : body.modelId || null,
          sizeType: variants ? parseSizeType(body.sizeType, variants) : undefined,
          gender: body.gender === undefined ? undefined : parseGender(body.gender),
        },
        include: productInclude,
      })
    })

    return NextResponse.json(transformProduct(product))
  } catch (error) {
    console.error("Error updating product:", error)
    return NextResponse.json({ error: "Error updating product" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  const denied = await requireAdmin()
  if (denied) return denied

  try {
    const { id } = await params

    await prisma.product.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting product:", error)
    return NextResponse.json({ error: "Error deleting product" }, { status: 500 })
  }
}
