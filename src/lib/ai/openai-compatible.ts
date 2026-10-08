import { AiError, parseJsonText, type AiClient, type AiJsonRequest } from "@/lib/ai/types"

// Cliente para cualquier API compatible con "chat/completions" de OpenAI
// (OpenAI, Google Gemini, OpenRouter, Groq, DeepSeek, Ollama, LM Studio...)

type ResponseFormat =
  | { type: "json_schema"; json_schema: { name: string; schema: Record<string, unknown>; strict: boolean } }
  | { type: "json_object" }
  | undefined

// Gemini devuelve el error dentro de una lista: [{ error: {...} }]
const errorObject = (data: unknown) => (Array.isArray(data) ? data[0] : data) as { error?: { message?: string } } | null
const errorMessage = (data: unknown) => errorObject(data)?.error?.message
// Google responde 400 (no 401) cuando la clave no sirve
const isInvalidKey = (data: unknown) => /API[_ ]?KEY|keyInvalid|invalid api key|incorrect api key/i.test(JSON.stringify(errorObject(data)?.error ?? ""))

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
// Saturacion temporal del proveedor: se reintenta un par de veces
const RETRY_STATUS = [500, 502, 503, 504]

// Modelos disponibles para la clave (GET /models)
export async function listOpenAiCompatibleModels(baseUrl: string, apiKey: string | null): Promise<string[]> {
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/models`, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    signal: AbortSignal.timeout(20_000),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new AiError(isInvalidKey(data) ? "La clave de API no es válida." : `No se pudo leer la lista de modelos (error ${response.status}).`)
  const list = ((Array.isArray(data) ? data[0] : data)?.data ?? []) as { id?: string }[]
  return list.flatMap((item) => (item.id ? [item.id.replace(/^models\//, "")] : []))
}

export function createOpenAiCompatibleClient(baseUrl: string, apiKey: string | null, model: string): AiClient {
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`

  const call = async (request: AiJsonRequest, responseFormat: ResponseFormat) => {
    const content: unknown[] = []
    for (const image of request.images ?? []) {
      content.push({ type: "text", text: image.label })
      content.push({ type: "image_url", image_url: { url: `data:${image.mediaType};base64,${image.data}` } })
    }
    // Sin formato estricto, el esquema va en las instrucciones
    const schemaHint =
      responseFormat?.type === "json_schema"
        ? ""
        : `\n\nResponde SOLO con un objeto JSON válido que cumpla este esquema:\n${JSON.stringify(request.schema)}`
    content.push({ type: "text", text: request.prompt + schemaHint })

    let response: Response
    try {
      response = await fetch(endpoint, {
        method: "POST",
        signal: AbortSignal.timeout(120_000),
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content },
          ],
          ...(responseFormat ? { response_format: responseFormat } : {}),
        }),
      })
    } catch (error) {
      const timeout = error instanceof Error && error.name === "TimeoutError"
      throw new AiError(timeout ? "La IA tardó demasiado en responder." : `No se pudo conectar con ${new URL(endpoint).host}.`)
    }
    const data = await response.json().catch(() => null)
    return { response, data }
  }

  return {
    async generateJson<T>(request: AiJsonRequest): Promise<T> {
      // No todos los proveedores aceptan json_schema: se prueba de mas a menos estricto
      const formats: ResponseFormat[] = [
        { type: "json_schema", json_schema: { name: request.schemaName, schema: request.schema, strict: true } },
        { type: "json_object" },
        undefined,
      ]
      let last: { response: Response; data: unknown } | null = null
      for (const format of formats) {
        last = await call(request, format)
        for (let attempt = 1; attempt <= 2 && RETRY_STATUS.includes(last.response.status); attempt++) {
          await wait(attempt * 3000)
          last = await call(request, format)
        }
        if (last.response.ok) break
        // Solo un 400 indica que el formato no se acepta; otros errores no mejoran reintentando
        if (last.response.status !== 400 && last.response.status !== 422) break
        // Una clave invalida no se arregla cambiando el formato
        if (isInvalidKey(last.data)) break
      }
      const { response, data } = last!
      const message = errorMessage(data)
      if (response.status === 401 || response.status === 403 || isInvalidKey(data)) throw new AiError("La clave de API no es válida o no tiene permiso.")
      if (response.status === 404) {
        throw new AiError(`El modelo "${model}" no está disponible${message ? ` (${message.split(". ").slice(0, 2).join(". ")})` : ""}. Elige otro de la lista de modelos.`)
      }
      if (RETRY_STATUS.includes(response.status)) throw new AiError("El modelo de IA está saturado en este momento. Intenta en unos minutos o elige otro modelo.")
      if (response.status === 429) throw new AiError("Se alcanzó el límite de uso de la IA. Espera un momento e intenta de nuevo.")
      if (!response.ok) throw new AiError(`La IA respondió con error ${response.status}${message ? `: ${message}` : ""}`)

      const choice = (data as { choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[] })
        ?.choices?.[0]
      if (choice?.message?.refusal) throw new AiError("La IA se negó a procesar esta solicitud.")
      if (choice?.finish_reason === "length") throw new AiError("La respuesta de la IA quedó incompleta. Intenta con menos fotos.")
      const text = choice?.message?.content
      if (!text) throw new AiError("La IA no devolvió respuesta. Revisa que el modelo acepte imágenes.")
      return parseJsonText<T>(text)
    },
  }
}
