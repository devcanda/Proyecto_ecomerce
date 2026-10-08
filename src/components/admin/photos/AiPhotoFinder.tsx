"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { AlertTriangle, Check, CheckCircle2, ExternalLink, Loader2, Save, Search, Settings, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { QualityBadge } from "@/components/admin/photos/QualityBadge"
import type { FoundPhoto, PhotoSearchGroup } from "@/lib/ai/photo-finder"
import { colorsWithoutPhotos, hasPhotos, matchKey, type PhotoTarget } from "@/lib/photo-names"
import { assignPhotoUrls, runLimited, uploadPhotoFromUrl } from "@/lib/photo-upload-client"
import { cn } from "@/lib/utils"

// Maximo de productos por tanda (cada color es una busqueda y una consulta a la IA)
const MAX_BATCH = 25

const ANGLE_LABELS: Record<string, string> = {
  lateral: "Lateral",
  frontal: "Frontal",
  trasera: "Trasera",
  superior: "Superior",
  suela: "Suela",
  par: "Par",
  detalle: "Detalle",
  en_uso: "En uso",
  otro: "Otro",
}

interface ProductRun {
  state: "waiting" | "searching" | "done" | "error"
  groups: PhotoSearchGroup[]
  // Fotos elegidas por grupo (clave = color o ""), en orden: la primera es la portada
  picks: Record<string, number[]>
  error?: string
  saving?: boolean
  saved?: number
  saveErrors?: string[]
}

const groupKey = (group: PhotoSearchGroup) => group.color ?? ""

// Fotos actuales del producto para las miniaturas: las generales y la portada de cada color
const currentPhotos = (target: PhotoTarget) => [
  ...new Set([...target.images, ...target.colors.flatMap((color) => color.images.slice(0, 1))]),
]
const MAX_THUMBS = 4

export function AiPhotoFinder({
  targets,
  initialIds,
  onSaved,
}: {
  targets: PhotoTarget[]
  initialIds: string[]
  onSaved: () => void
}) {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN"
  const [status, setStatus] = useState<{ aiReady: boolean; searchReady: boolean; model: string } | null>(null)
  const [query, setQuery] = useState("")
  const [onlyMissing, setOnlyMissing] = useState(initialIds.length === 0)
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialIds.slice(0, MAX_BATCH)))
  const [runs, setRuns] = useState<Record<string, ProductRun>>({})
  const [running, setRunning] = useState(false)

  useEffect(() => {
    fetch("/api/admin/ai/status")
      .then((response) => response.json())
      .then(setStatus)
      .catch(() => setStatus({ aiReady: false, searchReady: false, model: "" }))
  }, [])

  const byId = useMemo(() => new Map(targets.map((target) => [target.id, target])), [targets])
  const list = useMemo(() => {
    const term = matchKey(query)
    return targets.filter((target) => {
      if (onlyMissing && hasPhotos(target) && colorsWithoutPhotos(target).length === 0) return false
      return !term || matchKey(`${target.sku ?? ""} ${target.name} ${target.brand}`).includes(term)
    })
  }, [targets, query, onlyMissing])

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else if (next.size < MAX_BATCH) next.add(id)
      return next
    })

  const selectVisible = () =>
    setSelected((current) => {
      const next = new Set(current)
      for (const target of list) {
        if (next.size >= MAX_BATCH) break
        next.add(target.id)
      }
      return next
    })

  const patchRun = (id: string, change: Partial<ProductRun>) =>
    setRuns((current) => ({ ...current, [id]: { ...current[id], ...change } }))

  // Busca producto por producto (uno a la vez para no saturar la IA ni el servidor)
  const search = async () => {
    const ids = [...selected]
    setRunning(true)
    setRuns(Object.fromEntries(ids.map((id) => [id, { state: "waiting", groups: [], picks: {} } as ProductRun])))
    for (const id of ids) {
      patchRun(id, { state: "searching" })
      const target = byId.get(id)
      // Solo se buscan los colores que aun no tienen fotos (si el producto ya tiene algunas)
      const colors = target && hasPhotos(target) ? colorsWithoutPhotos(target).map((color) => color.name) : undefined
      try {
        const response = await fetch("/api/admin/ai/find-photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: id, colors }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "No se pudieron buscar las fotos")
        const groups = data.groups as PhotoSearchGroup[]
        patchRun(id, {
          state: "done",
          groups,
          picks: Object.fromEntries(groups.map((group) => [groupKey(group), group.selected])),
        })
      } catch (error) {
        patchRun(id, { state: "error", error: error instanceof Error ? error.message : "No se pudieron buscar las fotos" })
      }
    }
    setRunning(false)
  }

  const togglePick = (id: string, key: string, index: number) =>
    setRuns((current) => {
      const run = current[id]
      const picks = run.picks[key] ?? []
      return {
        ...current,
        [id]: { ...run, picks: { ...run.picks, [key]: picks.includes(index) ? picks.filter((item) => item !== index) : [...picks, index] } },
      }
    })

  // Descarga las fotos elegidas, las guarda en la tienda y las asigna al producto o color
  const save = async (id: string) => {
    const run = runs[id]
    if (!run) return
    patchRun(id, { saving: true, saveErrors: [] })
    let saved = 0
    const errors: string[] = []
    for (const group of run.groups) {
      const picks = run.picks[groupKey(group)] ?? []
      if (!picks.length) continue
      const results = await runLimited(picks, 2, (index) => uploadPhotoFromUrl(group.photos[index].imageUrl))
      const urls = results.flatMap((result) => (result.status === "fulfilled" ? [result.value.url] : []))
      results.forEach((result) => {
        if (result.status === "rejected") errors.push(result.reason instanceof Error ? result.reason.message : "Una foto no se pudo descargar")
      })
      if (!urls.length) continue
      try {
        await assignPhotoUrls({ productId: id, color: group.color, urls, mode: "append" })
        saved += urls.length
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "No se pudieron guardar las fotos")
      }
    }
    patchRun(id, { saving: false, saved, saveErrors: errors })
    onSaved()
  }

  const pendingSaves = Object.entries(runs).filter(
    ([, run]) => run.state === "done" && !run.saving && run.saved === undefined && Object.values(run.picks).some((picks) => picks.length)
  )
  const saveAll = async () => {
    for (const [id] of pendingSaves) await save(id)
  }

  if (!status) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!status.aiReady || !status.searchReady) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <Sparkles className="h-10 w-10 text-brand-blue" />
          <div className="max-w-lg space-y-1">
            <p className="font-medium">Falta configurar la IA</p>
            <p className="text-sm text-muted-foreground">
              Para buscar fotos se necesita una IA con visión (Claude, OpenAI, Gemini u otra) y un buscador de imágenes.
              {!status.aiReady && " La IA no está configurada."}
              {!status.searchReady && " El buscador de imágenes no está configurado."}
            </p>
          </div>
          {isAdmin ? (
            <Button asChild>
              <Link href="/admin/settings?tab=ia">
                <Settings className="mr-2 h-4 w-4" />
                Configurar IA
              </Link>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Pídele al administrador que la configure.</p>
          )}
        </CardContent>
      </Card>
    )
  }

  const runIds = Object.keys(runs)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand-blue" />
            Buscar fotos con IA
          </CardTitle>
          <CardDescription>
            Elige los productos: la IA busca fotos en internet, descarta las de otro modelo o color y propone las mejores
            para cada color. Tú revisas y confirmas antes de guardar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Usa solo fotos que tengas derecho a publicar (por ejemplo, las del fabricante o tu proveedor). Cada color
              de cada producto usa una búsqueda de imágenes y una consulta a la IA ({status.model}), que se cobran según tu
              plan con cada proveedor.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox checked={onlyMissing} onCheckedChange={(checked) => setOnlyMissing(Boolean(checked))} />
                Solo productos o colores sin fotos
              </label>
              <button type="button" onClick={selectVisible} className="text-brand-link hover:underline" disabled={running}>
                Seleccionar los visibles
              </button>
              {selected.size > 0 && (
                <button type="button" onClick={() => setSelected(new Set())} className="text-muted-foreground hover:underline" disabled={running}>
                  Quitar selección
                </button>
              )}
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

          <div className="max-h-72 divide-y overflow-y-auto rounded-lg border">
            {list.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">No hay productos que coincidan.</p>
            ) : (
              list.map((target) => {
                const missing = colorsWithoutPhotos(target)
                const photos = currentPhotos(target)
                return (
                  <label key={target.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                    <Checkbox
                      checked={selected.has(target.id)}
                      onCheckedChange={() => toggle(target.id)}
                      disabled={running || (!selected.has(target.id) && selected.size >= MAX_BATCH)}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {target.sku && <span className="mr-2 font-mono text-xs text-muted-foreground">{target.sku}</span>}
                      {target.name}
                    </span>
                    {photos.length > 0 && (
                      <span className="hidden shrink-0 items-center gap-1 sm:flex">
                        {photos.slice(0, MAX_THUMBS).map((url) => (
                          // Version pequeña generada por el servidor (no la foto completa)
                          <Image
                            key={url}
                            src={url}
                            alt=""
                            width={36}
                            height={36}
                            unoptimized={/^https?:\/\//.test(url)}
                            className="h-9 w-9 rounded border bg-white object-cover"
                          />
                        ))}
                        {photos.length > MAX_THUMBS && (
                          <span className="flex h-9 w-9 items-center justify-center rounded border bg-muted text-[11px] text-muted-foreground">
                            +{photos.length - MAX_THUMBS}
                          </span>
                        )}
                      </span>
                    )}
                    <span className="w-28 shrink-0 text-right text-xs text-muted-foreground">
                      {!hasPhotos(target)
                        ? "Sin fotos"
                        : missing.length
                          ? `${missing.length} ${missing.length === 1 ? "color" : "colores"} sin foto`
                          : "Con fotos"}
                    </span>
                  </label>
                )
              })
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {selected.size} de máximo {MAX_BATCH} productos seleccionados
            </p>
            <Button type="button" onClick={search} disabled={running || selected.size === 0}>
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {running ? "Buscando..." : `Buscar fotos (${selected.size})`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {pendingSaves.length > 1 && !running && (
        <div className="flex justify-end">
          <Button type="button" onClick={saveAll}>
            <Save className="mr-2 h-4 w-4" />
            Guardar las fotos elegidas de {pendingSaves.length} productos
          </Button>
        </div>
      )}

      {runIds.map((id) => {
        const target = byId.get(id)
        const run = runs[id]
        if (!target || !run) return null
        const pickCount = Object.values(run.picks).reduce((total, picks) => total + picks.length, 0)
        return (
          <Card key={id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div className="min-w-0">
                <CardTitle className="truncate text-base">{target.name}</CardTitle>
                <CardDescription>
                  {target.sku && <span className="font-mono">{target.sku} · </span>}
                  {target.brand}
                </CardDescription>
              </div>
              {run.state === "done" &&
                (run.saved !== undefined ? (
                  <span className="flex shrink-0 items-center gap-1 text-sm text-green-700 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4" />
                    {run.saved} {run.saved === 1 ? "foto guardada" : "fotos guardadas"}
                  </span>
                ) : (
                  <Button type="button" size="sm" onClick={() => save(id)} disabled={run.saving || pickCount === 0}>
                    {run.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {run.saving ? "Guardando..." : `Guardar ${pickCount} ${pickCount === 1 ? "foto" : "fotos"}`}
                  </Button>
                ))}
            </CardHeader>
            <CardContent className="space-y-4">
              {run.state === "waiting" && <p className="text-sm text-muted-foreground">En espera...</p>}
              {run.state === "searching" && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando y revisando fotos{target.colors.length > 1 ? ` de ${target.colors.length} colores` : ""}...
                </p>
              )}
              {run.state === "error" && <p className="text-sm text-destructive">{run.error}</p>}
              {run.saveErrors && run.saveErrors.length > 0 && (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Algunas fotos no se pudieron guardar: {[...new Set(run.saveErrors)].join(" · ")}
                </p>
              )}
              {run.groups.map((group) => {
                const key = groupKey(group)
                const picks = run.picks[key] ?? []
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-xs text-brand-link">
                        {group.color ? `Color ${group.color}` : "Fotos del producto"}
                      </span>
                      <span className="text-xs text-muted-foreground">Búsqueda: “{group.query}”</span>
                      {group.photos.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          · La IA eligió {group.selected.length} de {group.photos.length}. Toca una foto para elegirla o quitarla.
                        </span>
                      )}
                    </div>
                    {group.error && <p className="text-sm text-amber-700 dark:text-amber-400">{group.error}</p>}
                    {group.photos.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                        {group.photos.map((photo, index) => (
                          <CandidateTile
                            key={photo.imageUrl}
                            photo={photo}
                            order={picks.indexOf(index)}
                            disabled={run.saving || run.saved !== undefined}
                            onToggle={() => togglePick(id, key, index)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function CandidateTile({
  photo,
  order,
  disabled,
  onToggle,
}: {
  photo: FoundPhoto
  // Posicion entre las elegidas (-1 = no elegida)
  order: number
  disabled?: boolean
  onToggle: () => void
}) {
  const review = photo.review
  const rejected = review && (!review.sameProduct || review.colorMatch === "no")
  const picked = order >= 0
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        title={review?.note}
        className={cn(
          "relative block aspect-square w-full overflow-hidden rounded-lg border-2 bg-white transition",
          picked ? "border-brand-blue ring-2 ring-brand-blue/30" : "border-transparent hover:border-brand-blue/50",
          rejected && !picked && "opacity-45"
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.thumbnailUrl} alt={photo.title ?? ""} className="h-full w-full object-contain" loading="lazy" referrerPolicy="no-referrer" />
        {picked && (
          <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded-full bg-brand-blue px-1.5 py-0.5 text-[10px] font-semibold text-white">
            <Check className="h-3 w-3" />
            {order === 0 ? "Portada" : order + 1}
          </span>
        )}
        {review && (
          <span
            className={cn(
              "absolute right-1 top-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white",
              review.score >= 75 ? "bg-green-600" : review.score >= 50 ? "bg-amber-500" : "bg-red-600"
            )}
          >
            {review.score}
          </span>
        )}
        <QualityBadge width={photo.width} height={photo.height} className="absolute bottom-1 left-1" />
      </button>
      {review && (
        <p className="text-[11px] leading-tight text-muted-foreground">
          {ANGLE_LABELS[review.angle] ?? review.angle}
          {!review.sameProduct && <span className="text-destructive"> · Otro modelo</span>}
          {review.colorMatch === "no" && <span className="text-destructive"> · Otro color</span>}
          {review.watermarkOrText && <span className="text-amber-700 dark:text-amber-400"> · Marca de agua</span>}
          {review.people && <span className="text-amber-700 dark:text-amber-400"> · Personas</span>}
        </p>
      )}
      {photo.pageUrl && (
        <a
          href={photo.pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-0.5 truncate text-[11px] text-brand-link hover:underline"
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          {photo.source ?? new URL(photo.pageUrl).hostname}
        </a>
      )}
    </div>
  )
}
