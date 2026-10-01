"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { GENDERS } from "@/lib/category-type"
import type { Gender } from "@/types"

interface GenderFilterProps {
  selectedGenders: Gender[]
  onGendersChange: (genders: Gender[]) => void
}

// Filtro Hombre / Mujer / Unisex (al elegir Hombre o Mujer tambien salen los productos unisex)
export function GenderFilter({ selectedGenders, onGendersChange }: GenderFilterProps) {
  const [isOpen, setIsOpen] = useState(true)

  const handleToggle = (gender: Gender) => {
    if (selectedGenders.includes(gender)) {
      onGendersChange(selectedGenders.filter((item) => item !== gender))
    } else {
      onGendersChange([...selectedGenders, gender])
    }
  }

  return (
    <div className="border-b pb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-2 font-medium"
      >
        Género
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {isOpen && (
        <div className="mt-2 space-y-2 pr-3">
          {GENDERS.map((gender) => (
            <div key={gender.value} className="flex items-center space-x-2">
              <Checkbox
                id={`gender-${gender.value}`}
                checked={selectedGenders.includes(gender.value)}
                onCheckedChange={() => handleToggle(gender.value)}
                className="border-neutral-400 bg-white dark:border-input dark:bg-input/30"
              />
              <Label htmlFor={`gender-${gender.value}`} className="flex-1 cursor-pointer text-sm">
                {gender.label}
              </Label>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Hombre y Mujer incluyen los productos unisex.</p>
        </div>
      )}
    </div>
  )
}
