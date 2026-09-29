"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"

interface PriceInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type" | "inputMode"> {
  value?: number
  onChange: (value: number | undefined) => void
}

const MAX_DECIMALS = 2

// Formato colombiano mientras se escribe: punto para miles y coma para decimales (1.250.000,50)
function formatTyped(raw: string) {
  const clean = raw.replace(/[^\d,]/g, "")
  const [integerPart, ...rest] = clean.split(",")
  const integer = integerPart.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  if (rest.length === 0) return integer
  return `${integer || "0"},${rest.join("").slice(0, MAX_DECIMALS)}`
}

function parse(display: string): number | undefined {
  if (!display) return undefined
  const number = Number(display.replace(/\./g, "").replace(",", "."))
  return Number.isFinite(number) ? number : undefined
}

function formatValue(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return ""
  const [integer, decimals] = value.toFixed(MAX_DECIMALS).split(".")
  const text = decimals === "00" ? integer : `${integer},${decimals.replace(/0$/, "")}`
  return formatTyped(text)
}

// Cuantos digitos o comas hay antes de una posicion (para no mover el cursor al agregar puntos)
const countSignificant = (text: string) => text.replace(/[^\d,]/g, "").length

export function PriceInput({ value, onChange, ...props }: PriceInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const caretRef = useRef<number | null>(null)
  const [display, setDisplay] = useState(() => formatValue(value))
  const [syncedValue, setSyncedValue] = useState(value)

  // Si el valor cambia desde fuera (por ejemplo al limpiar el formulario) se actualiza el texto
  if (value !== syncedValue) {
    setSyncedValue(value)
    if (value !== parse(display)) setDisplay(formatValue(value))
  }

  useLayoutEffect(() => {
    const input = inputRef.current
    const target = caretRef.current
    if (!input || target === null) return
    caretRef.current = null

    let position = 0
    let seen = 0
    while (position < display.length && seen < target) {
      if (/[\d,]/.test(display[position])) seen++
      position++
    }
    input.setSelectionRange(position, position)
  }, [display])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value
    const caret = event.target.selectionStart ?? raw.length
    caretRef.current = countSignificant(raw.slice(0, caret))

    const formatted = formatTyped(raw)
    const parsed = parse(formatted)
    setDisplay(formatted)
    setSyncedValue(parsed)
    onChange(parsed)
  }

  return (
    <Input
      {...props}
      ref={inputRef}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={display}
      onChange={handleChange}
    />
  )
}
