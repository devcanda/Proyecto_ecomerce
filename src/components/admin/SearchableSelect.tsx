"use client"

import { useMemo, useState } from "react"
import { Check, ChevronDown, Loader2, Plus, Search } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface SelectOption {
  value: string
  label: string
}

interface SearchableSelectProps {
  id?: string
  options: SelectOption[]
  value?: string
  onChange: (value: string) => void
  placeholder: string
  searchPlaceholder?: string
  // Si se define, permite crear una opcion nueva con el texto buscado
  onCreate?: (name: string) => Promise<SelectOption | null>
  disabled?: boolean
  invalid?: boolean
  className?: string
}

// Compara sin mayusculas ni tildes: "audifonos" encuentra "Audífonos"
const normalize = (text: string) =>
  text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()

export function SearchableSelect({
  id,
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder = "Buscar...",
  onCreate,
  disabled,
  invalid,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlighted, setHighlighted] = useState(0)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = options.find((option) => option.value === value)

  const filtered = useMemo(() => {
    const term = normalize(query)
    if (!term) return options
    return options.filter((option) => normalize(option.label).includes(term))
  }, [options, query])

  const trimmed = query.trim()
  const exactMatch = options.some((option) => normalize(option.label) === normalize(trimmed))
  const canCreate = Boolean(onCreate && trimmed && !exactMatch)
  // La opcion "Añadir" va al final de la lista para la navegacion con teclado
  const itemCount = filtered.length + (canCreate ? 1 : 0)

  const close = () => {
    setOpen(false)
    setQuery("")
    setHighlighted(0)
    setError(null)
  }

  const select = (option: SelectOption) => {
    onChange(option.value)
    close()
  }

  const create = async () => {
    if (!onCreate || !trimmed || creating) return
    setCreating(true)
    setError(null)
    try {
      const option = await onCreate(trimmed)
      if (option) select(option)
      else setError("No se pudo añadir. Intenta de nuevo.")
    } catch {
      setError("No se pudo añadir. Intenta de nuevo.")
    } finally {
      setCreating(false)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setHighlighted((index) => Math.min(index + 1, itemCount - 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setHighlighted((index) => Math.max(index - 1, 0))
    } else if (event.key === "Enter") {
      event.preventDefault()
      if (highlighted < filtered.length) {
        const option = filtered[highlighted]
        if (option) select(option)
      } else if (canCreate) {
        create()
      }
    }
  }

  return (
    <Popover open={open} onOpenChange={(value) => (value ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          data-invalid={invalid || undefined}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-left text-sm shadow-xs outline-none transition-[color,box-shadow] dark:border-input dark:bg-input/30",
            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
            "data-[invalid=true]:border-destructive disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-56 p-0"
      >
        {/* Buscador */}
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setHighlighted(0)
              setError(null)
            }}
            onKeyDown={handleKeyDown}
            placeholder={searchPlaceholder}
            className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div role="listbox" className="max-h-60 overflow-y-auto p-1">
          {filtered.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => select(option)}
              onMouseEnter={() => setHighlighted(index)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                highlighted === index && "bg-accent text-accent-foreground"
              )}
            >
              <span className="truncate">{option.label}</span>
              {option.value === value && <Check className="h-4 w-4 shrink-0 text-brand-link" />}
            </button>
          ))}

          {filtered.length === 0 && !canCreate && (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">
              {trimmed ? "Sin resultados" : "No hay opciones todavia"}
            </p>
          )}

          {canCreate && (
            <button
              type="button"
              onClick={create}
              onMouseEnter={() => setHighlighted(filtered.length)}
              disabled={creating}
              className={cn(
                "mt-1 flex w-full items-center gap-2 rounded-sm border-t px-2 py-2 text-left text-sm font-medium text-brand-link",
                highlighted === filtered.length && "bg-accent"
              )}
            >
              {creating ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate">Añadir &quot;{trimmed}&quot;</span>
            </button>
          )}

          {error && <p className="px-2 py-1.5 text-xs text-destructive">{error}</p>}
        </div>
      </PopoverContent>
    </Popover>
  )
}
