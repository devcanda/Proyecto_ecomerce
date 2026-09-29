import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

// Devuelve una respuesta de error si quien llama no es administrador; null si puede continuar
export async function requireAdmin() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  return null
}
