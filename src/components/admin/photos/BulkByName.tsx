"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, FolderOpen, ImagePlus, Loader2, Trash2, Upload, X, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SearchableSelect } from "@/components/admin/SearchableSelect"
import { PhotoDropzone } from "@/components/admin/photos/PhotoDropzone"
import { QualityBadge } from "@/components/admin/photos/QualityBadge"
import { matchPhotoFile, type PhotoTarget } from "@/lib/photo-names"
import { assignPhotoUrls, readImageSize, runLimited, uploadPhotoFile } from "@/lib/photo-upload-client"
import { cn } from "@/lib/utils"

// Maximo de fotos por tanda
const MAX_FILES = 500
// Valor del selector de color para las fotos generales del producto
const GENERAL = "__general__"

interface PhotoItem {
  id: string
  file: File
  preview: string
  width?: number
  height?: number
  productId?: string
  color?: string
  position: number
  // Texto de color del nombre que no existe en el producto
  unknownColor?: string
  status: "pending" | "uploading" | "done" | "error"
  error?: string
}

type Mode = "append" | "replace"

export function BulkByName({ targets, onSaved }: { targets: PhotoTarget[]; onSaved: () => void }) {
  const [items, setItems] = useState<PhotoItem[]>([])
  const [mode, setMode] = useState<Mode>("append")
  const [working, setWorking] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [summary, setSummary] = useState<{ photos: number; products: number; failed: number } | null>(null)
  const [skipped, setSkipped] = useState(0)
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])
  // Libera las vistas previas al salir
  useEffect(() => () => itemsRef.current.forEach((item) => URL.revokeObjectURL(item.preview)), [])

  const byId = useMemo(() => new Map(targets.map((target) => [target.id, target])), [targets])
  const productOptions = useMemo(
    () => targets.map((target) => ({ value: target.id, label: target.sku ? `${target.sku} · ${target.name}` : target.name })),
    [targets]
  )

  const addFiles = (files: File[]) => {
    setSummary(null)
    const room = MAX_FILES - items.length
    setSkipped(Math.max(0, files.length - room))
    const added = files.slice(0, Math.max(0, room)).map((file, index): PhotoItem => {
      const match = matchPhotoFile(file.webkitRelativePath || file.name, targets)
      return {
        id: `${Date.now()}-${index}-${file.name}`,
        file,
        preview: URL.createObjectURL(file),
        status: "pending",
        ...match,
      }
    })
    setItems((current) => [...current, ...added])
    // Tamaño real de cada foto para el indicador de calidad
    added.forEach(async (item) => {
      const size = await readImageSize(item.file)
      if (size) setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, ...size } : entry)))
    })
  }

  const update = (id: string, change: Partial<PhotoItem>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...change } : item)))

  const remove = (id: string) =>
    setItems((current) => {
      const item = current.find((entry) => entry.id === id)
      if (item) URL.revokeObjectURL(item.preview)
      return current.filter((entry) => entry.id !== id)
    })

  const clear = () => {
    items.forEach((item) => URL.revokeObjectURL(item.preview))
    setItems([])
    setSummary(null)
    setSkipped(0)
  }

  // Una foto necesita revision si no tiene producto o si el color del nombre no existe
  const needsReview = (item: PhotoItem) => !item.productId || Boolean(item.unknownColor)
  const pending = items.filter((item) => item.status !== "done")
  const toReview = pending.filter(needsReview)
  const ready = pending.filter((item) => !needsReview(item))

  // Fotos listas agrupadas por producto y color, en el orden del numero del archivo
  const groups = useMemo(() => {
    const map = new Map<string, { productId: string; color?: string; items: PhotoItem[] }>()
    for (const item of ready) {
      const key = `${item.productId}|${item.color ?? ""}`
      if (!map.has(key)) map.set(key, { productId: item.productId!, color: item.color, items: [] })
      map.get(key)!.items.push(item)
    }
    return [...map.values()]
      .map((group) => ({ ...group, items: group.items.sort((a, b) => a.position - b.position || a.file.name.localeCompare(b.file.name)) }))
      .sort((a, b) => (byId.get(a.productId)?.name ?? "").localeCompare(byId.get(b.productId)?.name ?? ""))
  }, [ready, byId])

  const save = async () => {
    setWorking(true)
    setSummary(null)
    const total = groups.reduce((sum, group) => sum + group.items.length, 0)
    setProgress({ done: 0, total })
    let saved = 0
    let failed = 0
    const products = new Set<string>()
    for (const group of groups) {
      group.items.forEach((item) => update(item.id, { status: "uploading", error: undefined }))
      const results = await runLimited(group.items, 3, async (item) => {
        const uploaded = await uploadPhotoFile(item.file)
        setProgress((current) => ({ ...current, done: current.done + 1 }))
        return uploaded
      })
      const urls: string[] = []
      results.forEach((result, index) => {
        const item = group.items[index]
        if (result.status === "fulfilled") urls.push(result.value.url)
        else {
          failed++
          update(item.id, { status: "error", error: result.reason instanceof Error ? result.reason.message : "No se pudo subir" })
        }
      })
      if (!urls.length) continue
      try {
        await assignPhotoUrls({ productId: group.productId, color: group.color, urls, mode })
        saved += urls.length
        products.add(group.productId)
        group.items.forEach((item, index) => {
          if (results[index].status === "fulfilled") update(item.id, { status: "done" })
        })
      } catch (error) {
        failed += urls.length
        group.items.forEach((item, index) => {
          if (results[index].status === "fulfilled") {
            update(item.id, { status: "error", error: error instanceof Error ? error.message : "No se pudo guardar" })
          }
        })
      }
    }
    setSummary({ photos: saved, products: products.size, failed })
    setWorking(false)
    // Las fotos guardadas salen de la lista
    setItems((current) => {
      current.filter((item) => item.status === "done").forEach((item) => URL.revokeObjectURL(item.preview))
      return current.filter((item) => item.status !== "done")
    })
    onSaved()
  }

  const readyCount = ready.length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Subir fotos por nombre de archivo</CardTitle>
          <CardDescription>
            Nombra cada foto con la <b>Referencia</b> del producto y el sistema la pone en su lugar. Puedes arrastrar
            muchas fotos o una carpeta completa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Nombre del archivo</th>
                  <th className="px-3 py-2 font-medium">Dónde queda</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  ["CAT-001.jpg", "Foto principal del producto CAT-001"],
                  ["CAT-001-2.jpg  ·  CAT-001-3.jpg", "Fotos 2 y 3 (otros ángulos)"],
                  ["NIK-AF1_Negro.jpg", "Portada del color Negro del producto NIK-AF1"],
                  ["NIK-AF1_Negro-2.jpg", "Segunda foto del color Negro"],
                  ["CAT-002_Blanco Azul.jpg", "Color Blanco/Azul (la barra / no se puede usar en nombres de archivo)"],
                ].map(([name, place]) => (
                  <tr key={name}>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{place}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PhotoDropzone onFiles={addFiles} disabled={working} allowFolder className="rounded-xl">
            {(open, dragActive) => (
              <div
                className={cn(
                  "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-neutral-300 px-4 py-8 text-center transition-colors dark:border-input",
                  dragActive && "border-brand-blue bg-brand-blue/5"
                )}
              >
                <ImagePlus className="h-10 w-10 text-brand-blue" />
                <div>
                  <p className="font-medium">Arrastra aquí las fotos o la carpeta</p>
                  <p className="text-sm text-muted-foreground">JPG, PNG o WebP. Hasta {MAX_FILES} fotos por tanda.</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button type="button" variant="outline" onClick={open.files} disabled={working}>
                    <ImagePlus className="mr-2 h-4 w-4" />
                    Elegir fotos
                  </Button>
                  <Button type="button" variant="outline" onClick={open.folder} disabled={working}>
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Elegir carpeta
                  </Button>
                </div>
              </div>
            )}
          </PhotoDropzone>
          {skipped > 0 && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Se tomaron las primeras {MAX_FILES} fotos; {skipped} quedaron por fuera. Súbelas en otra tanda.
            </p>
          )}
        </CardContent>
      </Card>

      {summary && (
        <div
          className={cn(
            "flex items-start gap-3 rounded-lg border p-4 text-sm",
            summary.failed ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40" : "border-green-300 bg-green-50 dark:border-green-900 dark:bg-green-950/40"
          )}
        >
          {summary.failed ? <XCircle className="h-5 w-5 shrink-0 text-amber-600" /> : <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />}
          <p>
            Se guardaron <b>{summary.photos}</b> {summary.photos === 1 ? "foto" : "fotos"} en <b>{summary.products}</b>{" "}
            {summary.products === 1 ? "producto" : "productos"}.
            {summary.failed > 0 && ` ${summary.failed} no se pudieron subir: están marcadas en rojo abajo.`}
          </p>
        </div>
      )}

      {pending.length > 0 && (
        <>
          {/* Acciones */}
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <p className="text-sm">
                  <b className="text-green-700 dark:text-green-400">{readyCount} listas</b>
                  {toReview.length > 0 && (
                    <>
                      {" · "}
                      <b className="text-amber-700 dark:text-amber-400">{toReview.length} por revisar</b> (no se suben hasta que
                      les asignes producto)
                    </>
                  )}
                </p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Qué hacer con las fotos actuales">
                  {(
                    [
                      ["append", "Agregar a las fotos que ya tiene"],
                      ["replace", "Reemplazar sus fotos actuales"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={mode === value}
                      disabled={working}
                      onClick={() => setMode(value)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm transition-colors",
                        mode === value
                          ? "border-brand-blue bg-brand-blue/10 font-medium text-brand-link"
                          : "border-neutral-300 text-muted-foreground hover:border-brand-blue/60 dark:border-input"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={clear} disabled={working}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Vaciar lista
                </Button>
                <Button type="button" onClick={save} disabled={working || readyCount === 0}>
                  {working ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Subiendo {progress.done} de {progress.total}...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Subir {readyCount} {readyCount === 1 ? "foto" : "fotos"}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
            {working && progress.total > 0 && (
              <div className="mx-6 mb-6 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-brand-blue transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
            )}
          </Card>

          {/* Fotos sin producto o con un color que no existe */}
          {toReview.length > 0 && (
            <Card className="border-amber-300 dark:border-amber-900">
              <CardHeader>
                <CardTitle className="text-amber-800 dark:text-amber-300">Por revisar ({toReview.length})</CardTitle>
                <CardDescription>
                  El nombre de estas fotos no coincide con ninguna Referencia o color. Elige a qué producto van, o quítalas.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {toReview.map((item) => {
                  const target = item.productId ? byId.get(item.productId) : undefined
                  return (
                    <div key={item.id} className="flex gap-3 rounded-lg border p-2">
                      <Thumb item={item} />
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="truncate text-xs text-muted-foreground" title={item.file.name}>
                          {item.file.name}
                        </p>
                        <SearchableSelect
                          options={productOptions}
                          value={item.productId}
                          onChange={(value) => update(item.id, { productId: value, color: undefined, unknownColor: byId.get(value)?.colors.length ? item.unknownColor ?? "" : undefined })}
                          placeholder="Elegir producto"
                          searchPlaceholder="Buscar por referencia o nombre..."
                          className="h-8 text-xs"
                        />
                        {target && (target.colors.length > 0 || item.unknownColor !== undefined) && (
                          <select
                            aria-label="Color"
                            value={item.color ?? (item.unknownColor === undefined ? GENERAL : "")}
                            onChange={(event) => {
                              const value = event.target.value
                              update(item.id, { color: value && value !== GENERAL ? value : undefined, unknownColor: value ? undefined : item.unknownColor })
                            }}
                            className="h-8 w-full rounded-md border border-neutral-300 bg-background px-2 text-xs dark:border-input"
                          >
                            <option value="">{item.unknownColor ? `"${item.unknownColor}" no existe: elige el color` : "Elegir color"}</option>
                            {target.colors.map((color) => (
                              <option key={color.name} value={color.name}>
                                Color {color.name}
                              </option>
                            ))}
                            <option value={GENERAL}>Fotos generales del producto</option>
                          </select>
                        )}
                        <button
                          type="button"
                          onClick={() => remove(item.id)}
                          className="text-xs text-destructive hover:underline"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* Fotos reconocidas, agrupadas por producto y color */}
          {groups.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Listas para subir ({readyCount})</CardTitle>
                <CardDescription>La primera foto de cada grupo queda como portada.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {groups.map((group) => {
                  const target = byId.get(group.productId)
                  const current = group.color
                    ? target?.colors.find((color) => color.name === group.color)?.images.length ?? 0
                    : target?.images.length ?? 0
                  return (
                    <div key={`${group.productId}|${group.color ?? ""}`} className="rounded-lg border p-3">
                      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <span className="font-medium">{target?.name}</span>
                        {target?.sku && <span className="font-mono text-xs text-muted-foreground">{target.sku}</span>}
                        <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-xs text-brand-link">
                          {group.color ? `Color ${group.color}` : "Fotos generales"}
                        </span>
                        {current > 0 && (
                          <span className="text-xs text-muted-foreground">
                            · ya tiene {current} {current === 1 ? "foto" : "fotos"}
                            {mode === "replace" ? " (se reemplazan)" : " (se agregan después)"}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {group.items.map((item, index) => (
                          <Thumb key={item.id} item={item} label={index === 0 && (mode === "replace" || current === 0) ? "Portada" : undefined} onRemove={working ? undefined : () => remove(item.id)} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function Thumb({ item, label, onRemove }: { item: PhotoItem; label?: string; onRemove?: () => void }) {
  return (
    <div className="w-24 shrink-0 space-y-1">
      <div
        className={cn(
          "group relative aspect-square overflow-hidden rounded-md border bg-muted",
          item.status === "error" && "border-2 border-destructive"
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.preview} alt={item.file.name} className="h-full w-full object-cover" />
        <QualityBadge width={item.width} height={item.height} className="absolute left-1 top-1" />
        {label && <span className="absolute bottom-1 left-1 rounded bg-primary px-1.5 text-[10px] text-primary-foreground">{label}</span>}
        {item.status === "uploading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute right-1 top-1 rounded-full bg-destructive p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
            <span className="sr-only">Quitar</span>
          </button>
        )}
      </div>
      <p className="truncate text-[11px] text-muted-foreground" title={item.file.name}>
        {item.file.name}
      </p>
      {item.error && <p className="text-[11px] leading-tight text-destructive">{item.error}</p>}
    </div>
  )
}
