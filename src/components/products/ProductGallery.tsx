"use client"

import { useState } from "react"
import Image from "next/image"
import { Expand } from "lucide-react"
import { cn } from "@/lib/utils"
import { ImageLightbox } from "./ImageLightbox"

interface ProductGalleryProps {
  images: string[]
  productName: string
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 lg:max-w-none">
      {/* Main Image - abre la ventana con zoom */}
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        className="group relative aspect-square cursor-zoom-in overflow-hidden rounded-xl bg-muted"
      >
        <Image
          src={images[selectedIndex]}
          alt={productName}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          sizes="(max-width: 1024px) 448px, 460px"
          priority
        />
        <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
          <Expand className="h-3.5 w-3.5" />
          Ampliar
        </span>
      </button>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => setSelectedIndex(index)}
              className={cn(
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors",
                selectedIndex === index
                  ? "border-primary"
                  : "border-transparent hover:border-muted-foreground/50"
              )}
            >
              <Image
                src={image}
                alt={`${productName} - ${index + 1}`}
                fill
                className="object-cover"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}

      <ImageLightbox
        images={images}
        productName={productName}
        open={lightboxOpen}
        index={selectedIndex}
        onOpenChange={setLightboxOpen}
        onIndexChange={setSelectedIndex}
      />
    </div>
  )
}
