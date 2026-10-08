import type { AiConfig } from "@/lib/ai/settings"
import { AiError } from "@/lib/ai/types"

// Resultado de busqueda de imagenes, igual para todos los proveedores
export interface ImageCandidate {
  imageUrl: string
  thumbnailUrl: string
  pageUrl?: string
  title?: string
  source?: string
  width?: number
  height?: number
}

const toNumber = (value: unknown) => (typeof value === "number" && value > 0 ? value : typeof value === "string" && Number(value) > 0 ? Number(value) : undefined)
const isHttp = (value: unknown): value is string => typeof value === "string" && /^https?:\/\//.test(value)

// GET, o POST con JSON si se pasa un cuerpo (Serper usa POST)
async function getJson(url: string, headers: Record<string, string> = {}, body?: Record<string, unknown>) {
  let response: Response
  try {
    response = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    throw new AiError("No se pudo conectar con el buscador de imágenes.")
  }
  const data = await response.json().catch(() => null)
  const error = JSON.stringify(data?.error ?? data?.message ?? "")
  // Algunos servicios indican la clave invalida en el codigo de error
  if (response.status === 401 || response.status === 403 || /API[_ ]?KEY|keyInvalid|TOKEN_INVALID|Unauthorized/i.test(error)) {
    throw new AiError("La clave del buscador de imágenes no es válida.")
  }
  if (response.status === 429) throw new AiError("Se alcanzó el límite de búsquedas de imágenes. Espera o revisa tu plan.")
  if (!response.ok) throw new AiError(`El buscador de imágenes respondió con error ${response.status}.`)
  return data
}

export async function searchImages(config: AiConfig, query: string, count = 12): Promise<ImageCandidate[]> {
  const { apiKey } = config.search
  if (!apiKey) throw new AiError("Falta la clave del buscador de imágenes. Ve a Configuración > Inteligencia artificial.")
  let results: ImageCandidate[] = []

  // Serper.dev: resultados de Google Imagenes
  const data = await getJson("https://google.serper.dev/images", { "X-API-KEY": apiKey }, { q: query })
  results = ((data?.images ?? []) as Record<string, any>[]).slice(0, count).map((item) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    imageUrl: item.imageUrl,
    thumbnailUrl: item.thumbnailUrl ?? item.imageUrl,
    pageUrl: item.link,
    title: item.title,
    source: item.source ?? item.domain,
    width: toNumber(item.imageWidth),
    height: toNumber(item.imageHeight),
  }))

  // Sin repetidos y solo direcciones validas
  const seen = new Set<string>()
  return results.filter((item) => {
    if (!isHttp(item.imageUrl) || !isHttp(item.thumbnailUrl) || seen.has(item.imageUrl)) return false
    seen.add(item.imageUrl)
    return true
  })
}
