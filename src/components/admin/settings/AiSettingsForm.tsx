"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { CheckCircle2, ExternalLink, Eye, EyeOff, Loader2, PlugZap, Save, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AI_PROVIDERS,
  aiProviderInfo,
  IMAGE_SEARCH_PROVIDERS,
  type AiProviderId,
  type AiSettingsView,
  type ImageSearchProviderId,
} from "@/lib/ai/providers"
import { cn } from "@/lib/utils"

const FIELD_CLASS = "border-neutral-300 dark:border-input"

const schema = z
  .object({
    provider: z.enum(["anthropic", "openai", "gemini", "openai-compatible"]),
    model: z.string().trim().min(1, "Escribe el modelo"),
    baseUrl: z.string().trim(),
    apiKey: z.string().trim(),
    searchProvider: z.enum(["serper"]),
    searchApiKey: z.string().trim(),
  })
  .refine((data) => data.provider !== "openai-compatible" || /^https?:\/\/\S+$/.test(data.baseUrl), {
    message: "Escribe la dirección de la API (ej. https://openrouter.ai/api/v1)",
    path: ["baseUrl"],
  })

type FormData = z.infer<typeof schema>

type TestResult = { ai: { ok: boolean; message: string }; search: { ok: boolean; message: string } }

// Configuracion de la IA (proveedor, modelo y claves). Va en Configuracion > Inteligencia artificial
export function AiSettingsForm() {
  const [view, setView] = useState<AiSettingsView | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [test, setTest] = useState<TestResult | null>(null)
  const [showKeys, setShowKeys] = useState(false)
  // Modelos que permite la clave guardada (se consultan al proveedor)
  const [models, setModels] = useState<{ list: string[]; error?: string; loading: boolean }>({ list: [], loading: false })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { provider: "anthropic", model: "", baseUrl: "", apiKey: "", searchProvider: "serper", searchApiKey: "" },
  })

  const loadModels = async () => {
    setModels((current) => ({ ...current, loading: true }))
    try {
      const response = await fetch("/api/admin/ai/models")
      const data = await response.json()
      setModels({ list: data.models ?? [], error: data.error, loading: false })
    } catch {
      setModels({ list: [], error: "No se pudo leer la lista de modelos", loading: false })
    }
  }

  const fill = (data: AiSettingsView) => {
    setView(data)
    if (data.hasApiKey || data.provider === "openai-compatible") loadModels()
    else setModels({ list: [], loading: false })
    reset({
      provider: data.provider,
      model: data.model,
      baseUrl: data.baseUrl,
      apiKey: "",
      searchProvider: data.search.provider,
      searchApiKey: "",
    })
  }

  useEffect(() => {
    fetch("/api/admin/ai/settings")
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "No se pudo cargar la configuración")
        fill(data)
      })
      .catch((error) => setLoadError(error.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const provider = watch("provider")
  const searchProvider = watch("searchProvider")
  const info = aiProviderInfo(provider)
  const searchInfo = IMAGE_SEARCH_PROVIDERS.find((item) => item.id === searchProvider)!
  // La clave guardada solo sirve si no se cambio de proveedor
  const keepsKey = view?.provider === provider && view.hasApiKey
  const keepsSearchKey = view?.search.provider === searchProvider && view.search.hasApiKey

  const chooseProvider = (id: AiProviderId) => {
    const next = aiProviderInfo(id)
    setValue("provider", id, { shouldDirty: true })
    setValue("model", id === view?.provider ? view.model : next.defaultModel ?? "", { shouldDirty: true })
    setValue("baseUrl", next.baseUrlEditable ? (id === view?.provider ? view.baseUrl : "") : next.baseUrl ?? "", { shouldDirty: true })
  }

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    setSaveMessage(null)
    setTest(null)
    try {
      const response = await fetch("/api/admin/ai/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: data.provider,
          model: data.model,
          baseUrl: data.baseUrl,
          // Vacio = se mantiene la clave guardada
          apiKey: data.apiKey || undefined,
          search: { provider: data.searchProvider, apiKey: data.searchApiKey || undefined },
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo guardar")
      fill(result)
      setSaveMessage({ ok: true, text: "Configuración guardada." })
    } catch (error) {
      setSaveMessage({ ok: false, text: error instanceof Error ? error.message : "No se pudo guardar" })
    } finally {
      setSaving(false)
    }
  }

  const runTest = async () => {
    setTesting(true)
    setTest(null)
    try {
      const response = await fetch("/api/admin/ai/test", { method: "POST" })
      setTest(await response.json())
    } catch {
      setTest({ ai: { ok: false, message: "No se pudo hacer la prueba" }, search: { ok: false, message: "" } })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Conecta la IA que usará la tienda (por ahora, para buscar fotos de productos).</p>

      {loadError ? (
        <p className="text-destructive">{loadError}</p>
      ) : !view ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
          {/* Proveedor de IA */}
          <Card>
            <CardHeader>
              <CardTitle>Proveedor de IA</CardTitle>
              <CardDescription>Debe ser un modelo que entienda imágenes (visión).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Proveedor de IA">
                {AI_PROVIDERS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={provider === option.id}
                    onClick={() => chooseProvider(option.id)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      provider === option.id ? "border-brand-blue bg-brand-blue/10" : "border-neutral-300 hover:border-brand-blue/60 dark:border-input"
                    )}
                  >
                    <span className={cn("block text-sm font-semibold", provider === option.id && "text-brand-link")}>{option.label}</span>
                    <span className="block text-xs text-muted-foreground">{option.hint}</span>
                  </button>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="model">Modelo</Label>
                  <Input id="model" list="model-suggestions" className={FIELD_CLASS} placeholder="Nombre exacto del modelo" {...register("model")} />
                  <datalist id="model-suggestions">
                    {info.modelSuggestions.map((model) => (
                      <option key={model} value={model} />
                    ))}
                  </datalist>
                  {errors.model && <p className="text-sm text-destructive">{errors.model.message}</p>}
                  {/* Lista real de modelos de la clave guardada (solo si no se cambio de proveedor) */}
                  {view.provider === provider &&
                    (models.loading ? (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Consultando los modelos disponibles...
                      </p>
                    ) : models.list.length > 0 ? (
                      <select
                        aria-label="Modelos disponibles"
                        value=""
                        onChange={(event) => event.target.value && setValue("model", event.target.value, { shouldDirty: true })}
                        className="h-9 w-full rounded-md border border-neutral-300 bg-background px-2 text-sm dark:border-input"
                      >
                        <option value="">Elegir de los {models.list.length} modelos disponibles para tu clave...</option>
                        {models.list.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                    ) : models.error ? (
                      <p className="text-xs text-destructive">{models.error}</p>
                    ) : null)}
                  {provider === "gemini" && (
                    <p className="text-xs text-muted-foreground">
                      Recomendado: un modelo &quot;flash&quot; (rápido y con plan gratuito). Evita los que digan &quot;preview&quot;.
                    </p>
                  )}
                  {provider === "anthropic" && (
                    <p className="text-xs text-muted-foreground">
                      claude-opus-5-5 es el más capaz; claude-sonnet-5-5 y claude-haiku-5-5 son más económicos.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="baseUrl">Dirección de la API</Label>
                  <Input
                    id="baseUrl"
                    className={FIELD_CLASS}
                    placeholder={info.baseUrlEditable ? "https://openrouter.ai/api/v1" : "Automática"}
                    disabled={!info.baseUrlEditable}
                    {...register("baseUrl")}
                  />
                  {errors.baseUrl && <p className="text-sm text-destructive">{errors.baseUrl.message}</p>}
                </div>
              </div>

              <SecretField
                id="apiKey"
                label="Clave de API"
                show={showKeys}
                onToggle={() => setShowKeys((value) => !value)}
                saved={keepsKey ? view.apiKeyHint : undefined}
                optional={provider === "openai-compatible"}
                keyUrl={info.keyUrl}
                register={register("apiKey")}
              />
            </CardContent>
          </Card>

          {/* Buscador de imagenes */}
          <Card>
            <CardHeader>
              <CardTitle>Buscador de imágenes</CardTitle>
              <CardDescription>La IA no navega sola: este servicio le entrega las fotos candidatas de internet.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Buscador de imágenes">
                {IMAGE_SEARCH_PROVIDERS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={searchProvider === option.id}
                    onClick={() => setValue("searchProvider", option.id as ImageSearchProviderId, { shouldDirty: true })}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      searchProvider === option.id ? "border-brand-blue bg-brand-blue/10" : "border-neutral-300 hover:border-brand-blue/60 dark:border-input"
                    )}
                  >
                    <span className={cn("block text-sm font-semibold", searchProvider === option.id && "text-brand-link")}>{option.label}</span>
                    <span className="block text-xs text-muted-foreground">{option.hint}</span>
                  </button>
                ))}
              </div>
              <SecretField
                id="searchApiKey"
                label="Clave del buscador"
                show={showKeys}
                onToggle={() => setShowKeys((value) => !value)}
                saved={keepsSearchKey ? view.search.apiKeyHint : undefined}
                keyUrl={searchInfo.keyUrl}
                register={register("searchApiKey")}
              />
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Las claves se guardan cifradas y nunca se vuelven a mostrar completas. Cada consulta se cobra en tu cuenta de cada
            proveedor.
          </p>

          {saveMessage && <p className={cn("text-sm", saveMessage.ok ? "text-green-700 dark:text-green-400" : "text-destructive")}>{saveMessage.text}</p>}

          {test && (
            <div className="space-y-1 rounded-lg border p-3 text-sm">
              {(
                [
                  ["IA", test.ai],
                  ["Buscador de imágenes", test.search],
                ] as const
              ).map(([label, item]) => (
                <p key={label} className="flex items-start gap-2">
                  {item.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                  <span>
                    <b>{label}:</b> {item.message}
                  </span>
                </p>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar
            </Button>
            <Button type="button" variant="outline" onClick={runTest} disabled={testing || isDirty}>
              {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
              Probar conexión
            </Button>
            {isDirty && <span className="self-center text-xs text-muted-foreground">Guarda los cambios antes de probar.</span>}
          </div>
        </form>
      )}
    </div>
  )
}

function SecretField({
  id,
  label,
  show,
  onToggle,
  saved,
  optional,
  keyUrl,
  register,
}: {
  id: string
  label: string
  show: boolean
  onToggle: () => void
  saved?: string
  optional?: boolean
  keyUrl?: string
  register: ReturnType<ReturnType<typeof useForm<FormData>>["register"]>
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {optional && <span className="font-normal text-muted-foreground"> (opcional en servidores locales)</span>}
      </Label>
      <div className="relative sm:max-w-md">
        <Input
          id={id}
          type={show ? "text" : "password"}
          autoComplete="off"
          className={cn("pr-10", FIELD_CLASS)}
          placeholder={saved ? `Guardada (${saved}). Escribe otra para cambiarla` : "Pega aquí la clave"}
          {...register}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <span className="sr-only">{show ? "Ocultar" : "Mostrar"}</span>
        </button>
      </div>
      {keyUrl && (
        <a href={keyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-link hover:underline">
          ¿Dónde consigo la clave? <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}
