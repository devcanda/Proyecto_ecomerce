import { NextResponse } from "next/server"
import { requireProductManager } from "@/lib/admin-guard"
import { listPhotoTargets } from "@/lib/product-photos"

// GET /api/admin/photos -> productos con sus fotos actuales (para la carga masiva de fotos)
export async function GET() {
  const denied = await requireProductManager()
  if (denied) return denied

  try {
    return NextResponse.json(await listPhotoTargets())
  } catch (error) {
    console.error("Error listing photo targets:", error)
    return NextResponse.json({ error: "No se pudieron cargar los productos" }, { status: 500 })
  }
}
