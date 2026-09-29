import { NextRequest, NextResponse } from "next/server"
import { readLocalImage } from "@/lib/local-storage"

const CONTENT_TYPES: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
}

// GET /uploads/products/archivo.webp -> imagen guardada en el servidor
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const relativePath = path.join("/")
  const extension = relativePath.split(".").pop()?.toLowerCase() ?? ""
  const contentType = CONTENT_TYPES[extension]

  const file = contentType ? await readLocalImage(relativePath) : null
  if (!file) {
    return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": contentType,
      // El nombre de cada archivo es unico, asi que se puede guardar en cache mucho tiempo
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
