// Roles de usuario y lo que puede hacer cada uno

export type Role = "ADMIN" | "EDITOR" | "CUSTOMER" | "MODERATOR"

// Roles que se pueden asignar desde el panel
export const ASSIGNABLE_ROLES: { value: Role; label: string; hint: string }[] = [
  { value: "CUSTOMER", label: "Cliente", hint: "Compra en la tienda. No entra al panel." },
  { value: "EDITOR", label: "Editor de productos", hint: "Entra al panel solo para crear y editar productos." },
  { value: "ADMIN", label: "Administrador", hint: "Acceso completo: productos, usuarios, pedidos y configuración." },
]

export const USER_STATUSES = [
  { value: "ACTIVE", label: "Activo", hint: "Puede iniciar sesión." },
  { value: "INACTIVE", label: "Inactivo", hint: "No puede iniciar sesión." },
  { value: "SUSPENDED", label: "Suspendido", hint: "Bloqueado: no puede iniciar sesión." },
] as const

export type UserStatusValue = (typeof USER_STATUSES)[number]["value"]

export const roleLabel = (role?: string | null) =>
  ASSIGNABLE_ROLES.find((item) => item.value === role?.toUpperCase())?.label ?? (role === "MODERATOR" ? "Moderador" : "Cliente")

export const isAssignableRole = (value: unknown): value is Role =>
  typeof value === "string" && ASSIGNABLE_ROLES.some((item) => item.value === value)

export const isUserStatus = (value: unknown): value is UserStatusValue =>
  typeof value === "string" && USER_STATUSES.some((item) => item.value === value)

// Quien puede entrar al panel de productos
export const canManageProducts = (role?: string | null) => role === "ADMIN" || role === "EDITOR"

export const isAdminRole = (role?: string | null) => role === "ADMIN"

// Correo en un formato unico (sin espacios ni mayusculas) para guardar y para iniciar sesion
export const normalizeEmail = (email: string) => email.trim().toLowerCase()

export const MIN_PASSWORD_LENGTH = 8
