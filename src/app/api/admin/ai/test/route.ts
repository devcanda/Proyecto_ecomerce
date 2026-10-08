import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"
import { createAiClient } from "@/lib/ai/client"
import { searchImages } from "@/lib/ai/image-search"
import { getAiConfig, isSearchReady } from "@/lib/ai/settings"
import { AiError } from "@/lib/ai/types"

// POST /api/admin/ai/test -> prueba la IA y el buscador con lo que esta guardado
export async function POST() {
  const denied = await requireAdmin()
  if (denied) return denied

  const config = await getAiConfig()
  const result: { ai: { ok: boolean; message: string }; search: { ok: boolean; message: string } } = {
    ai: { ok: false, message: "" },
    search: { ok: false, message: "" },
  }

  try {
    const answer = await createAiClient(config).generateJson<{ ok: boolean }>({
      system: "Responde solo con el JSON pedido.",
      prompt: "Prueba de conexión: responde ok = true.",
      schema: { type: "object", additionalProperties: false, required: ["ok"], properties: { ok: { type: "boolean" } } },
      schemaName: "prueba",
    })
    result.ai = answer?.ok ? { ok: true, message: `Conectado con ${config.model}.` } : { ok: false, message: "La IA respondió algo inesperado." }
  } catch (error) {
    result.ai = { ok: false, message: error instanceof AiError ? error.message : "No se pudo conectar con la IA." }
    if (!(error instanceof AiError)) console.error("AI test failed:", error)
  }

  if (!isSearchReady(config)) {
    result.search = { ok: false, message: "Falta la clave del buscador de imágenes." }
  } else {
    try {
      const photos = await searchImages(config, "Nike Air Force 1 blanco", 5)
      result.search = photos.length
        ? { ok: true, message: `El buscador respondió con ${photos.length} fotos.` }
        : { ok: false, message: "El buscador respondió, pero sin fotos. Revisa su configuración." }
    } catch (error) {
      result.search = { ok: false, message: error instanceof AiError ? error.message : "No se pudo conectar con el buscador." }
      if (!(error instanceof AiError)) console.error("Image search test failed:", error)
    }
  }

  return NextResponse.json(result)
}
