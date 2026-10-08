import { NextResponse } from "next/server"
import { requireProductManager } from "@/lib/admin-guard"
import { getAiSettingsView } from "@/lib/ai/settings"

// GET /api/admin/ai/status -> si la IA y el buscador de imagenes estan listos
export async function GET() {
  const denied = await requireProductManager()
  if (denied) return denied
  const view = await getAiSettingsView()
  return NextResponse.json({ aiReady: view.aiReady, searchReady: view.searchReady, provider: view.provider, model: view.model })
}
