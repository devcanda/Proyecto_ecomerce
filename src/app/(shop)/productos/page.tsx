"use client"

import { Suspense, useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { X } from "lucide-react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { FilterSidebar } from "@/components/products/FilterSidebar"
import { FilterMobile } from "@/components/products/FilterMobile"
import { ProductGrid } from "@/components/products/ProductGrid"
import { SortSelect } from "@/components/products/SortSelect"
import { ProductSearch } from "@/components/products/ProductSearch"
import { Skeleton } from "@/components/ui/skeleton"
import { useProductsStore } from "@/stores/products-store"
import { FilterState } from "@/types"

function ProductsContent() {
  const searchParams = useSearchParams()
  const { products, searchApproximate, loading, filters, setFilters, fetchProducts, fetchCategories, fetchBrands } = useProductsStore()
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  // Initialize filters from URL params
  useEffect(() => {
    const category = searchParams.get("category")
    const featured = searchParams.get("featured")
    const search = searchParams.get("search")?.trim() ?? ""

    // La busqueda siempre se toma de la URL (vacia = sin busqueda)
    const initialFilters: Partial<FilterState> = { search }
    if (category) {
      initialFilters.categories = [category]
    } else if (search) {
      // Una busqueda nueva desde el header busca en todas las categorias
      initialFilters.categories = []
    }
    if (featured === "true") {
      // This will be handled in the API call
    }

    setFilters(initialFilters)

    fetchCategories()
    fetchBrands()
  }, [searchParams, setFilters, fetchCategories, fetchBrands])

  // Fetch products when filters change
  useEffect(() => {
    fetchProducts()
  }, [filters, fetchProducts])

  const handleFiltersChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters)
  }, [setFilters])

  const handleSearch = useCallback((search: string) => {
    setFilters({ search })
  }, [setFilters])

  const activeFilterCount =
    filters.brands.length +
    filters.categories.length +
    filters.genders.length +
    (filters.priceRange[0] > 0 || filters.priceRange[1] < 10000 ? 1 : 0)

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Inicio</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Productos</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Results count and controls */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">
            {filters.search ? `Resultados para "${filters.search}"` : "Todos los Productos"}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Cargando..."
                : `${products.length} ${products.length === 1 ? "producto encontrado" : "productos encontrados"}`}
            </p>
            {filters.search && (
              <Link
                href="/productos"
                onClick={() => setFilters({ search: "" })}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-3 w-3" />
                Quitar busqueda
              </Link>
            )}
          </div>
          {filters.search && searchApproximate && !loading && (
            <p className="mt-2 text-sm text-muted-foreground">
              No encontramos coincidencias exactas. Mostrando resultados similares a &quot;{filters.search}&quot;.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:ml-10 lg:flex-1 lg:justify-between">
          <ProductSearch
            value={filters.search}
            onSearch={handleSearch}
            className="w-full sm:flex-1 lg:w-80 lg:flex-none xl:w-96"
          />
          <div className="flex items-center gap-3">
            <FilterMobile
              filters={filters}
              onFiltersChange={handleFiltersChange}
              activeFilterCount={activeFilterCount}
            />
            <SortSelect
              value={filters.sortBy}
              onChange={(sortBy) =>
                setFilters({ sortBy: sortBy as FilterState["sortBy"] })
              }
            />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex gap-8">
        {/* Sidebar - Desktop */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24">
            <FilterSidebar filters={filters} onFiltersChange={handleFiltersChange} />
          </div>
        </aside>

        {/* Products */}
        <div className="flex-1">
          <ProductGrid
            products={products}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            loading={loading}
          />
        </div>
      </div>
    </div>
  )
}

function ProductsPageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-6">
      <Skeleton className="mb-6 h-6 w-48" />
      <div className="mb-6 flex justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-32" />
        </div>
      </div>
      <div className="flex gap-8">
        <aside className="hidden w-64 lg:block">
          <Skeleton className="h-96" />
        </aside>
        <div className="flex-1">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProductsPage() {
  return (
    // Modo claro: fondo gris muy suave para que las tarjetas blancas resalten (como en modo oscuro)
    <div className="bg-neutral-100 dark:bg-transparent">
      <Suspense fallback={<ProductsPageSkeleton />}>
        <ProductsContent />
      </Suspense>
    </div>
  )
}
