// Disponibilidad de un producto (se usa en la tienda, el panel y la carga masiva)
export type Availability = "STOCK" | "SUPPLIER" | "PREORDER"

export const AVAILABILITY_OPTIONS: { value: Availability; label: string; hint: string }[] = [
  {
    value: "STOCK",
    label: "Inventario propio",
    hint: "Lo tienes físicamente. Se vende según el stock de cada talla/color.",
  },
  {
    value: "SUPPLIER",
    label: "Proveedor / dropshipping",
    hint: "Catálogo de un proveedor o dropshipping. Sin stock propio; la tienda muestra \"Disponible\".",
  },
  {
    value: "PREORDER",
    label: "Bajo pedido",
    hint: "Ya lo compraste y viene en camino (ej. China o EE. UU.). La tienda muestra \"Disponible bajo pedido\".",
  },
]

export const isAvailability = (value: unknown): value is Availability =>
  AVAILABILITY_OPTIONS.some((option) => option.value === value)

export const availabilityLabel = (value?: Availability | null) =>
  AVAILABILITY_OPTIONS.find((option) => option.value === value)?.label ?? "Inventario propio"

// Proveedor/dropshipping y bajo pedido se venden sin limite de stock propio
export const sellsWithoutStock = (value?: Availability | null) => value === "SUPPLIER" || value === "PREORDER"
