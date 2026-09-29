"use client"

import { useState } from "react"
import { Plus, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
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
}

interface VariantsEditorProps {
  variantType: "FOOTWEAR" | "CLOTHING"
  value: VariantRow[]
  onChange: (rows: VariantRow[]) => void
  basePrice?: number
  fieldClassName?: string
}

const keyOf = (size: string, color: string) => `${size}|${color}`

const unique = (items: string[]) => [...new Set(items.filter(Boolean))]

export function VariantsEditor({
  variantType,
  value,
  onChange,
  basePrice,
  fieldClassName,
}: VariantsEditorProps) {
  const presets = variantType === "FOOTWEAR" ? FOOTWEAR_SIZES : CLOTHING_SIZES
  const [customSize, setCustomSize] = useState("")
  const [newColor, setNewColor] = useState("")
  const [priceVaries, setPriceVaries] = useState(() => value.some((row) => row.price !== undefined))

  const sizes = unique(value.map((row) => row.size))
  const colors = unique(value.map((row) => row.color))

  // Orden de tallas: numerico en calzado, el de la lista en ropa; las personalizadas al final
  const sortSizes = (list: string[]) =>
    [...list].sort((a, b) => {
      const ia = presets.indexOf(a)
      const ib = presets.indexOf(b)
      if (ia !== -1 && ib !== -1) return ia - ib
      if (ia !== -1) return -1
      if (ib !== -1) return 1
      return a.localeCompare(b, "es", { numeric: true })
    })

  // Vuelve a armar las filas (talla x color) conservando lo ya escrito en cada combinacion
  const rebuild = (nextSizes: string[], nextColors: string[]) => {
    const previous = new Map(value.map((row) => [keyOf(row.size, row.color), row]))
    const sizeList = nextSizes.length ? sortSizes(nextSizes) : [""]
    const colorList = nextColors.length ? nextColors : [""]
    const rows: VariantRow[] = []
    for (const size of sizeList) {
      for (const color of colorList) {
        if (!size && !color) continue
        rows.push(previous.get(keyOf(size, color)) ?? { size, color, stock: 0 })
      }
    }
    onChange(rows)
  }

  const toggleSize = (size: string) =>
    rebuild(sizes.includes(size) ? sizes.filter((s) => s !== size) : [...sizes, size], colors)

  const addCustomSize = () => {
    const size = customSize.trim().replace(",", ".")
    if (size && !sizes.includes(size)) rebuild([...sizes, size], colors)
    setCustomSize("")
  }

  const addColor = () => {
    const color = newColor.trim()
    const exists = colors.some((c) => c.toLowerCase() === color.toLowerCase())
    if (color && !exists) rebuild(sizes, [...colors, color])
    setNewColor("")
  }

  const removeColor = (color: string) => rebuild(sizes, colors.filter((c) => c !== color))

  const updateRow = (index: number, patch: Partial<VariantRow>) =>
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  const handlePriceVaries = (checked: boolean) => {
    setPriceVaries(checked)
    // Al desmarcar, todas las variantes vuelven a usar el precio del producto
    if (!checked) onChange(value.map((row) => ({ ...row, price: undefined })))
  }

  const totalStock = value.reduce((total, row) => total + (row.stock || 0), 0)
  const extraSizes = sizes.filter((size) => !presets.includes(size))

  return (
    <div className="space-y-6">
      {/* Tallas */}
      <div className="space-y-3">
        <div>
          <Label>{variantType === "FOOTWEAR" ? "Tallas (COL)" : "Tallas"}</Label>
          <p className="text-xs text-muted-foreground">Toca las tallas que tienes disponibles.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[...presets, ...extraSizes].map((size) => {
            const active = sizes.includes(size)
            return (
              <button
                key={size}
                type="button"
                onClick={() => toggleSize(size)}
                aria-pressed={active}
                className={cn(
                  "min-w-12 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "border-brand-blue bg-brand-blue/10 text-brand-link"
                    : "border-neutral-300 bg-background text-muted-foreground hover:border-brand-blue/60 dark:border-input"
                )}
              >
                {size}
              </button>
            )
          })}
        </div>
        <div className="flex max-w-xs gap-2">
          <Input
            value={customSize}
            onChange={(event) => setCustomSize(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                addCustomSize()
              }
            }}
            placeholder="Otra talla (ej. 46.5)"
            className={cn("h-9", fieldClassName)}
          />
          <button
            type="button"
            onClick={addCustomSize}
            className="flex h-9 shrink-0 items-center gap-1 rounded-md border border-neutral-300 px-3 text-sm font-medium hover:bg-muted dark:border-input"
          >
            <Plus className="h-4 w-4" /> Añadir
          </button>
        </div>
      </div>

      {/* Colores */}
      <div className="space-y-3">
        <div>
          <Label>
            Colores <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <p className="text-xs text-muted-foreground">
            Agrega los colores solo si el producto se vende en varios.
          </p>
        </div>
        {colors.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {colors.map((color) => (
              <span
                key={color}
                className="flex items-center gap-1 rounded-full border border-brand-blue/40 bg-brand-blue/10 py-1 pl-3 pr-1.5 text-sm text-brand-link"
              >
                {color}
                <button
                  type="button"
                  onClick={() => removeColor(color)}
                  className="rounded-full p-0.5 hover:bg-brand-blue/20"
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Quitar color {color}</span>
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex max-w-xs gap-2">
          <Input
            value={newColor}
            onChange={(event) => setNewColor(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                addColor()
              }
            }}
            placeholder="Ej. Negro / Blanco"
            className={cn("h-9", fieldClassName)}
          />
          <button
            type="button"
            onClick={addColor}
            className="flex h-9 shrink-0 items-center gap-1 rounded-md border border-neutral-300 px-3 text-sm font-medium hover:bg-muted dark:border-input"
          >
            <Plus className="h-4 w-4" /> Añadir
          </button>
        </div>
      </div>

      {/* Precio por variante */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="priceVaries"
          checked={priceVaries}
          onCheckedChange={(checked) => handlePriceVaries(Boolean(checked))}
          className="border-neutral-400 dark:border-input"
        />
        <Label htmlFor="priceVaries" className="font-normal">
          El precio cambia según la talla o el color
        </Label>
      </div>

      {/* Tabla de combinaciones */}
      {value.length > 0 ? (
        <div className="space-y-2">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                <tr>
                  {sizes.length > 0 && <th className="px-3 py-2 font-medium">Talla</th>}
                  {colors.length > 0 && <th className="px-3 py-2 font-medium">Color</th>}
                  {priceVaries && <th className="px-3 py-2 font-medium">Precio (COP)</th>}
                  <th className="px-3 py-2 font-medium">Stock</th>
                </tr>
              </thead>
              <tbody>
                {value.map((row, index) => (
                  <tr key={keyOf(row.size, row.color)} className="border-t">
                    {sizes.length > 0 && <td className="px-3 py-2 font-medium">{row.size || "—"}</td>}
                    {colors.length > 0 && <td className="px-3 py-2">{row.color || "—"}</td>}
                    {priceVaries && (
                      <td className="px-3 py-1.5">
                        <PriceInput
                          value={row.price}
                          onChange={(price) => updateRow(index, { price })}
                          placeholder={basePrice ? formatAmount(basePrice) : "Precio del producto"}
                          className={cn("h-8 min-w-28", fieldClassName)}
                          aria-label={`Precio ${row.size} ${row.color}`.trim()}
                        />
                      </td>
                    )}
                    <td className="px-3 py-1.5">
                      <Input
                        type="number"
                        min={0}
                        value={row.stock}
                        onChange={(event) =>
                          updateRow(index, { stock: Math.max(0, Math.floor(Number(event.target.value) || 0)) })
                        }
                        className={cn("h-8 w-24", fieldClassName)}
                        aria-label={`Stock ${row.size} ${row.color}`.trim()}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Stock total: <span className="font-semibold text-foreground">{totalStock}</span> unidades.
            {priceVaries && " Si dejas un precio vacío se usa el precio del producto."}
          </p>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          Elige al menos una talla para indicar el stock de cada una.
        </p>
      )}
    </div>
  )
}
