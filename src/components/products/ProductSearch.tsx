"use client"

import { useEffect, useState } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface ProductSearchProps {
  value: string
  onSearch: (value: string) => void
  className?: string
}

// Espera a que el usuario deje de escribir antes de filtrar
const DEBOUNCE_MS = 300

export function ProductSearch({ value, onSearch, className }: ProductSearchProps) {
  const [query, setQuery] = useState(value)
  const [syncedValue, setSyncedValue] = useState(value)

  // Si la busqueda cambia desde fuera (buscador del header, "Quitar busqueda"), se refleja aqui
  if (value !== syncedValue) {
    setSyncedValue(value)
    setQuery(value)
  }

  useEffect(() => {
    if (query.trim() === value.trim()) return
    const timer = setTimeout(() => onSearch(query.trim()), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, value, onSearch])

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setQuery("")
        }}
        placeholder="Buscar en los productos..."
        aria-label="Buscar en los productos"
        className="h-9 border-neutral-300 bg-white pl-9 pr-9 text-sm focus-visible:border-brand-blue focus-visible:ring-brand-blue/40 dark:border-input dark:focus-visible:border-brand-blue"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Borrar busqueda</span>
        </button>
      )}
    </div>
  )
}
