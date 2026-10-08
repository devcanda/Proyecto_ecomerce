import { NextRequest, NextResponse } from "next/server"
import { requireProductManager } from "@/lib/admin-guard"
import { findProductPhotos } from "@/lib/ai/photo-finder"
import { getAiConfig, isAiReady, isSearchReady } from "@/lib/ai/settings"
import { getPhotoTarget } from "@/lib/product-photos"

// La busqueda y revision de fotos puede tardar (una consulta a la IA por color)
export const maxDuration = 300

// POST /api/admin/ai/find-photos { productId, colors? } -> fotos sugeridas por la IA (no guarda nada)
export async function POST(request: NextRequest) {
  const denied = await requireProductManager()
  if (denied) return denied

  const body = await request.json().catch(() => ({}))
  if (typeof body.productId !== "string") return NextResponse.json({ error: "Falta el producto" }, { status: 400 })

  const config = await getAiConfig()
  if (!isAiReady(config) || !isSearchReady(config)) {
    return NextResponse.json({ error: "La IA o el buscador de imágenes no están configurados." }, { status: 400 })
  }
  const target = await getPhotoTarget(body.productId)
  if (!target) return NextResponse.json({ error: "El producto ya no existe" }, { status: 404 })

  const colors = Array.isArray(body.colors) ? body.colors.filter((color: unknown): color is string => typeof color === "string") : undefined
  return NextResponse.json({ productId: target.id, groups: await findProductPhotos(config, target, colors) })
}
