import { cn } from "@/lib/utils"

interface SectionHeadingProps {
  title: string
  subtitle?: string
  // "display": serif Fraunces (por defecto) | "jakarta": sans Plus Jakarta Sans
  font?: "display" | "jakarta"
}

export function SectionHeading({ title, subtitle, font = "display" }: SectionHeadingProps) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      <h2
        className={cn(
          "text-3xl sm:text-4xl lg:text-5xl",
          font === "jakarta" ? "font-jakarta font-bold tracking-tight" : "font-display"
        )}
      >
        {title}
      </h2>
      {subtitle && (
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          {subtitle}
        </p>
      )}
    </div>
  )
}
