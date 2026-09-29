import { randomUUID } from "node:crypto"
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"
import { IMAGE_MAX_STORED_PX } from "@/lib/image-quality"

// Imagenes guardadas en el propio servidor cuando Cloudinary no esta configurado.
// Se guardan fuera de /public para que se sirvan tambien en produccion (ver app/uploads/[...path]).
export const UPLOADS_DIR = path.join(process.cwd(), "storage", "uploads")
export const LOCAL_PREFIX = "local:"

export function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  )
}

// Evita rutas como "../../.env": solo se permiten archivos dentro de la carpeta de subidas
export function resolveUploadPath(relativePath: string) {
  const fullPath = path.resolve(UPLOADS_DIR, relativePath)
  if (!fullPath.startsWith(UPLOADS_DIR + path.sep)) return null
  return fullPath
}

// Optimiza la imagen (max 2000px, WebP) igual que la configuracion usada en Cloudinary
export async function saveLocalImage(buffer: Buffer, folder = "products") {
  const fileName = `${randomUUID()}.webp`
  const relativePath = `${folder}/${fileName}`
  const fullPath = resolveUploadPath(relativePath)
  if (!fullPath) throw new Error("Ruta de archivo no valida")

  await mkdir(path.dirname(fullPath), { recursive: true })
  const optimized = await sharp(buffer)
    .rotate()
    .resize(IMAGE_MAX_STORED_PX, IMAGE_MAX_STORED_PX, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer()
  await writeFile(fullPath, optimized)

  return { url: `/uploads/${relativePath}`, publicId: `${LOCAL_PREFIX}${relativePath}` }
}

export async function deleteLocalImage(publicId: string) {
  const fullPath = resolveUploadPath(publicId.slice(LOCAL_PREFIX.length))
  if (!fullPath) return
  await unlink(fullPath).catch(() => undefined)
}

export async function readLocalImage(relativePath: string) {
  const fullPath = resolveUploadPath(relativePath)
  if (!fullPath) return null
  return readFile(fullPath).catch(() => null)
}
