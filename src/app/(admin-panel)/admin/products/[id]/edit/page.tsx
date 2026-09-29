"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EditableProduct, ProductForm } from "@/components/admin/ProductForm"

interface EditProductPageProps {
  params: Promise<{ id: string }>
}

export default function EditProductPage({ params }: EditProductPageProps) {
  const { id } = use(params)
  const [product, setProduct] = useState<EditableProduct | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "not_found" | "error">("loading")

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/products/${id}`)
      .then(async (response) => {
        if (cancelled) return
        if (response.status === 404) return setStatus("not_found")
        if (!response.ok) return setStatus("error")
        setProduct(await response.json())
        setStatus("ready")
      })
      .catch(() => {
        if (!cancelled) setStatus("error")
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (status !== "ready" || !product) {
    return (
      <div className="py-12 text-center">
        <h1 className="text-2xl font-bold">
          {status === "not_found" ? "Producto no encontrado" : "No se pudo cargar el producto"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {status === "not_found"
            ? "El producto que intentas editar no existe o fue eliminado."
            : "Intenta recargar la pagina."}
        </p>
        <Button asChild className="mt-4">
          <Link href="/admin/products">Volver a productos</Link>
        </Button>
      </div>
    )
  }

  return <ProductForm product={product} />
}
