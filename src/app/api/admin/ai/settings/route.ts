import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"
import { isAiProviderId, isImageSearchProviderId } from "@/lib/ai/providers"
import { getAiSettingsView, saveAiSettings } from "@/lib/ai/settings"

// GET /api/admin/ai/settings -> configuracion de IA (sin las claves completas)
export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied
  return NextResponse.json(await getAiSettingsView())
}

// PUT /api/admin/ai/settings -> guarda proveedor, modelo y claves (cifradas)
export async function PUT(request: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  try {
    const body = await request.json().catch(() => ({}))
    const search = body.search ?? {}
    if (!isAiProviderId(body.provider) || !isImageSearchProviderId(search.provider)) {
      return NextResponse.json({ error: "Proveedor no válido" }, { status: 400 })
    }
    if (typeof body.model !== "string" || !body.model.trim()) {
      return NextResponse.json({ error: "Escribe el modelo de IA" }, { status: 400 })
    }
    const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim() : ""
    if (body.provider === "openai-compatible" && !/^https?:\/\/\S+$/.test(baseUrl)) {
      return NextResponse.json({ error: "Escribe la dirección de la API (empieza por http:// o https://)" }, { status: 400 })
    }
    const secret = (value: unknown) => (value === null ? null : typeof value === "string" ? value : undefined)
    await saveAiSettings({
      provider: body.provider,
      model: body.model,
      baseUrl,
      apiKey: secret(body.apiKey),
      search: { provider: search.provider, apiKey: secret(search.apiKey) },
    })
    return NextResponse.json(await getAiSettingsView())
  } catch (error) {
    console.error("Error saving AI settings:", error)
    return NextResponse.json({ error: "No se pudo guardar la configuración" }, { status: 500 })
  }
}
