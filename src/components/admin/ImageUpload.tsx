"use client"

import { useState, useCallback, useEffect } from "react"
import Image from "next/image"
import { X, Loader2, ImagePlus, CheckCircle2, AlertTriangle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  evaluateImageQuality,
  IMAGE_MINIMUM_PX,
  IMAGE_RECOMMENDED_PX,
  ImageQuality,
} from "@/lib/image-quality"

interface UploadedImage {
  url: string
  publicId: string
}

interface ImageUploadProps {
  value: UploadedImage[]
  onChange: (images: UploadedImage[]) => void
  maxImages?: number
}

export function ImageUpload({ value = [], onChange, maxImages = 5 }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return

      const remainingSlots = maxImages - value.length
      if (remainingSlots <= 0) return

      const filesToUpload = Array.from(files).slice(0, remainingSlots)
      setUploading(true)
      setError(null)

      try {
        const uploadPromises = filesToUpload.map(async (file) => {
          const formData = new FormData()
          formData.append("file", file)

          const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || "Error al subir imagen")
          }

          return response.json()
        })

        // Se conservan las imagenes que si se subieron aunque alguna falle
        const results = await Promise.allSettled(uploadPromises)
        const uploaded = results
          .filter((result): result is PromiseFulfilledResult<UploadedImage> => result.status === "fulfilled")
          .map((result) => result.value)
        const failed = results.filter((result) => result.status === "rejected")

        if (uploaded.length > 0) onChange([...value, ...uploaded])
        if (failed.length > 0) {
          const reason = (failed[0] as PromiseRejectedResult).reason
          setError(
            `No se pudo subir ${failed.length === 1 ? "1 imagen" : `${failed.length} imagenes`}: ${
              reason instanceof Error ? reason.message : "Error al subir imagen"
            }`
          )
        }
      } finally {
        setUploading(false)
      }
    },
    [value, onChange, maxImages]
  )

  const handleRemove = useCallback(
    async (index: number) => {
      const imageToRemove = value[index]

      // Solo se borran del almacenamiento las imagenes recien subidas (las ya guardadas no tienen publicId)
      if (imageToRemove.publicId) {
        try {
          await fetch(`/api/upload?publicId=${encodeURIComponent(imageToRemove.publicId)}`, {
            method: "DELETE",
          })
        } catch (error) {
          console.error("Error deleting image:", error)
        }
      }

      // Actualizar estado local
      const newImages = value.filter((_, i) => i !== index)
      onChange(newImages)
    },
    [value, onChange]
  )

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      handleUpload(e.dataTransfer.files)
    },
    [handleUpload]
  )

  return (
    <div className="space-y-4">
      {/* Preview de imágenes subidas */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 [&>*]:min-w-0">
          {value.map((image, index) => (
            <ImagePreview
              key={image.publicId || image.url}
              url={image.url}
              index={index}
              onRemove={() => handleRemove(index)}
            />
          ))}
        </div>
      )}

      {/* Área de upload */}
      {value.length < maxImages && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={cn(
            "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
            dragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50",
            uploading && "pointer-events-none opacity-50"
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Subiendo...</p>
            </>
          ) : (
            <>
              <ImagePlus className="h-10 w-10 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">
                Arrastra imágenes aquí o haz clic para seleccionar
              </p>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, WebP o GIF (máx. 5MB)
              </p>
              <p className="mt-1 text-xs font-medium text-brand-link">
                Recomendado: {IMAGE_RECOMMENDED_PX} × {IMAGE_RECOMMENDED_PX} px o más, cuadrada (1:1). Mínimo:{" "}
                {IMAGE_MINIMUM_PX} × {IMAGE_MINIMUM_PX} px
              </p>
              <p className="text-xs text-muted-foreground">
                {value.length} de {maxImages} imágenes
              </p>
            </>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={(e) => handleUpload(e.target.files)}
            className="absolute inset-0 cursor-pointer opacity-0"
            disabled={uploading}
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

const QUALITY_STYLES: Record<ImageQuality["level"], { badge: string; text: string; icon: typeof CheckCircle2 }> = {
  optimal: { badge: "bg-green-600 text-white", text: "text-green-700 dark:text-green-400", icon: CheckCircle2 },
  acceptable: { badge: "bg-amber-500 text-white", text: "text-amber-700 dark:text-amber-400", icon: AlertTriangle },
  low: { badge: "bg-red-600 text-white", text: "text-red-700 dark:text-red-400", icon: XCircle },
}

// Mide el tamaño real de la foto guardada (en px)
function useImageSize(url: string) {
  const [size, setSize] = useState<{ url: string; width: number; height: number } | null>(null)

  useEffect(() => {
    const img = new window.Image()
    img.onload = () => setSize({ url, width: img.naturalWidth, height: img.naturalHeight })
    img.src = url
    return () => {
      img.onload = null
    }
  }, [url])

  return size?.url === url ? size : null
}

function ImagePreview({ url, index, onRemove }: { url: string; index: number; onRemove: () => void }) {
  const size = useImageSize(url)
  const quality = size ? evaluateImageQuality(size.width, size.height) : null
  const style = quality ? QUALITY_STYLES[quality.level] : null
  const Icon = style?.icon

  return (
    <div className="space-y-1.5">
      <div className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
        <Image src={url} alt={`Imagen ${index + 1}`} fill className="object-cover" />
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Quitar imagen</span>
        </button>
        {quality && style && Icon && (
          <span
            className={cn(
              "absolute left-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm",
              style.badge
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {quality.label}
          </span>
        )}
        {index === 0 && (
          <span className="absolute bottom-2 left-2 rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground">
            Principal
          </span>
        )}
      </div>

      {/* Tamaño real y recomendacion */}
      {size && quality && style ? (
        <div className="text-xs leading-snug">
          <p className="font-medium">
            {size.width} × {size.height} px
          </p>
          <p className={style.text}>{quality.detail}</p>
          {quality.notSquare && (
            <p className="text-amber-700 dark:text-amber-400">
              No es cuadrada: en la tienda se recortarán los bordes.
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Revisando calidad...</p>
      )}
    </div>
  )
}
