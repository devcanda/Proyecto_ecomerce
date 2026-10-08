import Anthropic from "@anthropic-ai/sdk"
import { AiError, parseJsonText, type AiClient, type AiJsonRequest } from "@/lib/ai/types"

// Modelos que aceptan el respaldo automatico del servidor cuando un filtro de seguridad rechaza la peticion
const SERVER_FALLBACK_MODELS = ["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]
// Modelos de la generacion 5 que aceptan el nivel de esfuerzo
const EFFORT_MODELS = /^claude-(fable|mythos|opus|sonnet|haiku)-5/

export function createAnthropicClient(apiKey: string, model: string): AiClient {
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 })

  return {
    async generateJson<T>(request: AiJsonRequest): Promise<T> {
      // Cada imagen va precedida de su etiqueta para que el modelo pueda referirse a ella
      const content: Anthropic.Beta.BetaContentBlockParam[] = []
      for (const image of request.images ?? []) {
        content.push({ type: "text", text: image.label })
        content.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } })
      }
      content.push({ type: "text", text: request.prompt })

      const useFallback = SERVER_FALLBACK_MODELS.includes(model)
      try {
        const response = await client.beta.messages.create({
          model,
          max_tokens: 16000,
          system: request.system,
          messages: [{ role: "user", content }],
          output_config: {
            format: { type: "json_schema", schema: request.schema },
            // Clasificar fotos es una tarea sencilla: poco esfuerzo = mas rapido y barato
            ...(EFFORT_MODELS.test(model) ? { effort: "low" as const } : {}),
          },
          ...(useFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
        })

        if (response.stop_reason === "refusal") {
          throw new AiError("La IA se negó a procesar esta solicitud. Intenta con otro producto o modelo.")
        }
        if (response.stop_reason === "max_tokens") {
          throw new AiError("La respuesta de la IA quedó incompleta. Intenta con menos fotos.")
        }
        const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("")
        return parseJsonText<T>(text)
      } catch (error) {
        if (error instanceof AiError) throw error
        if (error instanceof Anthropic.AuthenticationError) throw new AiError("La clave de API de Anthropic no es válida.")
        if (error instanceof Anthropic.PermissionDeniedError) throw new AiError("La clave de Anthropic no tiene permiso para usar este modelo.")
        if (error instanceof Anthropic.NotFoundError) throw new AiError(`El modelo "${model}" no existe o no está disponible para tu cuenta.`)
        if (error instanceof Anthropic.RateLimitError) throw new AiError("Se alcanzó el límite de uso de la IA. Espera un momento e intenta de nuevo.")
        if (error instanceof Anthropic.BadRequestError) throw new AiError(`Anthropic rechazó la solicitud: ${error.message}`)
        if (error instanceof Anthropic.APIError) throw new AiError(`Error de Anthropic (${error.status ?? "sin conexión"}). Intenta de nuevo.`)
        throw error
      }
    },
  }
}

// Modelos disponibles para la clave
export async function listAnthropicModels(apiKey: string): Promise<string[]> {
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 20_000 })
  const ids: string[] = []
  try {
    for await (const model of client.models.list()) ids.push(model.id)
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new AiError("La clave de API de Anthropic no es válida.")
    if (error instanceof Anthropic.APIError) throw new AiError(`No se pudo leer la lista de modelos (error ${error.status ?? "sin conexión"}).`)
    throw error
  }
  return ids
}
