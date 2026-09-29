import Image from "next/image"
import { cn } from "@/lib/utils"

interface LogoProps {
  // "auto": texto negro en tema claro y blanco en tema oscuro
  // "light": siempre texto blanco (para fondos oscuros)
  // "inverse": texto blanco en tema claro y negro en tema oscuro (fondos que invierten el tema)
  variant?: "auto" | "light" | "inverse"
  className?: string
  priority?: boolean
}

// Proporcion de los archivos public/logo.png y public/logo-light.png (301x100)
const WIDTH = 301
const HEIGHT = 100

export function Logo({ variant = "auto", className, priority }: LogoProps) {
  const imageClass = cn("h-10 w-auto", className)

  if (variant === "light") {
    return (
      <Image
        src="/logo-light.png"
        alt="Compra En Linea"
        width={WIDTH}
        height={HEIGHT}
        priority={priority}
        className={imageClass}
      />
    )
  }

  const inverse = variant === "inverse"

  return (
    <>
      <Image
        src={inverse ? "/logo-light.png" : "/logo.png"}
        alt="Compra En Linea"
        width={WIDTH}
        height={HEIGHT}
        priority={priority}
        className={cn(imageClass, "dark:hidden")}
      />
      <Image
        src={inverse ? "/logo.png" : "/logo-light.png"}
        alt="Compra En Linea"
        width={WIDTH}
        height={HEIGHT}
        priority={priority}
        className={cn(imageClass, "hidden dark:block")}
      />
    </>
  )
}
