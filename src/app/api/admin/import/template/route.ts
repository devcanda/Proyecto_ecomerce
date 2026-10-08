import { NextResponse } from "next/server"
import { requireProductManager } from "@/lib/admin-guard"
import { buildTemplate } from "@/lib/product-import"

// GET /api/admin/import/template -> plantilla de Excel para la carga masiva
export async function GET() {
  const denied = await requireProductManager()
  if (denied) return denied

  try {
    const file = await buildTemplate()
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="plantilla-productos.xlsx"',
      },
    })
  } catch (error) {
    console.error("Error building import template:", error)
    return NextResponse.json({ error: "No se pudo generar la plantilla" }, { status: 500 })
  }
}
