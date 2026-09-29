import { NextRequest, NextResponse } from "next/server"
import { cloudinary } from "@/lib/cloudinary"
import { requireAdmin } from "@/lib/admin-guard"
import { IMAGE_MAX_STORED_PX } from "@/lib/image-quality"
import {
  deleteLocalImage,
  isCloudinaryConfigured,
  LOCAL_PREFIX,
  saveLocalImage,
} from "@/lib/local-storage"

export async function POST(request: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json(
        { error: "No se proporcionó ningún archivo" },
        { status: 400 }
      )
    }

    // Validar tipo de archivo
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Tipo de archivo no válido. Solo se permiten imágenes (JPG, PNG, WebP, GIF)" },
        { status: 400 }
      )
    }

    // Validar tamaño (máx 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "El archivo es demasiado grande. Máximo 5MB" },
        { status: 400 }
      )
    }

    // Convertir a buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Sin cuenta de Cloudinary configurada, la imagen se guarda en el propio servidor
    if (!isCloudinaryConfigured()) {
      return NextResponse.json(await saveLocalImage(buffer))
    }

    // Subir a Cloudinary
    const result = await new Promise<{ secure_url: string; public_id: string }>(
      (resolve, reject) => {
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
            (error, result) => {
              if (error) reject(error)
              else resolve(result as { secure_url: string; public_id: string })
            }
          )
          .end(buffer)
      }
    )

    return NextResponse.json({
      url: result.secure_url,
      publicId: result.public_id,
    })
  } catch (error) {
    console.error("Error uploading image:", error)
    return NextResponse.json(
      { error: "Error al subir la imagen" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  try {
    const { searchParams } = new URL(request.url)
    const publicId = searchParams.get("publicId")

    if (!publicId) {
      return NextResponse.json(
        { error: "Se requiere el publicId" },
        { status: 400 }
      )
    }

    if (publicId.startsWith(LOCAL_PREFIX)) {
      await deleteLocalImage(publicId)
    } else {
      await cloudinary.uploader.destroy(publicId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting image:", error)
    return NextResponse.json(
      { error: "Error al eliminar la imagen" },
      { status: 500 }
    )
  }
}
