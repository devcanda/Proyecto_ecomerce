interface SectionHeadingProps {
  title: string
  subtitle?: string
}

export function SectionHeading({ title, subtitle }: SectionHeadingProps) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl">{title}</h2>
      {subtitle && (
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          {subtitle}
        </p>
      )}
    </div>
  )
}
