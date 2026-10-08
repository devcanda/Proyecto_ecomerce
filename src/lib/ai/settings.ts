import { prisma } from "@/lib/prisma"
import { decryptSecret, encryptSecret } from "@/lib/secret-box"
import {
  aiProviderInfo,
  isAiProviderId,
  isImageSearchProviderId,
  type AiProviderId,
  type AiSettingsView,
  type ImageSearchProviderId,
} from "@/lib/ai/providers"

const SETTINGS_KEY = "ai"

// Como se guarda en la tabla app_settings (claves cifradas)
interface StoredAiSettings {
  provider?: AiProviderId
  model?: string
  baseUrl?: string
  apiKey?: string
  search?: { provider?: string; apiKey?: string }
}

// Configuracion lista para usar en el servidor (claves descifradas)
export interface AiConfig {
  provider: AiProviderId
  model: string
  baseUrl: string
  apiKey: string | null
  search: { provider: ImageSearchProviderId; apiKey: string | null }
}

async function readStored(): Promise<StoredAiSettings> {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } })
  return (row?.value as StoredAiSettings | null) ?? {}
}

export async function getAiConfig(): Promise<AiConfig> {
  const stored = await readStored()
  const provider = isAiProviderId(stored.provider) ? stored.provider : "anthropic"
  const info = aiProviderInfo(provider)
  return {
    provider,
    model: stored.model || info.defaultModel || "",
    baseUrl: (info.baseUrlEditable ? stored.baseUrl : info.baseUrl) ?? "",
    apiKey: decryptSecret(stored.apiKey),
    // Una clave guardada para un buscador que ya no existe (ej. Google) no se usa
    search: stored.search && isImageSearchProviderId(stored.search.provider)
      ? { provider: stored.search.provider, apiKey: decryptSecret(stored.search.apiKey) }
      : { provider: "serper", apiKey: null },
  }
}

const hint = (secret: string | null) => (secret ? `•••• ${secret.slice(-4)}` : undefined)

export function isAiReady(config: AiConfig) {
  // Ollama y otros servidores locales no piden clave
  if (config.provider === "openai-compatible") return Boolean(config.model && config.baseUrl)
  return Boolean(config.model && config.apiKey)
}

export function isSearchReady(config: AiConfig) {
  return Boolean(config.search.apiKey)
}

export async function getAiSettingsView(): Promise<AiSettingsView> {
  const config = await getAiConfig()
  return {
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    hasApiKey: Boolean(config.apiKey),
    apiKeyHint: hint(config.apiKey),
    search: {
      provider: config.search.provider,
      hasApiKey: Boolean(config.search.apiKey),
      apiKeyHint: hint(config.search.apiKey),
    },
    aiReady: isAiReady(config),
    searchReady: isSearchReady(config),
  }
}

export interface AiSettingsInput {
  provider: AiProviderId
  model: string
  baseUrl?: string
  // Vacio = se mantiene la clave guardada; null = se borra
  apiKey?: string | null
  search: { provider: ImageSearchProviderId; apiKey?: string | null }
}

export async function saveAiSettings(input: AiSettingsInput) {
  const current = await readStored()
  // Al cambiar de proveedor la clave anterior ya no sirve
  const sameProvider = current.provider === input.provider
  const sameSearch = current.search?.provider === input.search.provider
  const nextKey = (value: string | null | undefined, previous: string | undefined, keep: boolean) =>
    value === null ? undefined : value ? encryptSecret(value) : keep ? previous : undefined

  const value: StoredAiSettings = {
    provider: input.provider,
    model: input.model.trim(),
    baseUrl: input.baseUrl?.trim().replace(/\/+$/, "") || undefined,
    apiKey: nextKey(input.apiKey === null ? null : input.apiKey?.trim(), current.apiKey, sameProvider),
    search: {
      provider: input.search.provider,
      apiKey: nextKey(input.search.apiKey === null ? null : input.search.apiKey?.trim(), current.search?.apiKey, sameSearch),
    },
  }
  await prisma.appSetting.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: value as object },
    create: { key: SETTINGS_KEY, value: value as object },
  })
}
