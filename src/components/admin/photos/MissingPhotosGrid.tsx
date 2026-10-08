"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { CheckCircle2, ImagePlus, Loader2, Pencil, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PhotoDropzone } from "@/components/admin/photos/PhotoDropzone"
import { colorsWithoutPhotos, hasPhotos, matchKey, type PhotoTarget } from "@/lib/photo-names"
import { assignPhotoUrls, runLimited, uploadPhotoFile } from "@/lib/photo-upload-client"
import { cn } from "@/lib/utils"

type Filter = "none" | "colors" | "all"

const FILTERS: { value: Filter; label: string }[] = [
  { value: "none", label: "Sin ninguna foto" },
  { value: "colors", label: "Con colores sin foto" },
  { value: "all", label: "Todos" },
]

const PAGE_SIZE = 24

export function MissingPhotosGrid({
  targets,
  updateTarget,
}: {
  targets: PhotoTarget[]
  updateTarget: (id: string, change: (target: PhotoTarget) => PhotoTarget) => void
}) {
  const [filter, setFilter] = useState<Filter>("none")
  const [query, setQuery] = useState("")
  const [visible, setVisible] = useState(PAGE_SIZE)

  const counts = useMemo(
    () => ({
      none: targets.filter((target) => !hasPhotos(target)).length,
      colors: targets.filter((target) => hasPhotos(target) && colorsWithoutPhotos(target).length > 0).length,
      all: targets.length,
    }),
    [targets]
  )

  const filtered = useMemo(() => {
    const term = matchKey(query)
    return targets.filter((target) => {
      if (filter === "none" && hasPhotos(target)) return false
      if (filter === "colors" && !(hasPhotos(target) && colorsWithoutPhotos(target).length > 0)) return false
      if (!term) return true
      return matchKey(`${target.sku ?? ""} ${target.name} ${target.brand}`).includes(term)
    })
  }, [targets, filter, query])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setFilter(option.value)
                setVisible(PAGE_SIZE)
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                filter === option.value
                  ? "border-brand-blue bg-brand-blue/10 font-medium text-brand-link"
                  : "border-neutral-300 text-muted-foreground hover:border-brand-blue/60 dark:border-input"
              )}
            >
              {option.label} ({counts[option.value]})
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar referencia o nombre..."
            className="border-neutral-300 pl-9 dark:border-input"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
          <p>{filter === "all" || query ? "No hay productos que coincidan." : "¡Todos los productos de este grupo ya tienen fotos!"}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.slice(0, visible).map((target) => (
            <ProductPhotoCard key={target.id} target={target} updateTarget={updateTarget} />
          ))}
        </div>
      )}

      {filtered.length > visible && (
        <div className="text-center">
          <Button type="button" variant="outline" onClick={() => setVisible((current) => current + PAGE_SIZE)}>
            Ver más ({filtered.length - visible} restantes)
          </Button>
        </div>
      )}
    </div>
  )
}

function ProductPhotoCard({
  target,
  updateTarget,
}: {
  target: PhotoTarget
  updateTarget: (id: string, change: (target: PhotoTarget) => PhotoTarget) => void
}) {
  // Un recuadro por color; sin colores, uno para las fotos generales
  const slots = target.colors.length
    ? target.colors.map((color) => ({ color: color.name as string | undefined, images: color.images }))
    : [{ color: undefined, images: target.images }]

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium" title={target.name}>
            {target.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {target.sku && <span className="font-mono">{target.sku} · </span>}
            {target.brand}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
          <Link href={`/admin/products/${target.id}/edit`} title="Editar producto">
            <Pencil className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      <div className={cn("grid gap-2", slots.length > 1 && "grid-cols-2")}>
        {slots.map((slot) => (
          <PhotoSlot key={slot.color ?? "general"} target={target} color={slot.color} images={slot.images} updateTarget={updateTarget} />
        ))}
      </div>
    </div>
  )
}

function PhotoSlot({
  target,
  color,
  images,
  updateTarget,
}: {
  target: PhotoTarget
  color?: string
  images: string[]
  updateTarget: (id: string, change: (target: PhotoTarget) => PhotoTarget) => void
}) {
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const upload = async (files: File[]) => {
    setError(null)
    setUploading({ done: 0, total: files.length })
    const results = await runLimited(files, 3, async (file) => {
      const uploaded = await uploadPhotoFile(file)
      setUploading((current) => current && { ...current, done: current.done + 1 })
      return uploaded.url
    })
    const urls = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))
    const failed = results.length - urls.length
    try {
      if (urls.length) {
        const { images: saved } = await assignPhotoUrls({ productId: target.id, color, urls, mode: "append" })
        updateTarget(target.id, (current) =>
          color
            ? { ...current, colors: current.colors.map((item) => (item.name === color ? { ...item, images: saved } : item)) }
            : { ...current, images: saved }
        )
      }
      if (failed) setError(`${failed} ${failed === 1 ? "foto no se pudo subir" : "fotos no se pudieron subir"}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar las fotos")
    } finally {
      setUploading(null)
    }
  }

  return (
    <PhotoDropzone onFiles={upload} disabled={Boolean(uploading)} className="rounded-lg">
      {(open, dragActive) => (
        <button
          type="button"
          onClick={open.files}
          disabled={Boolean(uploading)}
          className={cn(
            "flex w-full flex-col gap-2 rounded-lg border-2 border-dashed p-2 text-left transition-colors",
            images.length ? "border-neutral-200 dark:border-input" : "border-neutral-300 dark:border-input",
            dragActive ? "border-brand-blue bg-brand-blue/5" : "hover:border-brand-blue/60"
          )}
        >
          <span className="flex items-center justify-between gap-1 text-xs font-medium">
            <span className="truncate">{color ? `Color ${color}` : "Fotos del producto"}</span>
            <span className={cn("shrink-0", images.length ? "text-green-700 dark:text-green-400" : "text-muted-foreground")}>
              {images.length} {images.length === 1 ? "foto" : "fotos"}
            </span>
          </span>
          {images.length > 0 ? (
            <span className="flex gap-1">
              {images.slice(0, 4).map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt="" className="h-12 w-12 rounded border object-cover" />
              ))}
              {images.length > 4 && (
                <span className="flex h-12 w-12 items-center justify-center rounded border bg-muted text-xs">+{images.length - 4}</span>
              )}
            </span>
          ) : null}
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {uploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Subiendo {uploading.done} de {uploading.total}...
              </>
            ) : (
              <>
                <ImagePlus className="h-3.5 w-3.5 text-brand-blue" />
                {images.length ? "Agregar más" : "Arrastra o toca para subir"}
              </>
            )}
          </span>
          {error && <span className="text-xs text-destructive">{error}</span>}
        </button>
      )}
    </PhotoDropzone>
  )
}
