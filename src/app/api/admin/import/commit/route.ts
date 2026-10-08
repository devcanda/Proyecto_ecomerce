import { NextRequest, NextResponse } from "next/server"
import { requireProductManager } from "@/lib/admin-guard"
import { runImport } from "@/lib/product-import"
import { readUploadedImport } from "@/lib/import-request"

// POST /api/admin/import/commit (archivo) -> importa los productos sin errores
export async function POST(request: NextRequest) {
  const denied = await requireProductManager()
  if (denied) return denied

  const parsed = await readUploadedImport(request)
  if (parsed.error) return parsed.error

  try {
    return NextResponse.json(await runImport(parsed.rows))
  } catch (error) {
    console.error("Error running import:", error)
    return NextResponse.json({ error: "No se pudo completar la importación." }, { status: 500 })
  }
}
