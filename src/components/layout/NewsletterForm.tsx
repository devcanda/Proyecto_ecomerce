"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Mail } from "lucide-react"

const newsletterSchema = z.object({
  email: z.string().email("Ingresa un email valido"),
})

type NewsletterFormData = z.infer<typeof newsletterSchema>

export function NewsletterForm() {
  const [subscribed, setSubscribed] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewsletterFormData>({
    resolver: zodResolver(newsletterSchema),
  })

  // TODO: conectar a un Route Handler cuando exista el backend del boletin
  const onSubmit = () => {
    setSubscribed(true)
    reset()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-3 max-w-sm">
      <div className="flex items-center gap-2 rounded-md border border-white/15 bg-white/5 p-1.5 pl-3">
        <Mail className="h-4 w-4 shrink-0 text-white/50" />
        <input
          type="email"
          placeholder="Ingresa tu email"
          {...register("email")}
          className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded bg-cream px-4 py-2 text-xs font-medium text-brand-dark transition-colors hover:bg-white"
        >
          Suscribirme
        </button>
      </div>
      {errors.email && (
        <p className="mt-2 text-xs text-red-300">{errors.email.message}</p>
      )}
      {subscribed && !errors.email && (
        <p className="mt-2 text-xs text-white/70">¡Gracias por suscribirte!</p>
      )}
    </form>
  )
}
