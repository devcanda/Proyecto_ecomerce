"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  Loader2,
  RotateCcw,
  Sparkles,
  Upload,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Price } from "@/components/ui/price"
import type { ImportItem, ImportPreview, ImportResult } from "@/lib/product-import"
import { assignPhotoUrls, runLimited, uploadPhotoFromUrl } from "@/lib/photo-upload-client"
import { cn } from "@/lib/utils"

type Filter = "all" | "error" | "ok"

const STATUS = {
  ok: { label: "Listo", icon: CheckCircle2, className: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300" },
  warning: { label: "Con aviso", icon: AlertTriangle, className: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  error: { label: "Con error", icon: XCircle, className: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300" },
} as const

export default function ImportProductsPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [checking, setChecking] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [filter, setFilter] = useState<Filter>("all")

  const send = async (url: string, selected: File) => {
    const formData = new FormData()
    formData.append("file", selected)
    const response = await fetch(url, { method: "POST", body: formData })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || "No se pudo procesar el archivo")
    return data
  }

  // Revisa el archivo apenas se elige (no guarda nada)
  const chooseFile = async (selected: File | undefined) => {
    if (!selected) return
    setFile(selected)
    setPreview(null)
    setResult(null)
    setError(null)
    setFilter("all")
    setChecking(true)
    try {
      setPreview(await send("/api/admin/import/preview", selected))
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo revisar el archivo")
    } finally {
      setChecking(false)
    }
  }

  const handleImport = async () => {
    if (!file) return
    setImporting(true)
    setError(null)
    try {
      setResult(await send("/api/admin/import/commit", file))
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo importar")
    } finally {
      setImporting(false)
    }
  }

  const reset = () => {
    setFile(null)
    setPreview(null)
    setResult(null)
    setError(null)
  }

  const readyCount = preview ? preview.summary.create + preview.summary.update : 0
  const visibleItems =
    preview?.items.filter((item) =>
      filter === "all" ? true : filter === "error" ? item.status === "error" : item.status !== "error"
    ) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/products">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Carga masiva de productos</h1>
          <p className="text-muted-foreground">Crea o actualiza muchos productos a la vez desde un archivo de Excel</p>
        </div>
      </div>

      {result ? (
        <ResultCard result={result} onReset={reset} />
      ) : (
        <>
          {/* Paso 1 */}
          <Card>
            <CardHeader>
              <CardTitle>1. Descarga la plantilla</CardTitle>
              <CardDescription>Llénala en Excel. Trae instrucciones, un ejemplo y listas desplegables.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Button asChild variant="outline" className="shrink-0">
                <a href="/api/admin/import/template" download>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar plantilla
                </a>
              </Button>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• <b className="text-foreground">Producto simple:</b> una fila.</li>
                <li>• <b className="text-foreground">Producto variable:</b> una fila por cada color/talla, con la misma <b className="text-foreground">Referencia</b>.</li>
                <li>• Las fotos se agregan después. Si la Referencia ya existe, ese producto se actualiza.</li>
              </ul>
            </CardContent>
          </Card>

          {/* Paso 2 */}
          <Card>
            <CardHeader>
              <CardTitle>2. Sube el archivo</CardTitle>
              <CardDescription>Excel (.xlsx) o CSV, máximo 5 MB. Primero se revisa: todavía no se guarda nada.</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                onDragEnter={(event) => {
                  event.preventDefault()
                  setDragActive(true)
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setDragActive(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragActive(false)
                  chooseFile(event.dataTransfer.files?.[0])
                }}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
                  dragActive ? "border-brand-blue bg-brand-blue/5" : "border-neutral-300 hover:border-brand-blue/60 dark:border-input"
                )}
              >
                {checking ? (
                  <Loader2 className="h-10 w-10 animate-spin text-brand-link" />
                ) : (
                  <FileSpreadsheet className="h-10 w-10 text-brand-link" />
                )}
                {file ? (
                  <>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {checking ? "Revisando el archivo..." : "Toca para elegir otro archivo"}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">Arrastra el archivo aquí o haz clic para seleccionarlo</p>
                    <p className="text-xs text-muted-foreground">Se revisa automáticamente al elegirlo</p>
                  </>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  className="hidden"
                  onChange={(event) => {
                    chooseFile(event.target.files?.[0])
                    event.target.value = ""
                  }}
                />
              </div>
              {error && (
                <p className="mt-3 flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Paso 3 */}
          {preview && (
            <Card>
              <CardHeader>
                <CardTitle>3. Revisa y confirma</CardTitle>
                <CardDescription>
                  Los productos con error no se importan: corrígelos en el Excel y vuelve a subirlo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {preview.fileErrors.length > 0 && (
                  <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    {preview.fileErrors.map((text) => (
                      <p key={text}>⚠ {text}</p>
                    ))}
                  </div>
                )}

                {/* Resumen */}
                <div className="grid gap-3 sm:grid-cols-4">
                  <SummaryTile label="Productos en el archivo" value={preview.summary.products} hint={`${preview.summary.rows} filas`} />
                  <SummaryTile label="Se crearán" value={preview.summary.create} tone="green" />
                  <SummaryTile label="Se actualizarán" value={preview.summary.update} tone="blue" />
                  <SummaryTile label="Con errores" value={preview.summary.withErrors} tone={preview.summary.withErrors ? "red" : undefined} />
                </div>
                {preview.summary.create > 0 && (
                  <p className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-link" />
                    Los productos nuevos quedan sin fotos: la tienda mostrará &quot;Foto próximamente&quot; hasta que
                    las subas desde Editar.
                  </p>
                )}
                {(preview.summary.newCategories.length > 0 || preview.summary.newBrands.length > 0) && (
                  <p className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-link" />
                    <span>
                      Se crearán automáticamente
                      {preview.summary.newCategories.length > 0 && (
                        <> las categorías <b className="text-foreground">{preview.summary.newCategories.join(", ")}</b></>
                      )}
                      {preview.summary.newCategories.length > 0 && preview.summary.newBrands.length > 0 && " y"}
                      {preview.summary.newBrands.length > 0 && (
                        <> las marcas <b className="text-foreground">{preview.summary.newBrands.join(", ")}</b></>
                      )}
                      .
                    </span>
                  </p>
                )}

                {/* Filtro */}
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { value: "all", label: `Todos (${preview.items.length})` },
                      { value: "error", label: `Con errores (${preview.summary.withErrors})` },
                      { value: "ok", label: `Listos (${readyCount})` },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFilter(option.value)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                        filter === option.value
                          ? "border-brand-blue bg-brand-blue/10 text-brand-link"
                          : "border-neutral-300 text-muted-foreground hover:border-brand-blue/60 dark:border-input"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {/* Detalle por producto */}
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Fila(s)</th>
                        <th className="px-3 py-2 font-medium">Producto</th>
                        <th className="px-3 py-2 font-medium">Acción</th>
                        <th className="px-3 py-2 font-medium">Variantes</th>
                        <th className="px-3 py-2 font-medium">Stock</th>
                        <th className="px-3 py-2 font-medium">Precio</th>
                        <th className="px-3 py-2 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleItems.map((item, index) => (
                        <ItemRow key={`${item.sku}-${index}`} item={item} />
                      ))}
                      {visibleItems.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                            No hay productos en este filtro.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={handleImport} disabled={importing || readyCount === 0}>
                    {importing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Importar {readyCount} {readyCount === 1 ? "producto" : "productos"}
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={importing}>
                    <RotateCcw className="mr-2 h-4 w-4" /> Subir otro archivo
                  </Button>
                  {preview.summary.withErrors > 0 && readyCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {preview.summary.withErrors} con errores no se importarán.
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function SummaryTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: number
  hint?: string
  tone?: "green" | "blue" | "red"
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-2xl font-bold",
          tone === "green" && "text-green-700 dark:text-green-400",
          tone === "blue" && "text-brand-link",
          tone === "red" && "text-destructive"
        )}
      >
        {value}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function ItemRow({ item }: { item: ImportItem }) {
  const status = STATUS[item.status]
  const StatusIcon = status.icon
  return (
    <tr className="border-t align-top">
      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{item.rows.join(", ")}</td>
      <td className="px-3 py-2">
        <p className="font-medium">{item.name}</p>
        <p className="text-xs text-muted-foreground">
          {item.sku || "sin referencia"}
          {item.category && ` · ${item.category}`}
          {item.brand && ` · ${item.brand}`}
        </p>
        {item.messages.length > 0 && (
          <ul className="mt-1.5 space-y-0.5 text-xs">
            {item.messages.map((message, index) => (
              <li
                key={index}
                className={cn(
                  message.type === "error" && "text-destructive",
                  message.type === "warning" && "text-amber-700 dark:text-amber-400",
                  message.type === "info" && "text-muted-foreground"
                )}
              >
                {message.type === "error" ? "✕" : message.type === "warning" ? "⚠" : "•"}{" "}
                {message.row ? `Fila ${message.row}: ` : ""}
                {message.text}
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="px-3 py-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            item.action === "create" ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300" : "bg-brand-blue/10 text-brand-link"
          )}
        >
          {item.action === "create" ? "Nuevo" : "Actualizar"}
        </span>
      </td>
      <td className="px-3 py-2 text-muted-foreground">{item.isVariable ? item.variantCount : "Simple"}</td>
      <td className="px-3 py-2">
        {item.availability === "SUPPLIER" ? (
          <span className="text-green-700 dark:text-green-400">Proveedor</span>
        ) : item.availability === "PREORDER" ? (
          <span className="text-brand-link">Bajo pedido</span>
        ) : (
          item.stock
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2">{item.price ? <Price amount={item.price} /> : "—"}</td>
      <td className="px-3 py-2">
        <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", status.className)}>
          <StatusIcon className="h-3.5 w-3.5" />
          {status.label}
        </span>
      </td>
    </tr>
  )
}

function ResultCard({ result, onReset }: { result: ImportResult; onReset: () => void }) {
  return (
    <Card>
      <CardContent className="space-y-5 py-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
        <div>
          <h2 className="text-xl font-bold">Importación terminada</h2>
          <p className="mt-1 text-muted-foreground">
            {result.created} {result.created === 1 ? "producto creado" : "productos creados"} y {result.updated}{" "}
            {result.updated === 1 ? "actualizado" : "actualizados"}.
            {(result.newCategories > 0 || result.newBrands > 0) &&
              ` Se crearon ${result.newCategories} categorías y ${result.newBrands} marcas nuevas.`}
          </p>
          {result.skipped > 0 && (
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
              {result.skipped} {result.skipped === 1 ? "producto con errores no se importó" : "productos con errores no se importaron"}.
            </p>
          )}
          {result.failed.length > 0 && (
            <ul className="mx-auto mt-2 max-w-md text-left text-sm text-destructive">
              {result.failed.map((item) => (
                <li key={item.sku}>
                  ✕ {item.sku} ({item.name}): {item.error}
                </li>
              ))}
            </ul>
          )}
        </div>
        {result.photoJobs.length > 0 && <PhotoJobs jobs={result.photoJobs} />}
        {result.createdIds.length > 0 && (
          <div className="mx-auto max-w-md space-y-2 text-sm text-muted-foreground">
            <p>
              Los productos que queden sin foto se pueden completar en <b>Fotos masivas</b>: por nombre de archivo, arrastrando
              fotos o buscándolas con IA.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/products/photos?tab=ia&ids=${result.createdIds.slice(0, 25).join(",")}`}>
                <Sparkles className="mr-2 h-4 w-4" />
                Buscar fotos con IA para los productos nuevos
              </Link>
            </Button>
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/admin/products">Ver productos</Link>
          </Button>
          <Button variant="outline" onClick={onReset}>
            Cargar otro archivo
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Descarga las fotos de la columna Fotos despues de importar (una por una, con avance visible)
function PhotoJobs({ jobs }: { jobs: ImportResult["photoJobs"] }) {
  const total = jobs.reduce((sum, job) => sum + job.urls.length, 0)
  const [done, setDone] = useState(0)
  const [finished, setFinished] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    ;(async () => {
      for (const job of jobs) {
        const results = await runLimited(job.urls, 2, async (url) => {
          try {
            return (await uploadPhotoFromUrl(url)).url
          } finally {
            setDone((current) => current + 1)
          }
        })
        const urls = results.flatMap((item) => (item.status === "fulfilled" ? [item.value] : []))
        const failed = results.flatMap((item, index) =>
          item.status === "rejected" ? [`${job.sku}${job.color ? ` (${job.color})` : ""}: ${item.reason instanceof Error ? item.reason.message : "error"} - ${job.urls[index]}`] : []
        )
        if (urls.length) {
          try {
            // Las fotos del Excel reemplazan las anteriores de ese producto o color
            await assignPhotoUrls({ productId: job.productId, color: job.color, urls, mode: "replace" })
          } catch (error) {
            failed.push(`${job.sku}: ${error instanceof Error ? error.message : "no se pudieron guardar las fotos"}`)
          }
        }
        if (failed.length) setErrors((current) => [...current, ...failed])
      }
      setFinished(true)
    })()
  }, [jobs])

  return (
    <div className="mx-auto max-w-md space-y-2 text-left text-sm">
      <p className="flex items-center gap-2 font-medium">
        {finished ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Loader2 className="h-4 w-4 animate-spin" />}
        {finished
          ? `Fotos descargadas: ${total - errors.length} de ${total}`
          : `Descargando fotos de los enlaces: ${done} de ${total}... (no cierres esta página)`}
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-brand-blue transition-all" style={{ width: `${total ? (done / total) * 100 : 100}%` }} />
      </div>
      {errors.length > 0 && (
        <details className="text-xs text-amber-700 dark:text-amber-400">
          <summary className="cursor-pointer">{errors.length} {errors.length === 1 ? "foto no se pudo descargar" : "fotos no se pudieron descargar"}</summary>
          <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto break-all">
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
