"use client"

import { useState } from "react"
import Image from "next/image"
import { Loader2, Ruler, Upload } from "lucide-react"

interface SizeGuideFieldProps {
  brandId: string
  brandName: string
  value?: string
  // Se llama con la nueva imagen (o undefined si se quita) despues de guardarla en la marca
  onChange: (sizeGuide: string | undefined) => void
}

// La guia de tallas pertenece a la marca: se sube una vez y la usan todos sus productos
export function SizeGuideField({ brandId, brandName, value, onChange }: SizeGuideFieldProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const saveGuide = async (sizeGuide: string | null) => {
    const response = await fetch(`/api/brands/${brandId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sizeGuide }),
    })
    if (!response.ok) throw new Error("No se pudo guardar la guia de tallas")
    onChange(sizeGuide ?? undefined)
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const response = await fetch("/api/upload", { method: "POST", body: formData })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "No se pudo subir la imagen")
      await saveGuide(data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la imagen")
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    setBusy(true)
    setError(null)
    try {
      await saveGuide(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar la guia")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-dashed p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-brand-link">
          <Ruler className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-sm font-medium">Guía de tallas de {brandName}</p>
            <p className="text-xs text-muted-foreground">
              Se muestra como &quot;Guía de tallas&quot; en todos los productos de {brandName}. Solo se sube una vez.
            </p>
          </div>

          {value && (
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="relative block h-32 w-full max-w-xs overflow-hidden rounded-md border bg-white"
            >
              <Image src={value} alt={`Guia de tallas ${brandName}`} fill className="object-contain" sizes="320px" />
            </a>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex h-9 cursor-pointer items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-medium hover:bg-muted dark:border-input">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {value ? "Cambiar imagen" : "Subir guía de tallas"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={(event) => {
                  handleFile(event.target.files?.[0])
                  event.target.value = ""
                }}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
            {value && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={busy}
                className="h-9 rounded-md px-3 text-sm text-destructive hover:bg-destructive/10"
              >
                Quitar
              </button>
            )}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
    </div>
  )
}
