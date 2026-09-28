import { cn } from "@/lib/utils"
import { CURRENCY, formatAmount } from "@/lib/format"

interface PriceProps {
  amount: number
  className?: string
}

/** Precio con la moneda en tamano menor: 159.990 COP */
export function Price({ amount, className }: PriceProps) {
  return (
    <span className={cn("whitespace-nowrap", className)}>
      {formatAmount(amount)}
      <span className="ml-1 text-[0.65em] font-medium opacity-70">{CURRENCY}</span>
    </span>
  )
}
