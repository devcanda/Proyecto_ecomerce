// Reglas de calidad para las fotos de producto.
// La foto principal se ve a ~460px en PC (hasta ~920px en pantallas retina) y se puede ampliar con zoom,
// por eso se recomiendan 1200px o mas en el lado mas corto.
export const IMAGE_RECOMMENDED_PX = 1200
export const IMAGE_MINIMUM_PX = 800
// Tamaño maximo con el que se guarda cada foto (las mas grandes se reducen a esta medida)
export const IMAGE_MAX_STORED_PX = 2000
// Las tarjetas y la galeria son cuadradas: fotos muy alargadas se recortan
const MAX_ASPECT_RATIO = 1.3

export type ImageQualityLevel = "optimal" | "acceptable" | "low"

export interface ImageQuality {
  level: ImageQualityLevel
  label: string
  detail: string
  notSquare: boolean
}

export function evaluateImageQuality(width: number, height: number): ImageQuality {
  const shortest = Math.min(width, height)
  const ratio = Math.max(width, height) / Math.max(1, shortest)
  const notSquare = ratio > MAX_ASPECT_RATIO

  if (shortest >= IMAGE_RECOMMENDED_PX) {
    return { level: "optimal", label: "Óptima", detail: "Se verá nítida, incluso con zoom.", notSquare }
  }
  if (shortest >= IMAGE_MINIMUM_PX) {
    return {
      level: "acceptable",
      label: "Aceptable",
      detail: `Se ve bien, pero con zoom pierde nitidez. Ideal: ${IMAGE_RECOMMENDED_PX} px o más.`,
      notSquare,
    }
  }
  return {
    level: "low",
    label: "Baja calidad",
    detail: `Se verá borrosa. Mínimo ${IMAGE_MINIMUM_PX} × ${IMAGE_MINIMUM_PX} px, ideal ${IMAGE_RECOMMENDED_PX} × ${IMAGE_RECOMMENDED_PX} px.`,
    notSquare,
  }
}
