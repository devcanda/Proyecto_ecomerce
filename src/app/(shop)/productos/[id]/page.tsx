"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ProductGallery } from "@/components/products/ProductGallery"
import { ProductDetail } from "@/components/products/ProductDetail"
import { ProductCard } from "@/components/products/ProductCard"
import { Product } from "@/types"

interface ProductPageProps {
  params: Promise<{ id: string }>
}

export default function ProductPage({ params }: ProductPageProps) {
  const { id } = use(params)
  const [product, setProduct] = useState<Product | null>(null)
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Fotos del color elegido en la tienda (vacio = fotos generales)
  const [colorImages, setColorImages] = useState<string[]>([])

  useEffect(() => {
    async function fetchProduct() {
      try {
        setLoading(true)
        const response = await fetch(`/api/products/${id}`)

        if (!response.ok) {
          if (response.status === 404) {
            setError("not_found")
          } else {
            throw new Error("Failed to fetch product")
          }
          return
        }

        const data = await response.json()
        setProduct(data)

        // Fetch related products
        const relatedResponse = await fetch(
          `/api/products?category=${data.category}&limit=4`
        )
        if (relatedResponse.ok) {
          const relatedData = await relatedResponse.json()
          setRelatedProducts(
            relatedData.products.filter((p: Product) => p.id !== data.id).slice(0, 4)
          )
        }
      } catch (err) {
        setError("error")
        console.error("Error fetching product:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchProduct()
  }, [id])

  if (loading) {
    return (
      <div className="bg-neutral-100 dark:bg-transparent">
        <div className="container mx-auto px-4 py-6">
          <Skeleton className="mb-6 h-6 w-64" />
          <div className="grid gap-8 rounded-2xl bg-card p-4 sm:p-6 lg:grid-cols-[460px_1fr] lg:gap-12 lg:p-8">
            <Skeleton className="aspect-square rounded-xl" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error === "not_found" || !product) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Producto no encontrado</h1>
        <p className="mt-2 text-muted-foreground">
          El producto que buscas no existe o ha sido eliminado.
        </p>
        <Button asChild className="mt-4">
          <Link href="/productos">Ver todos los productos</Link>
        </Button>
      </div>
    )
  }

  return (
    // Modo claro: fondo gris suave con el producto en una tarjeta blanca (igual que el listado)
    <div className="bg-neutral-100 dark:bg-transparent">
      <div className="container mx-auto px-4 py-6">
        {/* Back Button - Mobile */}
        <Button
          variant="ghost"
          asChild
          className="mb-4 -ml-2 sm:hidden"
        >
          <Link href="/productos">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Volver
          </Link>
        </Button>

        {/* Breadcrumb - Desktop */}
        <Breadcrumb className="mb-6 hidden sm:flex">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Inicio</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/productos">Productos</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={`/productos?category=${product.category}`}>
                {product.category.charAt(0).toUpperCase() + product.category.slice(1)}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="max-w-[200px] truncate">
                {product.name}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Product Content */}
        <div className="grid gap-8 rounded-2xl border border-black/[0.06] bg-card p-4 shadow-[0_1px_3px_rgb(0_0_0/0.06),0_6px_16px_rgb(0_0_0/0.06)] sm:p-6 lg:grid-cols-[460px_1fr] lg:gap-12 lg:p-8 dark:border-border dark:shadow-none">
          {(() => {
            // Antes de elegir color: fotos generales + portada de cada color
            const covers = product.variants?.flatMap((variant) => variant.images?.slice(0, 1) ?? []) ?? []
            const galleryImages = colorImages.length
              ? colorImages
              : [...new Set([...product.images, ...covers])]
            return (
              <ProductGallery
                // Al cambiar de color la galeria vuelve a la primera foto (la portada)
                key={galleryImages.join("|")}
                images={galleryImages}
                productName={product.name}
              />
            )
          })()}
          <ProductDetail product={product} onColorImagesChange={setColorImages} />
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-6 text-2xl font-bold">Productos Relacionados</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
