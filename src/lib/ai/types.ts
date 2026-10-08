// Contrato comun de los proveedores de IA: texto + imagenes de entrada, JSON con un esquema de salida

export interface AiImage {
  // Texto que se pone justo antes de la imagen (ej. "Foto 3")
  label: string
  mediaType: "image/jpeg" | "image/png" | "image/webp"
  // Contenido en base64 (sin el prefijo data:)
  data: string
}

export interface AiJsonRequest {
  system: string
  prompt: string
  images?: AiImage[]
  // Esquema JSON de la respuesta (todos los objetos con additionalProperties: false y required)
  schema: Record<string, unknown>
  schemaName: string
}

export interface AiClient {
  generateJson<T>(request: AiJsonRequest): Promise<T>
}

// Error con un mensaje que se puede mostrar en el panel
export class AiError extends Error {}

// Quita ```json ... ``` si el modelo lo agrega y convierte a objeto
export function parseJsonText<T>(text: string): T {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  try {
    return JSON.parse(clean) as T
  } catch {
    throw new AiError("La IA respondió en un formato que no se pudo leer. Intenta de nuevo.")
  }
}
