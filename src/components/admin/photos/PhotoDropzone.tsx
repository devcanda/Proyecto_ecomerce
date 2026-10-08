"use client"

import { useId, useState, type ReactNode } from "react"
import { filesFromDrop, IMAGE_EXTENSIONS } from "@/lib/photo-upload-client"
import { cn } from "@/lib/utils"

interface PhotoDropzoneProps {
  onFiles: (files: File[]) => void
  disabled?: boolean
  // Permite elegir una carpeta completa con el boton
  allowFolder?: boolean
  className?: string
  children: (open: { files: () => void; folder: () => void }, dragActive: boolean) => ReactNode
}

// Zona para arrastrar fotos o carpetas (o elegirlas con un boton)
export function PhotoDropzone({ onFiles, disabled, allowFolder, className, children }: PhotoDropzoneProps) {
  const id = useId()
  const filesId = `${id}-files`
  const folderId = `${id}-folder`
  const [dragActive, setDragActive] = useState(false)

  function openFiles() {
    document.getElementById(filesId)?.click()
  }
  function openFolder() {
    document.getElementById(folderId)?.click()
  }

  const emit = (files: File[]) => {
    const images = files.filter((file) => IMAGE_EXTENSIONS.test(file.name) || file.type.startsWith("image/"))
    if (images.length) onFiles(images)
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) setDragActive(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragActive(false)
      }}
      onDrop={async (event) => {
        event.preventDefault()
        setDragActive(false)
        if (disabled) return
        emit(await filesFromDrop(event.dataTransfer))
      }}
      className={cn(dragActive && "ring-2 ring-brand-blue ring-offset-2 ring-offset-background", className)}
    >
      {children({ files: openFiles, folder: openFolder }, dragActive)}
      <input
        id={filesId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        hidden
        onChange={(event) => {
          emit([...(event.target.files ?? [])])
          event.target.value = ""
        }}
      />
      {allowFolder && (
        <input
          id={folderId}
          type="file"
          multiple
          hidden
          // Seleccion de carpeta completa (Chrome, Edge, Firefox)
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          onChange={(event) => {
            emit([...(event.target.files ?? [])])
            event.target.value = ""
          }}
        />
      )}
    </div>
  )
}
