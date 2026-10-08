"use client"

import { IMAGE_MAX_STORED_PX } from "@/lib/image-quality"

// Ayudas del navegador para subir fotos en cantidad (pantalla "Fotos masivas" e importacion)

export const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif)$/i

// Fotos de mas de ~4 MB o mas grandes que lo que se guarda se reducen antes de enviarlas
const RESIZE_ABOVE_BYTES = 4 * 1024 * 1024

export interface UploadedPhoto {
  url: string
  width?: number
  height?: number
}

// Tamaño real de una foto del computador
export function readImageSize(file: Blob): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      resolve(null)
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}

// Reduce la foto en el navegador (sube mas rapido y evita el limite de 5 MB del servidor)
async function shrink(file: File): Promise<Blob> {
  const size = await readImageSize(file)
  if (!size) return file
  const largest = Math.max(size.width, size.height)
  if (file.size <= RESIZE_ABOVE_BYTES && largest <= IMAGE_MAX_STORED_PX) return file
  const scale = Math.min(1, IMAGE_MAX_STORED_PX / largest)
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.92))
}

async function readJson(response: Response, fallback: string) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || fallback)
  return data
}

export async function uploadPhotoFile(file: File): Promise<UploadedPhoto> {
  const blob = await shrink(file)
  const formData = new FormData()
  formData.append("file", blob, blob === file ? file.name : `${file.name.replace(/\.[^.]+$/, "")}.jpg`)
  return readJson(await fetch("/api/upload", { method: "POST", body: formData }), "No se pudo subir la foto")
}

export async function uploadPhotoFromUrl(url: string): Promise<UploadedPhoto> {
  return readJson(
    await fetch("/api/admin/photos/from-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }),
    "No se pudo descargar la foto"
  )
}

export async function assignPhotoUrls(input: {
  productId: string
  color?: string
  urls: string[]
  mode: "append" | "replace"
}): Promise<{ images: string[] }> {
  return readJson(
    await fetch("/api/admin/photos/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
    "No se pudieron guardar las fotos"
  )
}

// Ejecuta tareas de a pocas a la vez (para no saturar el servidor compartido)
export async function runLimited<T, R>(items: T[], limit: number, task: (item: T, index: number) => Promise<R>) {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next++
      try {
        results[index] = { status: "fulfilled", value: await task(items[index], index) }
      } catch (reason) {
        results[index] = { status: "rejected", reason }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// Archivos de una carpeta arrastrada (incluye subcarpetas)
export async function filesFromDrop(dataTransfer: DataTransfer): Promise<File[]> {
  const entries = [...dataTransfer.items].map((item) => item.webkitGetAsEntry?.()).filter(Boolean) as FileSystemEntry[]
  if (!entries.length) return [...dataTransfer.files]
  const files: File[] = []
  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      files.push(await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject)))
      return
    }
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    // readEntries entrega los archivos por tandas
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject))
      if (!batch.length) break
      for (const child of batch) await walk(child)
    }
  }
  for (const entry of entries) await walk(entry)
  return files
}
