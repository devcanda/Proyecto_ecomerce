"use client"

import { useEffect } from "react"
import { useProductsStore } from "@/stores/products-store"
import { ProductShowcase } from "./ProductShowcase"
import { RecommendedGrid } from "./RecommendedGrid"

export function HomeCollections() {
  const { newProducts, featuredProducts, fetchNewProducts, fetchFeaturedProducts } =
    useProductsStore()

  useEffect(() => {
    fetchNewProducts()
    fetchFeaturedProducts()
  }, [fetchNewProducts, fetchFeaturedProducts])

  return (
    <>
      <ProductShowcase
        title="Recién Llegados"
        subtitle="Los últimos lanzamientos en tecnología, seleccionados para ofrecerte rendimiento y calidad garantizada."
        products={newProducts}
        moreHref="/products"
      />
      <RecommendedGrid />
      <ProductShowcase
        title="Destacados De La Temporada"
        subtitle="Los productos favoritos de nuestros clientes, con los mejores precios y ofertas del momento."
        products={featuredProducts}
        moreHref="/products"
      />
    </>
  )
}
