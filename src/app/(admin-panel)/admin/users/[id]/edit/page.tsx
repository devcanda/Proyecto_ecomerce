"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EditableUser, UserForm } from "@/components/admin/UserForm"

interface EditUserPageProps {
  params: Promise<{ id: string }>
}

export default function EditUserPage({ params }: EditUserPageProps) {
  const { id } = use(params)
  const [user, setUser] = useState<EditableUser | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "not_found" | "error">("loading")

  useEffect(() => {
    let cancelled = false
    fetch(`/api/users/${id}`)
      .then(async (response) => {
        if (cancelled) return
        if (response.status === 404) return setStatus("not_found")
        if (!response.ok) return setStatus("error")
        setUser(await response.json())
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

  if (status !== "ready" || !user) {
    return (
      <div className="py-12 text-center">
        <h1 className="text-2xl font-bold">
          {status === "not_found" ? "Usuario no encontrado" : "No se pudo cargar el usuario"}
        </h1>
        <Button asChild className="mt-4">
          <Link href="/admin/users">Volver a usuarios</Link>
        </Button>
      </div>
    )
  }

  return <UserForm user={user} />
}
