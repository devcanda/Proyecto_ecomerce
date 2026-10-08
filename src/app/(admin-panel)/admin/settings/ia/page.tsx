import { redirect } from "next/navigation"

// La configuracion de IA ahora es una pestaña de Configuracion
export default function AiSettingsRedirect() {
  redirect("/admin/settings?tab=ia")
}
