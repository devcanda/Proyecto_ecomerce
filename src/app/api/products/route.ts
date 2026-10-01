import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { slugify } from "@/lib/slug"
import { productInclude, transformProduct } from "@/lib/transformers"
import { requireAdmin } from "@/lib/admin-guard"
import { parseGender, parseSizeType, parseVariants, syncVariants, totalVariantStock } from "@/lib/variants"
import { isGender } from "@/lib/category-type"
import { searchProducts } from "@/lib/search"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Query params
    const category = searchParams.get("category")
    const brand = searchParams.get("brand")
    const minPrice = searchParams.get("minPrice")
    const maxPrice = searchParams.get("maxPrice")
    const sortBy = searchParams.get("sortBy") || "newest"
    const featured = searchParams.get("featured")
    const isNew = searchParams.get("new")
    const limit = searchParams.get("limit")
    const offset = searchParams.get("offset")
    const search = searchParams.get("search")
    // gender=MEN,WOMEN -> Hombre y/o Mujer (los productos unisex aparecen en ambos)
    const genders = (searchParams.get("gender") ?? "").split(",").filter(isGender)

    // Build where clause
    const where: Record<string, unknown> = {
      isActive: true,
    }

    if (category) {
      where.category = { slug: category }
    }

    if (brand) {
      where.brand = { slug: brand }
    }

    if (minPrice || maxPrice) {
      where.price = {}
      if (minPrice) (where.price as Record<string, number>).gte = Number(minPrice)
      if (maxPrice) (where.price as Record<string, number>).lte = Number(maxPrice)
    }

    if (featured === "true") {
      where.isFeatured = true
    }

    if (genders.length) {
      const wanted = new Set(genders)
      if (genders.includes("MEN") || genders.includes("WOMEN")) wanted.add("UNISEX")
      where.gender = { in: [...wanted] }
    }

    if (isNew === "true") {
      where.isNew = true
    }

    // Busqueda tolerante a errores de escritura: se resuelve a una lista de ids con puntaje
    const term = search?.trim()
    const searchResult = term ? await searchProducts(term) : null
    if (searchResult) {
      where.id = { in: [...searchResult.scores.keys()] }
    }
    // Sin orden explicito, los resultados de busqueda se ordenan por relevancia
    const sortByRelevance = searchResult !== null && !searchParams.has("sortBy")

    // Build orderBy
    let orderBy: Record<string, string> = { createdAt: "desc" }
    switch (sortBy) {
      case "price-asc":
        orderBy = { price: "asc" }
        break
      case "price-desc":
        orderBy = { price: "desc" }
        break
      case "newest":
        orderBy = { createdAt: "desc" }
        break
      case "popular":
        orderBy = { stock: "desc" } // Placeholder - would use sales count
        break
    }

    const take = limit ? Number(limit) : undefined
    const skip = offset ? Number(offset) : 0

    let products = await prisma.product.findMany({
      where,
      orderBy,
      include: productInclude,
      // La paginacion por relevancia se aplica despues de ordenar por puntaje
      take: sortByRelevance ? undefined : take,
      skip: sortByRelevance ? undefined : skip,
    })

    if (sortByRelevance && searchResult) {
      const scores = searchResult.scores
      products = products
        .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0))
        .slice(skip, take !== undefined ? skip + take : undefined)
    }

    const total = await prisma.product.count({ where })

    return NextResponse.json({
      products: products.map(transformProduct),
      total,
      limit: limit ? Number(limit) : null,
      offset: skip,
      // true cuando solo hay coincidencias aproximadas (ej. "mnitor")
      approximate: searchResult?.approximate ?? false,
    })
  } catch (error) {
    console.error("Error fetching products:", error)
    return NextResponse.json({ error: "Error fetching products" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  try {
    const body = await request.json()
    const variants = parseVariants(body.variants)

    // Si no llega el slug se genera a partir del nombre
    const slug =
      typeof body.slug === "string" && body.slug.trim()
        ? body.slug.trim()
        : slugify(String(body.name ?? ""))

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: body.name,
          slug,
          description: body.description,
          price: body.price,
          comparePrice: body.comparePrice,
          // Con tallas/colores el stock del producto es la suma de sus variantes
          stock: variants.length ? totalVariantStock(variants) : body.stock || 0,
          images: body.images || [],
          specs: body.specs || {},
          isNew: body.isNew || false,
          isFeatured: body.isFeatured || false,
          categoryId: body.categoryId,
          brandId: body.brandId,
          modelId: body.modelId || null,
          sizeType: parseSizeType(body.sizeType, variants),
          gender: parseGender(body.gender),
        },
      })
      if (variants.length) await syncVariants(tx, created.id, variants)
      return tx.product.findUniqueOrThrow({
        where: { id: created.id },
        include: productInclude,
      })
    })

    return NextResponse.json(transformProduct(product), { status: 201 })
  } catch (error) {
    console.error("Error creating product:", error)
    return NextResponse.json({ error: "Error creating product" }, { status: 500 })
  }
}
