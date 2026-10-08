import sharp from "sharp"
import { createAiClient } from "@/lib/ai/client"
import { searchImages, type ImageCandidate } from "@/lib/ai/image-search"
import type { AiConfig } from "@/lib/ai/settings"
import { AiError, type AiImage } from "@/lib/ai/types"
import { downloadImage } from "@/lib/image-store"
import type { PhotoTarget } from "@/lib/photo-names"

// Cuantas fotos se buscan y cuantas puede elegir la IA por color
const SEARCH_COUNT = 12
const MAX_SELECTED = 4
// Fotos mas pequeñas que esto no sirven para la tienda (si el buscador informa el tamaño)
const MIN_SIDE_PX = 500

export const PHOTO_ANGLES = ["lateral", "frontal", "trasera", "superior", "suela", "par", "detalle", "en_uso", "otro"] as const

export interface PhotoReview {
  sameProduct: boolean
  colorMatch: "si" | "no" | "dudoso" | "no_aplica"
  cleanBackground: boolean
  watermarkOrText: boolean
  people: boolean
  angle: (typeof PHOTO_ANGLES)[number]
  score: number
  note: string
}

export interface FoundPhoto extends ImageCandidate {
  review?: PhotoReview
}

export interface PhotoSearchGroup {
  // Color del producto (sin color = fotos generales)
  color?: string
  query: string
  photos: FoundPhoto[]
  // Posiciones (en photos) que la IA recomienda, la portada primero
  selected: number[]
  error?: string
}

// Respuesta que se le pide a la IA
interface AiReviewResponse {
  photos: {
    photo: number
    same_product: boolean
    color_match: PhotoReview["colorMatch"]
    clean_background: boolean
    watermark_or_text: boolean
    people: boolean
    angle: PhotoReview["angle"]
    score: number
    note: string
  }[]
  selected: number[]
}

const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["photos", "selected"],
  properties: {
    photos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["photo", "same_product", "color_match", "clean_background", "watermark_or_text", "people", "angle", "score", "note"],
        properties: {
          photo: { type: "integer", description: "Número de la foto revisada" },
          same_product: { type: "boolean", description: "Es exactamente el mismo producto y modelo" },
          color_match: { type: "string", enum: ["si", "no", "dudoso", "no_aplica"] },
          clean_background: { type: "boolean", description: "Fondo blanco o liso, producto aislado" },
          watermark_or_text: { type: "boolean", description: "Tiene marca de agua, logos de tienda, precios o texto encima" },
          people: { type: "boolean", description: "Aparecen personas o partes del cuerpo" },
          angle: { type: "string", enum: [...PHOTO_ANGLES] },
          score: { type: "integer", description: "0 a 100: qué tan buena es para la página del producto" },
          note: { type: "string", description: "Comentario breve en español (máximo 12 palabras)" },
        },
      },
    },
    selected: {
      type: "array",
      description: `Números de las mejores fotos (máximo ${MAX_SELECTED}), la portada primero`,
      items: { type: "integer" },
    },
  },
}

const SYSTEM_PROMPT = `Eres el editor de fotos de "Compra En Linea", una tienda en línea de Colombia (tecnología, calzado y artículos varios).
Revisas fotos encontradas en internet y eliges las que sirven para la página de un producto.

Una buena foto de producto:
- Muestra exactamente el mismo producto y modelo (no uno parecido, otra versión ni otra marca).
- Tiene el color pedido. Si el color no coincide, no la elijas.
- Tiene fondo blanco o liso, el producto centrado, completo y nítido.
- No tiene marcas de agua, logos de otras tiendas, precios, textos encima, collages ni personas.

Para la portada prefiere: en calzado, la vista lateral del zapato derecho apuntando a la derecha; en otros productos, la vista frontal o de tres cuartos.
Después de la portada elige ángulos distintos entre sí (no repitas la misma vista).
Si ninguna foto cumple, deja "selected" vacío: es mejor no elegir que elegir una foto equivocada.
Revisa todas las fotos, sin excepción, y escribe las notas en español.`

const unique = (words: string[]) => {
  const seen = new Set<string>()
  return words
    .flatMap((text) => text.split(/\s+/))
    .filter((word) => {
      const key = word.toLowerCase()
      if (!word || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .join(" ")
}

// Texto de busqueda: marca + modelo (o nombre) + color
export function buildPhotoQuery(target: PhotoTarget, color?: string) {
  // El nombre suele traer el color entre parentesis: se quita si se busca otro color
  const name = target.name.replace(/\([^)]*\)/g, " ")
  return unique([target.brand, target.model ?? name, color?.replace(/\//g, " ") ?? ""])
}

// Miniatura liviana para que la IA la revise (menos costo y mas rapido)
async function thumbnailForAi(candidate: ImageCandidate): Promise<string | null> {
  for (const url of [candidate.thumbnailUrl, candidate.imageUrl]) {
    try {
      const buffer = await downloadImage(url, 4 * 1024 * 1024, 10_000)
      const jpeg = await sharp(buffer)
        .rotate()
        .resize(384, 384, { fit: "inside", withoutEnlargement: true })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 80 })
        .toBuffer()
      return jpeg.toString("base64")
    } catch {
      // Se intenta con la foto completa si la miniatura falla
    }
  }
  return null
}

async function reviewGroup(config: AiConfig, target: PhotoTarget, color: string | undefined): Promise<PhotoSearchGroup> {
  const query = buildPhotoQuery(target, color)
  const found = (await searchImages(config, query, SEARCH_COUNT)).filter(
    (item) => !item.width || !item.height || Math.min(item.width, item.height) >= MIN_SIDE_PX
  )
  if (!found.length) return { color, query, photos: [], selected: [], error: "El buscador no encontró fotos para este producto." }

  // Se descargan las miniaturas; las que no cargan se descartan
  const thumbnails = await Promise.all(found.map(thumbnailForAi))
  const photos = found.filter((_, index) => thumbnails[index])
  const images: AiImage[] = thumbnails
    .filter((data): data is string => Boolean(data))
    .map((data, index) => ({ label: `Foto ${index + 1}:`, mediaType: "image/jpeg", data }))
  if (!images.length) return { color, query, photos: [], selected: [], error: "No se pudo abrir ninguna de las fotos encontradas." }

  const otherColors = target.colors.map((item) => item.name).filter((name) => name !== color)
  const prompt = [
    `Producto: ${target.name}`,
    `Marca: ${target.brand}`,
    target.model ? `Modelo: ${target.model}` : null,
    color ? `Color pedido: ${color}` : "Color: el del producto (no se pide uno específico)",
    otherColors.length ? `Otros colores del mismo producto (NO son el pedido): ${otherColors.join(", ")}` : null,
    "",
    `Revisa las ${images.length} fotos de arriba (numeradas de 1 a ${images.length}) y elige hasta ${MAX_SELECTED} para la página del producto, la portada primero.`,
  ]
    .filter((line) => line !== null)
    .join("\n")

  const ai = createAiClient(config)
  const result = await ai.generateJson<AiReviewResponse>({
    system: SYSTEM_PROMPT,
    prompt,
    images,
    schema: REVIEW_SCHEMA,
    schemaName: "revision_fotos",
  })

  const reviewed: FoundPhoto[] = photos.map((photo) => ({ ...photo }))
  for (const item of result.photos ?? []) {
    const index = item.photo - 1
    if (!Number.isInteger(index) || index < 0 || index >= reviewed.length) continue
    reviewed[index].review = {
      sameProduct: Boolean(item.same_product),
      colorMatch: item.color_match,
      cleanBackground: Boolean(item.clean_background),
      watermarkOrText: Boolean(item.watermark_or_text),
      people: Boolean(item.people),
      angle: PHOTO_ANGLES.includes(item.angle) ? item.angle : "otro",
      score: Math.max(0, Math.min(100, Math.round(Number(item.score) || 0))),
      note: String(item.note ?? "").slice(0, 160),
    }
  }
  const selected = [...new Set((result.selected ?? []).map((number) => number - 1))]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < reviewed.length)
    .slice(0, MAX_SELECTED)

  return { color, query, photos: reviewed, selected }
}

// Busca y evalua fotos para un producto: una busqueda por color (o una general si no tiene colores)
export async function findProductPhotos(config: AiConfig, target: PhotoTarget, colors?: string[]): Promise<PhotoSearchGroup[]> {
  const wanted = target.colors.length
    ? target.colors.filter((color) => !colors?.length || colors.includes(color.name)).map((color) => color.name as string | undefined)
    : [undefined]
  const groups: PhotoSearchGroup[] = []
  for (const color of wanted) {
    try {
      groups.push(await reviewGroup(config, target, color))
    } catch (error) {
      if (!(error instanceof AiError)) console.error("Error finding photos", target.id, color, error)
      groups.push({
        color,
        query: buildPhotoQuery(target, color),
        photos: [],
        selected: [],
        error: error instanceof AiError ? error.message : "No se pudieron buscar las fotos.",
      })
    }
  }
  return groups
}
