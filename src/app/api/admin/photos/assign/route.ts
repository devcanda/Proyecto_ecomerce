import { NextRequest, NextResponse } from "next/server"
import { requireProductManager } from "@/lib/admin-guard"
import { assignPhotos, PhotoAssignError } from "@/lib/product-photos"

// POST /api/admin/photos/assign { productId, color?, urls[], mode: "append" | "replace" }
export async function POST(request: NextRequest) {
  const denied = await requireProductManager()
  if (denied) return denied

  try {
    const body = await request.json().catch(() => ({}))
    if (typeof body.productId !== "string" || !Array.isArray(body.urls)) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 })
    }
    const result = await assignPhotos({
      productId: body.productId,
      color: typeof body.color === "string" ? body.color : null,
      urls: body.urls,
      mode: body.mode === "replace" ? "replace" : "append",
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof PhotoAssignError) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error("Error assigning photos:", error)
    return NextResponse.json({ error: "No se pudieron guardar las fotos" }, { status: 500 })
  }
}
