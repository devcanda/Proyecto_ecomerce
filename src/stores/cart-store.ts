import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Product, CartItem, ProductVariant } from "@/types"

// Cada talla/color es una linea distinta del carrito
export const cartItemKey = (item: Pick<CartItem, "product" | "variant">) =>
  item.variant ? `${item.product.id}:${item.variant.id}` : item.product.id

// Precio unitario: el de la variante elegida o el del producto
export const cartItemPrice = (item: CartItem) => item.variant?.price ?? item.product.price

// Stock disponible de la linea
export const cartItemStock = (item: CartItem) => item.variant?.stock ?? item.product.stock

// Texto de la variante: "Talla 40 · Negro"
export const variantText = (variant?: Pick<ProductVariant, "size" | "color">) =>
  variant
    ? [variant.size ? `Talla ${variant.size}` : null, variant.color || null].filter(Boolean).join(" · ")
    : ""

interface CartState {
  items: CartItem[]

  // Actions (key = cartItemKey del item)
  addItem: (product: Product, quantity?: number, variant?: ProductVariant) => void
  removeItem: (key: string) => void
  updateQuantity: (key: string, quantity: number) => void
  clearCart: () => void

  // Computed helpers
  getSubtotal: () => number
  getItemCount: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, quantity = 1, variant) => {
        const key = cartItemKey({ product, variant })
        set((state) => {
          const existingItem = state.items.find((item) => cartItemKey(item) === key)

          if (existingItem) {
            return {
              items: state.items.map((item) =>
                cartItemKey(item) === key
                  ? { ...item, quantity: item.quantity + quantity }
                  : item
              ),
            }
          }

          return {
            items: [...state.items, { product, quantity, variant }],
          }
        })
      },

      removeItem: (key) => {
        set((state) => ({
          items: state.items.filter((item) => cartItemKey(item) !== key),
        }))
      },

      updateQuantity: (key, quantity) => {
        if (quantity <= 0) {
          get().removeItem(key)
          return
        }

        set((state) => ({
          items: state.items.map((item) =>
            cartItemKey(item) === key ? { ...item, quantity } : item
          ),
        }))
      },

      clearCart: () => {
        set({ items: [] })
      },

      getSubtotal: () => {
        return get().items.reduce(
          (total, item) => total + cartItemPrice(item) * item.quantity,
          0
        )
      },

      getItemCount: () => {
        return get().items.reduce((count, item) => count + item.quantity, 0)
      },
    }),
    {
      name: "basictech-cart",
    }
  )
)
