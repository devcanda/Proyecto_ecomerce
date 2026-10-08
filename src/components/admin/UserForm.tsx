"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ASSIGNABLE_ROLES, MIN_PASSWORD_LENGTH, USER_STATUSES, type Role, type UserStatusValue } from "@/lib/roles"
import { cn } from "@/lib/utils"

const FIELD_CLASS = "border-neutral-300 dark:border-input"

// Datos de un usuario existente para el modo edicion
export interface EditableUser {
  id: string
  name: string
  email: string
  phone: string
  role: Role
  status: UserStatusValue
  orders: number
  isSelf: boolean
}

const roles = ["CUSTOMER", "EDITOR", "ADMIN"] as const
const statuses = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const

const buildSchema = (isEdit: boolean) =>
  z
    .object({
      name: z.string().trim().min(1, "El nombre es requerido"),
      email: z.string().trim().email("Correo no válido"),
      phone: z.string().trim(),
      role: z.enum(roles),
      status: z.enum(statuses),
      // Al editar, la contraseña es opcional: vacía = no se cambia
      password: isEdit
        ? z.string().refine((value) => value === "" || value.length >= MIN_PASSWORD_LENGTH, {
            message: `Mínimo ${MIN_PASSWORD_LENGTH} caracteres`,
          })
        : z.string().min(MIN_PASSWORD_LENGTH, `Mínimo ${MIN_PASSWORD_LENGTH} caracteres`),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Las contraseñas no coinciden",
      path: ["confirmPassword"],
    })

type UserFormData = z.infer<ReturnType<typeof buildSchema>>

export function UserForm({ user }: { user?: EditableUser }) {
  const router = useRouter()
  const isEdit = Boolean(user)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(buildSchema(isEdit)),
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      role: (user?.role === "MODERATOR" ? "CUSTOMER" : user?.role) ?? "CUSTOMER",
      status: user?.status ?? "ACTIVE",
      password: "",
      confirmPassword: "",
    },
  })

  const role = watch("role")
  const status = watch("status")
  // Un administrador no puede cambiar su propio rol ni desactivarse
  const lockSelf = Boolean(user?.isSelf)

  const onSubmit = async (data: UserFormData) => {
    setSaving(true)
    setSaveError(null)
    try {
      const body: Record<string, string> = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: data.role,
      }
      if (isEdit) body.status = data.status
      if (data.password) body.password = data.password

      const response = await fetch(isEdit ? `/api/users/${user!.id}` : "/api/users", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || "No se pudo guardar el usuario")

      router.push("/admin/users")
      router.refresh()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se pudo guardar el usuario")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? "Editar usuario" : "Nuevo usuario"}</h1>
          <p className="text-muted-foreground">
            {isEdit ? "Corrige sus datos, cambia su rol o su contraseña" : "Crea una cuenta y define qué puede hacer"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
        {/* Datos */}
        <Card>
          <CardHeader>
            <CardTitle>Datos del usuario</CardTitle>
            <CardDescription>
              El correo es con el que inicia sesión (no importan las mayúsculas).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre completo</Label>
                <Input id="name" className={FIELD_CLASS} placeholder="Ej. Laura Gómez" {...register("name")} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="off"
                  className={FIELD_CLASS}
                  placeholder="laura@correo.com"
                  {...register("email")}
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
            </div>
            <div className="space-y-2 sm:max-w-sm">
              <Label htmlFor="phone">
                Teléfono <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input id="phone" className={FIELD_CLASS} placeholder="+57 300 123 4567" {...register("phone")} />
            </div>
          </CardContent>
        </Card>

        {/* Rol y estado */}
        <Card>
          <CardHeader>
            <CardTitle>Permisos</CardTitle>
            <CardDescription>Qué puede hacer este usuario en la tienda y en el panel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Rol</Label>
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Rol">
                {ASSIGNABLE_ROLES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={role === option.value}
                    disabled={lockSelf}
                    onClick={() => setValue("role", option.value as UserFormData["role"])}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                      role === option.value
                        ? "border-brand-blue bg-brand-blue/10"
                        : "border-neutral-300 hover:border-brand-blue/60 dark:border-input"
                    )}
                  >
                    <span className={cn("block text-sm font-semibold", role === option.value && "text-brand-link")}>
                      {option.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">{option.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {isEdit && (
              <div className="space-y-2">
                <Label>Estado de la cuenta</Label>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Estado">
                  {USER_STATUSES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={status === option.value}
                      disabled={lockSelf}
                      title={option.hint}
                      onClick={() => setValue("status", option.value)}
                      className={cn(
                        "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                        status === option.value
                          ? option.value === "ACTIVE"
                            ? "border-green-600 bg-green-600/10 text-green-700 dark:text-green-400"
                            : "border-destructive bg-destructive/10 text-destructive"
                          : "border-neutral-300 text-muted-foreground hover:border-brand-blue/60 dark:border-input"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Inactivo o suspendido: no puede iniciar sesión (si tenía la sesión abierta, se cierra en segundos).
                </p>
              </div>
            )}

            {lockSelf && (
              <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                Esta es tu propia cuenta: no puedes cambiar tu rol ni desactivarla.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Contraseña */}
        <Card>
          <CardHeader>
            <CardTitle>{isEdit ? "Cambiar contraseña" : "Contraseña"}</CardTitle>
            <CardDescription>
              {isEdit
                ? "Déjala vacía para mantener la contraseña actual."
                : `Mínimo ${MIN_PASSWORD_LENGTH} caracteres. Compártela con el usuario por un medio seguro.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">{isEdit ? "Nueva contraseña" : "Contraseña"}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className={cn("pr-10", FIELD_CLASS)}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    <span className="sr-only">{showPassword ? "Ocultar" : "Mostrar"} contraseña</span>
                  </button>
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Repite la contraseña</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className={FIELD_CLASS}
                  {...register("confirmPassword")}
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {saveError && <p className="text-sm text-destructive">{saveError}</p>}

        <div className="flex gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/users">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : isEdit ? (
              "Guardar cambios"
            ) : (
              "Crear usuario"
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
