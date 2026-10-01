"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { ChevronDown, Copy, ImagePlus, Loader2, Palette, Plus, RotateCcw, Ruler, Star, Trash2, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { PriceInput } from "@/components/admin/PriceInput"
import { CLOTHING_SIZES, FOOTWEAR_SIZES } from "@/lib/category-type"
import { formatAmount } from "@/lib/format"
import { cn } from "@/lib/utils"

export interface VariantRow {
  id?: string
  size: string
  color: string
  // undefined = usa el precio del producto
  price?: number
  stock: number
  // Fotos del color: la primera es la portada (iguales en todas las tallas de ese color)
  images?: string[]
}

interface VariantsEditorProps {
  variantType: "FOOTWEAR" | "CLOTHING"
  value: VariantRow[]
  // problem: texto a mostrar si falta completar algo (null si todo esta bien)
  onChange: (rows: VariantRow[], problem: string | null) => void
  basePrice?: number
  fieldClassName?: string
}

// Una talla dentro de un color
interface SizeRow {
  id?: string
  size: string
  price?: number
  stock: number
}

// Un color con su foto y sus tallas (en modo "solo tallas" hay un unico grupo sin nombre)
interface ColorGroup {
  uid: string
  color: string
  images: string[]
  sizes: SizeRow[]
}

// Maximo de fotos por color (igual que en el servidor)
const MAX_COLOR_IMAGES = 8

type Mode = "colors" | "sizes"

let uidCounter = 0
const newUid = () => `color-${++uidCounter}`

function toGroups(rows: VariantRow[]): ColorGroup[] {
  const groups: ColorGroup[] = []
  for (const row of rows) {
    let group = groups.find((item) => item.color === row.color)
    if (!group) {
      group = { uid: newUid(), color: row.color, images: row.images ?? [], sizes: [] }
      groups.push(group)
    }
    if (group.images.length === 0 && row.images?.length) group.images = row.images
    if (row.size) group.sizes.push({ id: row.id, size: row.size, price: row.price, stock: row.stock })
  }
  return groups
}

function toRows(groups: ColorGroup[], mode: Mode): VariantRow[] {
  return groups.flatMap((group) =>
    group.sizes.map((size) => ({
      id: size.id,
      size: size.size,
      color: mode === "colors" ? group.color.trim() : "",
      price: size.price,
      stock: size.stock,
      images: mode === "colors" ? group.images : [],
    }))
  )
}

// Revisa que no falte nada antes de guardar
function findProblem(groups: ColorGroup[], mode: Mode): string | null {
  if (mode === "colors") {
    if (groups.length === 0) return "Agrega al menos un color con sus tallas."
    if (groups.some((group) => !group.color.trim())) return "Escribe el nombre de cada color."
    const names = groups.map((group) => group.color.trim().toLowerCase())
    if (new Set(names).size !== names.length) return "Hay colores con el mismo nombre."
    const empty = groups.find((group) => group.sizes.length === 0)
    if (empty) return `El color "${empty.color.trim()}" no tiene tallas.`
    return null
  }
  if (!groups[0] || groups[0].sizes.length === 0) return "Elige al menos una talla."
  return null
}

export function VariantsEditor({ variantType, value, onChange, basePrice, fieldClassName }: VariantsEditorProps) {
  const presets = variantType === "FOOTWEAR" ? FOOTWEAR_SIZES : CLOTHING_SIZES
  const [mode, setMode] = useState<Mode>(() =>
    value.length > 0 && value.every((row) => !row.color) ? "sizes" : "colors"
  )
  const [groups, setGroups] = useState<ColorGroup[]>(() => {
    const initial = toGroups(value)
    if (initial.length > 0) return initial
    // Producto nuevo: se empieza con un color vacio listo para llenar
    return [{ uid: newUid(), color: "", images: [], sizes: [] }]
  })
  // Selector de tallas abierto (en tarjetas nuevas o sin tallas)
  const [openPicker, setOpenPicker] = useState<string | null>(
    () => groups.find((group) => group.sizes.length === 0)?.uid ?? null
  )

  // Ultima version de los colores (para las subidas de fotos, que terminan despues)
  const groupsRef = useRef(groups)

  const emit = (nextGroups: ColorGroup[], nextMode: Mode = mode) => {
    groupsRef.current = nextGroups
    setGroups(nextGroups)
    onChange(toRows(nextGroups, nextMode), findProblem(nextGroups, nextMode))
  }

  const updateGroup = (uid: string, patch: Partial<ColorGroup>) =>
    emit(groupsRef.current.map((group) => (group.uid === uid ? { ...group, ...patch } : group)))

  // Agrega fotos recien subidas sin pisar lo que se edito mientras subian
  const appendImages = (uid: string, urls: string[]) =>
    emit(
      groupsRef.current.map((group) =>
        group.uid === uid
          ? { ...group, images: [...new Set([...group.images, ...urls])].slice(0, MAX_COLOR_IMAGES) }
          : group
      )
    )

  const sortSizes = (list: SizeRow[]) =>
    [...list].sort((a, b) => {
      const ia = presets.indexOf(a.size)
      const ib = presets.indexOf(b.size)
      if (ia !== -1 && ib !== -1) return ia - ib
      if (ia !== -1) return -1
      if (ib !== -1) return 1
      return a.size.localeCompare(b.size, "es", { numeric: true })
    })

  const toggleSize = (group: ColorGroup, size: string) => {
    const exists = group.sizes.some((row) => row.size === size)
    updateGroup(group.uid, {
      sizes: exists ? group.sizes.filter((row) => row.size !== size) : sortSizes([...group.sizes, { size, stock: 0 }]),
    })
  }

  const updateSize = (group: ColorGroup, size: string, patch: Partial<SizeRow>) =>
    updateGroup(group.uid, {
      sizes: group.sizes.map((row) => (row.size === size ? { ...row, ...patch } : row)),
    })

  const addColor = () => {
    const group: ColorGroup = { uid: newUid(), color: "", images: [], sizes: [] }
    emit([...groups, group])
    setOpenPicker(group.uid)
  }

  const removeColor = (uid: string) => emit(groups.filter((group) => group.uid !== uid))

  const copySizes = (target: ColorGroup, source: ColorGroup) =>
    updateGroup(target.uid, { sizes: source.sizes.map((row) => ({ size: row.size, stock: 0 })) })

  const changeMode = (nextMode: Mode) => {
    if (nextMode === mode) return
    setMode(nextMode)
    if (nextMode === "sizes") {
      // Se conservan las tallas del primer color
      const first = groups[0] ?? { uid: newUid(), color: "", images: [], sizes: [] }
      emit([{ ...first, color: "", images: [] }], nextMode)
      if (first.sizes.length === 0) setOpenPicker(first.uid)
    } else {
      emit(groups.length ? groups : [{ uid: newUid(), color: "", images: [], sizes: [] }], nextMode)
    }
  }

  const totalStock = groups.reduce(
    (total, group) => total + group.sizes.reduce((sum, row) => sum + (row.stock || 0), 0),
    0
  )
  const problem = findProblem(groups, mode)

  return (
    <div className="space-y-5">
      {/* Como se vende */}
      <div className="space-y-2">
        <p className="text-sm font-medium">¿Cómo se vende este producto?</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              {
                value: "colors",
                icon: Palette,
                title: "Por colores y tallas",
                hint: "Ej. un tenis en negro y en blanco",
              },
              { value: "sizes", icon: Ruler, title: "Solo por tallas", hint: "Un solo color, varias tallas" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => changeMode(option.value)}
              aria-pressed={mode === option.value}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                mode === option.value
                  ? "border-brand-blue bg-brand-blue/10"
                  : "border-neutral-300 hover:border-brand-blue/60 dark:border-input"
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  mode === option.value ? "bg-brand-blue text-white" : "bg-muted text-muted-foreground"
                )}
              >
                <option.icon className="h-[18px] w-[18px]" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{option.title}</span>
                <span className="block text-xs text-muted-foreground">{option.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Pasos */}
      <ol className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        {mode === "colors" && (
          <li>
            <b className="text-brand-link">1.</b> Agrega el color y sus fotos
          </li>
        )}
        <li>
          <b className="text-brand-link">{mode === "colors" ? "2." : "1."}</b> Elige las tallas
        </li>
        <li>
          <b className="text-brand-link">{mode === "colors" ? "3." : "2."}</b> Revisa precio y stock (el precio del
          producto se usa por defecto)
        </li>
      </ol>

      {/* Tarjetas de color */}
      <div className="space-y-4">
        {groups.map((group, index) => {
          const groupStock = group.sizes.reduce((sum, row) => sum + (row.stock || 0), 0)
          const previous = groups
            .slice(0, index)
            .reverse()
            .find((item) => item.sizes.length > 0)
          const pickerOpen = openPicker === group.uid

          return (
            <div key={group.uid} className="overflow-hidden rounded-xl border border-neutral-300 dark:border-input">
              {/* Encabezado del color */}
              {mode === "colors" && (
                <div className="space-y-3 border-b bg-muted/40 p-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-40 flex-1 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground" htmlFor={`${group.uid}-name`}>
                        Nombre del color
                      </label>
                      <Input
                        id={`${group.uid}-name`}
                        value={group.color}
                        onChange={(event) => updateGroup(group.uid, { color: event.target.value })}
                        placeholder="Ej. Negro / Blanco"
                        className={cn("h-9 bg-background font-medium", fieldClassName)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground">
                        {group.sizes.length} {group.sizes.length === 1 ? "talla" : "tallas"} · {groupStock} und.
                      </span>
                      {groups.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeColor(group.uid)}
                          className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Eliminar color {group.color}</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <ColorPhotos
                    images={group.images}
                    label={group.color || "este color"}
                    onChange={(images) => updateGroup(group.uid, { images })}
                    onAppend={(urls) => appendImages(group.uid, urls)}
                  />
                </div>
              )}

              <div className="space-y-3 p-3">
                {/* Tallas elegidas + boton para elegir */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{variantType === "FOOTWEAR" ? "Tallas (COL)" : "Tallas"}</span>
                  <button
                    type="button"
                    onClick={() => setOpenPicker(pickerOpen ? null : group.uid)}
                    className="flex items-center gap-1 rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium hover:bg-muted dark:border-input"
                  >
                    {pickerOpen ? "Listo" : group.sizes.length ? "Cambiar tallas" : "Elegir tallas"}
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", pickerOpen && "rotate-180")} />
                  </button>
                  {previous && group.sizes.length === 0 && (
                    <button
                      type="button"
                      onClick={() => copySizes(group, previous)}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-link hover:bg-brand-blue/10"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Usar las mismas tallas de {previous.color || "el color anterior"}
                    </button>
                  )}
                </div>

                {pickerOpen && (
                  <SizePicker
                    presets={presets}
                    selected={group.sizes.map((row) => row.size)}
                    onToggle={(size) => toggleSize(group, size)}
                    fieldClassName={fieldClassName}
                  />
                )}

                {/* Precio y stock por talla */}
                {group.sizes.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Talla</th>
                          <th className="px-3 py-2 font-medium">Precio (COP)</th>
                          <th className="px-3 py-2 font-medium">Stock</th>
                          <th className="w-10 px-2 py-2">
                            <span className="sr-only">Quitar</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.sizes.map((row) => (
                          <tr key={row.size} className="border-t">
                            <td className="px-3 py-2">
                              <span className="inline-flex min-w-10 justify-center rounded-md bg-muted px-2 py-1 font-semibold">
                                {row.size}
                              </span>
                            </td>
                            <td className="px-3 py-1.5">
                              <div className="flex items-center gap-2">
                                <PriceInput
                                  value={row.price}
                                  onChange={(price) => updateSize(group, row.size, { price })}
                                  placeholder={basePrice ? formatAmount(basePrice) : "Precio del producto"}
                                  className={cn("h-8 w-32", fieldClassName)}
                                  aria-label={`Precio talla ${row.size}`}
                                />
                                {row.price === undefined ? (
                                  <span className="whitespace-nowrap text-xs text-muted-foreground">Precio base</span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => updateSize(group, row.size, { price: undefined })}
                                    className="flex items-center gap-1 whitespace-nowrap text-xs font-medium text-brand-link hover:underline"
                                  >
                                    <RotateCcw className="h-3 w-3" /> Usar precio base
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-1.5">
                              <Input
                                type="number"
                                min={0}
                                value={row.stock}
                                onFocus={(event) => event.target.select()}
                                onChange={(event) =>
                                  updateSize(group, row.size, {
                                    stock: Math.max(0, Math.floor(Number(event.target.value) || 0)),
                                  })
                                }
                                className={cn("h-8 w-20", fieldClassName)}
                                aria-label={`Stock talla ${row.size}`}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <button
                                type="button"
                                onClick={() => toggleSize(group, row.size)}
                                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              >
                                <X className="h-4 w-4" />
                                <span className="sr-only">Quitar talla {row.size}</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  !pickerOpen && (
                    <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                      Aún no hay tallas. Toca &quot;Elegir tallas&quot;.
                    </p>
                  )
                )}

                {group.sizes.length > 1 && (
                  <BulkStock
                    onApply={(stock) =>
                      updateGroup(group.uid, { sizes: group.sizes.map((row) => ({ ...row, stock })) })
                    }
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {mode === "colors" && (
        <button
          type="button"
          onClick={addColor}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-blue/40 py-3 text-sm font-semibold text-brand-link transition-colors hover:border-brand-blue hover:bg-brand-blue/5"
        >
          <Plus className="h-4 w-4" /> Agregar otro color
        </button>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/60 px-4 py-3 text-sm">
        <span>
          Stock total del producto: <b>{totalStock}</b> {totalStock === 1 ? "unidad" : "unidades"}
        </span>
        {problem && <span className="text-xs font-medium text-amber-700 dark:text-amber-400">⚠ {problem}</span>}
      </div>
    </div>
  )
}

// Cuadricula de tallas para marcar/desmarcar, con opcion de agregar una talla distinta
function SizePicker({
  presets,
  selected,
  onToggle,
  fieldClassName,
}: {
  presets: string[]
  selected: string[]
  onToggle: (size: string) => void
  fieldClassName?: string
}) {
  const [custom, setCustom] = useState("")
  const extra = selected.filter((size) => !presets.includes(size))

  const addCustom = () => {
    const size = custom.trim().replace(",", ".")
    if (size && !selected.includes(size)) onToggle(size)
    setCustom("")
  }

  return (
    <div className="space-y-3 rounded-lg bg-muted/40 p-3">
      <div className="flex flex-wrap gap-1.5">
        {[...presets, ...extra].map((size) => {
          const active = selected.includes(size)
          return (
            <button
              key={size}
              type="button"
              onClick={() => onToggle(size)}
              aria-pressed={active}
              className={cn(
                "min-w-11 rounded-md border px-2.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-brand-blue bg-brand-blue text-white"
                  : "border-neutral-300 bg-background hover:border-brand-blue/60 dark:border-input"
              )}
            >
              {size}
            </button>
          )
        })}
      </div>
      <div className="flex max-w-xs gap-2">
        <Input
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              addCustom()
            }
          }}
          placeholder="Otra talla (ej. 46.5)"
          className={cn("h-8 bg-background", fieldClassName)}
        />
        <button
          type="button"
          onClick={addCustom}
          className="flex h-8 shrink-0 items-center gap-1 rounded-md border border-neutral-300 bg-background px-3 text-xs font-medium hover:bg-muted dark:border-input"
        >
          <Plus className="h-3.5 w-3.5" /> Añadir
        </button>
      </div>
    </div>
  )
}

// Pone el mismo stock en todas las tallas del color
function BulkStock({ onApply }: { onApply: (stock: number) => void }) {
  const [stock, setStock] = useState("")
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>Mismo stock para todas las tallas:</span>
      <Input
        type="number"
        min={0}
        value={stock}
        onChange={(event) => setStock(event.target.value)}
        className="h-7 w-20 text-xs"
        aria-label="Stock para todas las tallas"
      />
      <button
        type="button"
        disabled={stock === ""}
        onClick={() => {
          onApply(Math.max(0, Math.floor(Number(stock) || 0)))
          setStock("")
        }}
        className="rounded-md border border-neutral-300 px-2 py-1 font-medium text-foreground hover:bg-muted disabled:opacity-50 dark:border-input"
      >
        Aplicar
      </button>
    </div>
  )
}

// Fotos de un color: la primera es la portada; las demas son otros angulos
function ColorPhotos({
  images,
  label,
  onChange,
  onAppend,
}: {
  images: string[]
  label: string
  onChange: (images: string[]) => void
  onAppend: (urls: string[]) => void
}) {
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const remaining = MAX_COLOR_IMAGES - images.length

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const selected = Array.from(files).slice(0, Math.max(0, remaining))
    if (selected.length === 0) return
    setUploading(selected.length)
    setError(null)

    const results = await Promise.allSettled(
      selected.map(async (file) => {
        const formData = new FormData()
        formData.append("file", file)
        const response = await fetch("/api/upload", { method: "POST", body: formData })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "No se pudo subir la foto")
        return data.url as string
      })
    )
    const uploaded = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))
    if (uploaded.length) onAppend(uploaded)
    const failed = results.length - uploaded.length
    if (failed) setError(failed === 1 ? "Una foto no se pudo subir." : `${failed} fotos no se pudieron subir.`)
    setUploading(0)
  }

  const remove = (index: number) => onChange(images.filter((_, i) => i !== index))

  // La foto elegida pasa al primer lugar (portada)
  const makeCover = (index: number) => onChange([images[index], ...images.filter((_, i) => i !== index)])

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          Fotos de este color <span className="font-normal">(opcional · la primera es la portada)</span>
        </p>
        <span className="text-[11px] text-muted-foreground">
          {images.length}/{MAX_COLOR_IMAGES}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {images.map((image, index) => (
          <div
            key={image}
            className={cn(
              "group relative h-20 w-20 overflow-hidden rounded-lg border bg-background",
              index === 0 ? "border-2 border-brand-blue" : "border-neutral-300 dark:border-input"
            )}
          >
            <Image src={image} alt={`Foto ${index + 1} color ${label}`} fill sizes="80px" className="object-cover" />
            {index === 0 ? (
              <span className="absolute inset-x-0 bottom-0 bg-brand-blue py-0.5 text-center text-[10px] font-semibold text-white">
                Portada
              </span>
            ) : (
              <button
                type="button"
                onClick={() => makeCover(index)}
                className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-black/60 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Star className="h-2.5 w-2.5" /> Portada
              </button>
            )}
            <button
              type="button"
              onClick={() => remove(index)}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
            >
              <X className="h-3 w-3" />
              <span className="sr-only">Quitar foto {index + 1}</span>
            </button>
          </div>
        ))}

        {remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading > 0}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-neutral-300 bg-background text-[11px] font-medium leading-tight text-muted-foreground transition-colors hover:border-brand-blue hover:text-brand-link dark:border-input"
          >
            {uploading > 0 ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            {uploading > 0 ? "Subiendo..." : images.length ? "Agregar más" : "Agregar fotos"}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          handleFiles(event.target.files)
          event.target.value = ""
        }}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
