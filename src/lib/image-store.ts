import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import sharp from "sharp"
import { cloudinary } from "@/lib/cloudinary"
import { IMAGE_MAX_STORED_PX } from "@/lib/image-quality"
import { isCloudinaryConfigured, saveLocalImage } from "@/lib/local-storage"

export interface StoredImage {
  url: string
  publicId: string
  // Tamaño original de la foto (para el indicador de calidad)
  width?: number
  height?: number
}

// Guarda una foto: en Cloudinary si esta configurado; si no, en el propio servidor (WebP, max 2000px)
export async function storeImage(buffer: Buffer): Promise<StoredImage> {
  const meta = await sharp(buffer).metadata().catch(() => null)
  if (!meta?.width || !meta.height) throw new ImageError("El archivo no es una imagen válida")
  // Fotos de celular giradas: el ancho y el alto reales se intercambian
  const rotated = (meta.orientation ?? 1) >= 5
  const size = rotated ? { width: meta.height, height: meta.width } : { width: meta.width, height: meta.height }

  if (!isCloudinaryConfigured()) return { ...(await saveLocalImage(buffer)), ...size }

  const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: "basictech/products",
          resource_type: "image",
          transformation: [
            { width: IMAGE_MAX_STORED_PX, height: IMAGE_MAX_STORED_PX, crop: "limit" },
            { quality: "auto" },
            { fetch_format: "auto" },
          ],
        },
        (error, uploaded) => (error ? reject(error) : resolve(uploaded as { secure_url: string; public_id: string }))
      )
      .end(buffer)
  })
  return { url: result.secure_url, publicId: result.public_id, ...size }
}

// Error con un mensaje que se puede mostrar al usuario
export class ImageError extends Error {}

// Maximo que se descarga de un enlace (las fotos grandes se reducen al guardarlas)
const MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024
const DOWNLOAD_TIMEOUT_MS = 20_000

// No se permiten direcciones internas (el servidor no debe poder leer su propia red)
function isPrivateAddress(address: string) {
  if (isIP(address) === 6) {
    const value = address.toLowerCase()
    if (value.startsWith("::ffff:")) return isPrivateAddress(value.slice(7))
    return value === "::1" || value === "::" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80")
  }
  const [a, b] = address.split(".").map(Number)
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  )
}

async function assertPublicUrl(raw: string) {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new ImageError("El enlace no es válido")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new ImageError("El enlace debe empezar por http:// o https://")
  const host = url.hostname.replace(/^\[|\]$/g, "")
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => [])
  if (!addresses.length) throw new ImageError("No se encontró el sitio del enlace")
  if (addresses.some((item) => isPrivateAddress(item.address))) throw new ImageError("Ese enlace no está permitido")
  return url
}

// Descarga una imagen de internet revisando que el destino sea publico y con limite de tamaño
export async function downloadImage(raw: string, maxBytes = MAX_DOWNLOAD_BYTES, timeoutMs = DOWNLOAD_TIMEOUT_MS): Promise<Buffer> {
  let url = await assertPublicUrl(raw.trim())
  let response: Response | null = null
  // Las redirecciones se siguen a mano para revisar cada destino
  for (let hop = 0; hop < 4; hop++) {
    response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CompraEnLineaBot/1.0)",
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
      },
    }).catch((error) => {
      throw new ImageError(error?.name === "TimeoutError" ? "El sitio tardó demasiado en responder" : "No se pudo descargar la foto")
    })
    const location = response.headers.get("location")
    if (response.status >= 300 && response.status < 400 && location) {
      url = await assertPublicUrl(new URL(location, url).toString())
      continue
    }
    break
  }
  if (!response || !response.ok) throw new ImageError(`El sitio respondió con error ${response?.status ?? ""}`.trim())
  const type = response.headers.get("content-type") ?? ""
  if (type && !type.startsWith("image/") && !type.startsWith("application/octet-stream")) {
    throw new ImageError("El enlace no es una foto (abre una página, no una imagen)")
  }
  if (Number(response.headers.get("content-length") ?? 0) > maxBytes) throw new ImageError("La foto es demasiado pesada (máx. 15 MB)")

  // Lectura con limite de tamaño
  const reader = response.body?.getReader()
  if (!reader) throw new ImageError("No se pudo descargar la foto")
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > maxBytes) {
      await reader.cancel()
      throw new ImageError("La foto es demasiado pesada (máx. 15 MB)")
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

// Descarga una foto de internet y la guarda como si se hubiera subido desde el computador
export async function storeImageFromUrl(raw: string): Promise<StoredImage> {
  return storeImage(await downloadImage(raw))
}
