"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { Product } from "@/types"
import { Price } from "@/components/ui/price"

const searchSchema = z.object({
  query: z.string().trim().min(1).max(100),
})

type SearchFormData = z.infer<typeof searchSchema>

const MIN_CHARS = 2
const MAX_SUGGESTIONS = 5
const DEBOUNCE_MS = 250
const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1629429408209-1f912961dbd8?w=100&h=100&fit=crop"

interface SearchBarProps {
  className?: string
  inputClassName?: string
  iconClassName?: string
  dropdownClassName?: string
  autoFocus?: boolean
  // Se llama al navegar (p. ej. para cerrar el panel de busqueda)
  onNavigate?: () => void
}

function SearchBarInner({
  className,
  inputClassName,
  iconClassName,
  dropdownClassName,
  autoFocus,
  onNavigate,
}: SearchBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const containerRef = useRef<HTMLDivElement>(null)

  const [suggestions, setSuggestions] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [approximate, setApproximate] = useState(false)
  // Termino al que corresponden las sugerencias mostradas
  const [resultsTerm, setResultsTerm] = useState("")
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const { register, handleSubmit, watch, setValue } = useForm<SearchFormData>({
    resolver: zodResolver(searchSchema),
    defaultValues: { query: searchParams.get("search") ?? "" },
  })

  const query = watch("query")
  const term = query.trim()
  const showDropdown = open && term.length >= MIN_CHARS
  const pending = loading || resultsTerm !== term

  // Mantiene el input sincronizado con la busqueda de la URL
  useEffect(() => {
    setValue("query", searchParams.get("search") ?? "")
  }, [searchParams, setValue])

  // Sugerencias en vivo con debounce
  useEffect(() => {
    if (term.length < MIN_CHARS) return

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ search: term, limit: String(MAX_SUGGESTIONS) })
        const response = await fetch(`/api/products?${params}`, { signal: controller.signal })
        if (!response.ok) throw new Error("Failed to search products")
        const data = await response.json()
        setSuggestions(data.products)
        setTotal(data.total)
        setApproximate(data.approximate ?? false)
        setResultsTerm(term)
        setActiveIndex(-1)
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Error searching products:", error)
          setSuggestions([])
          setTotal(0)
          setResultsTerm(term)
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [term])

  // Cierra el desplegable al hacer clic fuera
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [])

  const close = () => {
    setOpen(false)
    setActiveIndex(-1)
    onNavigate?.()
  }

  const goToProduct = (product: Product) => {
    close()
    router.push(`/productos/${product.slug}`)
  }

  const onSubmit = ({ query }: SearchFormData) => {
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      goToProduct(suggestions[activeIndex])
      return
    }
    close()
    router.push(`/productos?search=${encodeURIComponent(query)}`)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    } else if (event.key === "Escape") {
      setOpen(false)
    }
  }

  const { onChange, ...queryField } = register("query")

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <form onSubmit={handleSubmit(onSubmit)} role="search">
        <Search
          className={cn(
            "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground",
            iconClassName
          )}
        />
        <Input
          type="text"
          inputMode="search"
          placeholder="Buscar productos..."
          autoComplete="off"
          autoFocus={autoFocus}
          aria-label="Buscar productos"
          aria-expanded={showDropdown}
          {...queryField}
          onChange={(event) => {
            onChange(event)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className={cn("w-full pl-10 pr-9", inputClassName)}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setValue("query", "")
              setSuggestions([])
            }}
            className={cn(
              "absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground",
              iconClassName
            )}
            aria-label="Borrar busqueda"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </form>

      {showDropdown && (
        <div
          className={cn(
            "absolute left-0 top-full z-50 mt-2 w-full min-w-80 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg",
            dropdownClassName
          )}
        >
          {pending && suggestions.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando...
            </div>
          ) : suggestions.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No encontramos productos para &quot;{term}&quot;
            </div>
          ) : (
            <>
              {approximate && (
                <p className="border-b px-4 py-2 text-xs text-muted-foreground">
                  Resultados similares a &quot;{term}&quot;
                </p>
              )}
              <ul className="py-2">
                {suggestions.map((product, index) => (
                  <li key={product.id}>
                    <Link
                      href={`/productos/${product.slug}`}
                      onClick={close}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2 transition-colors",
                        index === activeIndex && "bg-accent"
                      )}
                    >
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-muted">
                        <Image
                          src={product.images?.[0] || PLACEHOLDER_IMAGE}
                          alt=""
                          fill
                          sizes="44px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{product.name}</p>
                        <p className="truncate text-xs capitalize text-muted-foreground">
                          {product.brand} · {product.category}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold">
                        <Price amount={product.price} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href={`/productos?search=${encodeURIComponent(term)}`}
                onClick={close}
                className="flex items-center justify-center gap-2 border-t px-4 py-3 text-sm font-medium text-brand-link transition-colors hover:bg-accent"
              >
                <Search className="h-3.5 w-3.5" />
                Ver {total === 1 ? "el resultado" : `los ${total} resultados`}
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function SearchBar(props: SearchBarProps) {
  return (
    <Suspense
      fallback={
        <div className={cn("relative w-full", props.className)}>
          <Search
            className={cn(
              "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground",
              props.iconClassName
            )}
          />
          <Input
            type="text"
            placeholder="Buscar productos..."
            aria-label="Buscar productos"
            className={cn("w-full pl-10 pr-9", props.inputClassName)}
          />
        </div>
      }
    >
      <SearchBarInner {...props} />
    </Suspense>
  )
}
