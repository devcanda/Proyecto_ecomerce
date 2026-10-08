import { NextRequest, NextResponse } from "next/server"
import { requireProductManager } from "@/lib/admin-guard"
import { previewImport } from "@/lib/product-import"
import { readUploadedImport } from "@/lib/import-request"

// POST /api/admin/import/preview (archivo) -> revision fila por fila, sin guardar nada
export async function POST(request: NextRequest) {
  const denied = await requireProductManager()
  if (denied) return denied

  const parsed = await readUploadedImport(request)
  if (parsed.error) return parsed.error

  try {
    return NextResponse.json(await previewImport(parsed.rows, parsed.fileErrors))
  } catch (error) {
    console.error("Error previewing import:", error)
    return NextResponse.json({ error: "No se pudo revisar el archivo." }, { status: 500 })
  }
}
