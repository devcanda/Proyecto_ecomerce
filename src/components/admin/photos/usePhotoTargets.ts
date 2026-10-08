"use client"

import { useCallback, useEffect, useState } from "react"
import type { PhotoTarget } from "@/lib/photo-names"

// Productos con sus fotos actuales (se recarga despues de cada subida)
export function usePhotoTargets() {
  const [targets, setTargets] = useState<PhotoTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/photos", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar los productos")
      setTargets(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los productos")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Carga inicial de los productos
    refresh()
  }, [refresh])

  // Actualiza un producto sin recargar todo (despues de subir fotos a uno solo)
  const updateTarget = useCallback((id: string, change: (target: PhotoTarget) => PhotoTarget) => {
    setTargets((current) => current.map((target) => (target.id === id ? change(target) : target)))
  }, [])

  return { targets, loading, error, refresh, updateTarget }
}
