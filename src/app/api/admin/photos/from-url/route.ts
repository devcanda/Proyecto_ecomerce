import { NextRequest, NextResponse } from "next/server"
import { requireProductManager } from "@/lib/admin-guard"
import { ImageError, storeImageFromUrl } from "@/lib/image-store"

// POST /api/admin/photos/from-url { url } -> descarga la foto y la guarda en la tienda
export async function POST(request: NextRequest) {
  const denied = await requireProductManager()
  if (denied) return denied

  try {
    const body = await request.json().catch(() => ({}))
    if (typeof body.url !== "string" || !body.url.trim()) {
      return NextResponse.json({ error: "Falta el enlace de la foto" }, { status: 400 })
    }
    return NextResponse.json(await storeImageFromUrl(body.url))
  } catch (error) {
    if (error instanceof ImageError) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error("Error downloading image:", error)
    return NextResponse.json({ error: "No se pudo descargar la foto" }, { status: 500 })
  }
}
