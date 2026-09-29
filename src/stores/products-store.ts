import { create } from "zustand"
import type { Product, Category, Brand, FilterState } from "@/types"

interface ProductsState {
  products: Product[]
  // true si la busqueda actual solo tiene coincidencias aproximadas (errores de escritura)
  searchApproximate: boolean
  categories: Category[]
  brands: Brand[]
  featuredProducts: Product[]
  newProducts: Product[]
  filters: FilterState
  loading: boolean
  error: string | null

  // Actions
  fetchProducts: (filters?: Partial<FilterState>) => Promise<void>
  fetchFeaturedProducts: () => Promise<void>
  fetchNewProducts: () => Promise<void>
  fetchCategories: () => Promise<void>
  fetchBrands: () => Promise<void>
  setFilters: (filters: Partial<FilterState>) => void
  resetFilters: () => void
}

const defaultFilters: FilterState = {
  categories: [],
  brands: [],
  priceRange: [0, 10000],
  sortBy: "newest",
  search: "",
}

let latestProductsRequest = 0

export const useProductsStore = create<ProductsState>((set, get) => ({
  products: [],
  searchApproximate: false,
  categories: [],
  brands: [],
  featuredProducts: [],
  newProducts: [],
  filters: defaultFilters,
  loading: false,
  error: null,

  fetchProducts: async (filterOverrides) => {
    // Al escribir en el buscador se lanzan varias peticiones; solo cuenta la ultima
    const requestId = ++latestProductsRequest
    set({ loading: true, error: null })
    try {
      const filters = { ...get().filters, ...filterOverrides }
      const params = new URLSearchParams()

      if (filters.categories.length === 1) {
        params.set("category", filters.categories[0])
      }
      if (filters.brands.length === 1) {
        params.set("brand", filters.brands[0])
      }
      if (filters.priceRange[0] > 0) {
        params.set("minPrice", filters.priceRange[0].toString())
      }
      if (filters.priceRange[1] < 10000) {
        params.set("maxPrice", filters.priceRange[1].toString())
      }
      if (filters.search.trim()) {
        params.set("search", filters.search.trim())
      }
      if (filters.sortBy) {
        params.set("sortBy", filters.sortBy)
      }

      const response = await fetch(`/api/products?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch products")

      const data = await response.json()
      if (requestId !== latestProductsRequest) return
      set({ products: data.products, searchApproximate: data.approximate ?? false, loading: false })
    } catch (error) {
      if (requestId !== latestProductsRequest) return
      set({ error: (error as Error).message, loading: false })
    }
  },

  fetchFeaturedProducts: async () => {
    try {
      const response = await fetch("/api/products?featured=true&limit=8")
      if (!response.ok) throw new Error("Failed to fetch featured products")

      const data = await response.json()
      set({ featuredProducts: data.products })
    } catch (error) {
      console.error("Error fetching featured products:", error)
    }
  },

  fetchNewProducts: async () => {
    try {
      const response = await fetch("/api/products?sortBy=newest&limit=8")
      if (!response.ok) throw new Error("Failed to fetch new products")

      const data = await response.json()
      set({ newProducts: data.products })
    } catch (error) {
      console.error("Error fetching new products:", error)
    }
  },

  fetchCategories: async () => {
    try {
      const response = await fetch("/api/categories")
      if (!response.ok) throw new Error("Failed to fetch categories")

      const categories = await response.json()
      set({ categories })
    } catch (error) {
      console.error("Error fetching categories:", error)
    }
  },

  fetchBrands: async () => {
    try {
      const response = await fetch("/api/brands")
      if (!response.ok) throw new Error("Failed to fetch brands")

      const brands = await response.json()
      set({ brands })
    } catch (error) {
      console.error("Error fetching brands:", error)
    }
  },

  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }))
  },

  resetFilters: () => {
    set({ filters: defaultFilters })
  },
}))
