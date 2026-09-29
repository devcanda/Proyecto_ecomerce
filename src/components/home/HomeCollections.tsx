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
        titleFont="jakarta"
        subtitle="Descubre lo más nuevo de nuestra tienda: tecnología, calzado y artículos variados, seleccionados con calidad garantizada."
        products={newProducts}
        moreHref="/productos"
      />
      <RecommendedGrid />
      <ProductShowcase
        title="Destacados De La Temporada"
        subtitle="Los productos favoritos de nuestros clientes, con los mejores precios y ofertas del momento."
        products={featuredProducts}
        moreHref="/productos"
      />
    </>
  )
}
