import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"
import { listAnthropicModels } from "@/lib/ai/anthropic"
import { listOpenAiCompatibleModels } from "@/lib/ai/openai-compatible"
import { getAiConfig } from "@/lib/ai/settings"
import { AiError } from "@/lib/ai/types"

// Modelos que no sirven para revisar fotos (voz, imagen, embeddings, etc.)
const NOT_CHAT = /embed|tts|audio|speech|transcribe|whisper|realtime|live|image|imagen|veo|lyria|dall-e|moderation|aqa|robotics|computer-use|deep-research|banana/i

// GET /api/admin/ai/models -> modelos que permite la clave guardada
export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied

  const config = await getAiConfig()
  if (!config.apiKey && config.provider !== "openai-compatible") return NextResponse.json({ models: [] })
  try {
    const all =
      config.provider === "anthropic"
        ? await listAnthropicModels(config.apiKey!)
        : await listOpenAiCompatibleModels(config.baseUrl, config.apiKey)
    const models = [...new Set(all.filter((id) => !NOT_CHAT.test(id)))].sort((a, b) => b.localeCompare(a, "en", { numeric: true }))
    return NextResponse.json({ models })
  } catch (error) {
    if (!(error instanceof AiError)) console.error("Error listing AI models:", error)
    return NextResponse.json({ models: [], error: error instanceof AiError ? error.message : "No se pudo leer la lista de modelos" })
  }
}
