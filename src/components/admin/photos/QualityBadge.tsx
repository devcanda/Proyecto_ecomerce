import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import { evaluateImageQuality } from "@/lib/image-quality"
import { cn } from "@/lib/utils"

const STYLES = {
  optimal: { className: "bg-green-600 text-white", icon: CheckCircle2 },
  acceptable: { className: "bg-amber-500 text-white", icon: AlertTriangle },
  low: { className: "bg-red-600 text-white", icon: XCircle },
} as const

// Etiqueta de calidad de una foto segun su tamaño en px
export function QualityBadge({ width, height, className }: { width?: number; height?: number; className?: string }) {
  if (!width || !height) return null
  const quality = evaluateImageQuality(width, height)
  const style = STYLES[quality.level]
  const Icon = style.icon
  return (
    <span
      title={`${width} × ${height} px. ${quality.detail}${quality.notSquare ? " Es alargada: en la tienda se recorta a cuadrado." : ""}`}
      className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold shadow-sm", style.className, className)}
    >
      <Icon className="h-3 w-3" />
      {quality.label}
    </span>
  )
}
