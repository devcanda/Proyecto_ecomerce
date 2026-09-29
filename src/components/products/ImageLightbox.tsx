"use client"

import { useState } from "react"
import Image from "next/image"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react"
import { cn } from "@/lib/utils"

interface ImageLightboxProps {
  images: string[]
  productName: string
  open: boolean
  index: number
  onOpenChange: (open: boolean) => void
  onIndexChange: (index: number) => void
}

const MIN_ZOOM = 1
const MAX_ZOOM = 3
// Nivel de zoom al hacer click o tocar la foto
const CLICK_ZOOM = 2

const iconButton =
  "flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:pointer-events-none disabled:opacity-30"

export function ImageLightbox({
  images,
  productName,
  open,
  index,
  onOpenChange,
  onIndexChange,
}: ImageLightboxProps) {
  const [zoom, setZoom] = useState(MIN_ZOOM)
  // Punto de la foto que se amplia (en porcentaje), sigue al cursor o al dedo
  const [origin, setOrigin] = useState({ x: 50, y: 50 })
  // Tamaño real de la foto, para que el zoom se ubique sobre la foto y no sobre el espacio vacio
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null)

  const hasMany = images.length > 1
  const zoomed = zoom > MIN_ZOOM

  const resetZoom = () => {
    setZoom(MIN_ZOOM)
    setOrigin({ x: 50, y: 50 })
  }

  const goTo = (next: number) => {
    resetZoom()
    setNatural(null)
    onIndexChange((next + images.length) % images.length)
  }

  const changeZoom = (delta: number) => {
    setZoom((value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value + delta)))
  }

  const originFromPointer = (event: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const fx = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    const fy = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
    if (!natural) return { x: fx * 100, y: fy * 100 }

    // Area que ocupa la foto dentro de la ventana (object-contain)
    const scale = Math.min(rect.width / natural.width, rect.height / natural.height)
    const width = natural.width * scale
    const height = natural.height * scale
    const left = (rect.width - width) / 2
    const top = (rect.height - height) / 2
    return {
      x: ((left + fx * width) / rect.width) * 100,
      y: ((top + fy * height) / rect.height) * 100,
    }
  }

  const handleImageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (zoomed) {
      resetZoom()
    } else {
      setOrigin(originFromPointer(event))
      setZoom(CLICK_ZOOM)
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    // Con el mouse basta moverlo; en pantallas tactiles se arrastra con el dedo
    if (!zoomed) return
    if (event.pointerType !== "mouse" && event.buttons === 0) return
    setOrigin(originFromPointer(event))
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowRight" && hasMany) goTo(index + 1)
    else if (event.key === "ArrowLeft" && hasMany) goTo(index - 1)
    else if (event.key === "+" || event.key === "=") changeZoom(1)
    else if (event.key === "-") changeZoom(-1)
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) resetZoom()
        onOpenChange(value)
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/[0.97] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          onKeyDown={handleKeyDown}
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-white outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        >
          {/* Barra superior */}
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <DialogPrimitive.Title className="truncate text-sm font-semibold sm:text-base">
                {productName}
              </DialogPrimitive.Title>
              {hasMany && (
                <p className="text-xs text-white/60">
                  {index + 1} / {images.length}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => changeZoom(-1)}
                disabled={!zoomed}
                className={iconButton}
              >
                <ZoomOut className="h-5 w-5" />
                <span className="sr-only">Alejar</span>
              </button>
              <button
                type="button"
                onClick={() => changeZoom(1)}
                disabled={zoom >= MAX_ZOOM}
                className={iconButton}
              >
                <ZoomIn className="h-5 w-5" />
                <span className="sr-only">Acercar</span>
              </button>
              <DialogPrimitive.Close className={cn(iconButton, "ml-2")}>
                <X className="h-5 w-5" />
                <span className="sr-only">Cerrar</span>
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Foto */}
          <div className="relative min-h-0 flex-1">
            <div
              onClick={handleImageClick}
              onPointerMove={handlePointerMove}
              className={cn(
                "absolute inset-0 overflow-hidden",
                zoomed ? "cursor-zoom-out touch-none" : "cursor-zoom-in"
              )}
            >
              <div
                className="relative h-full w-full transition-transform duration-200 ease-out"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: `${origin.x}% ${origin.y}%`,
                }}
              >
                <Image
                  src={images[index]}
                  alt={`${productName} - imagen ${index + 1}`}
                  fill
                  sizes="100vw"
                  className="select-none object-contain"
                  draggable={false}
                  onLoad={(event) =>
                    setNatural({
                      width: event.currentTarget.naturalWidth,
                      height: event.currentTarget.naturalHeight,
                    })
                  }
                />
              </div>
            </div>

            {hasMany && (
              <>
                <button
                  type="button"
                  onClick={() => goTo(index - 1)}
                  className={cn(iconButton, "absolute left-3 top-1/2 h-11 w-11 -translate-y-1/2 sm:left-6")}
                >
                  <ChevronLeft className="h-6 w-6" />
                  <span className="sr-only">Imagen anterior</span>
                </button>
                <button
                  type="button"
                  onClick={() => goTo(index + 1)}
                  className={cn(iconButton, "absolute right-3 top-1/2 h-11 w-11 -translate-y-1/2 sm:right-6")}
                >
                  <ChevronRight className="h-6 w-6" />
                  <span className="sr-only">Imagen siguiente</span>
                </button>
              </>
            )}
          </div>

          {/* Miniaturas */}
          <div className="flex flex-col items-center gap-3 px-4 py-4">
            {hasMany && (
              <div className="flex max-w-full gap-2 overflow-x-auto">
                {images.map((image, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goTo(i)}
                    className={cn(
                      "relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition-opacity",
                      i === index ? "border-brand-blue" : "border-transparent opacity-50 hover:opacity-100"
                    )}
                  >
                    <Image src={image} alt="" fill sizes="56px" className="object-cover" />
                    <span className="sr-only">Ver imagen {i + 1}</span>
                  </button>
                ))}
              </div>
            )}
            <p className="text-center text-xs text-white/50">
              {zoomed
                ? "Mueve el cursor o arrastra para recorrer la foto. Toca de nuevo para alejar."
                : "Haz click o toca la foto para ampliarla."}
            </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
