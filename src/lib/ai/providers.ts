// Proveedores de IA e imagenes disponibles (sin dependencias de servidor: lo usa tambien el formulario)

export type AiProviderId = "anthropic" | "openai" | "gemini" | "openai-compatible"
export type ImageSearchProviderId = "serper"

export interface AiProviderInfo {
  id: AiProviderId
  label: string
  hint: string
  // Direccion de la API (las compatibles con OpenAI la necesitan)
  baseUrl?: string
  baseUrlEditable: boolean
  defaultModel?: string
  modelSuggestions: string[]
  keyUrl?: string
}

export const AI_PROVIDERS: AiProviderInfo[] = [
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    hint: "Modelos Claude, con visión de imágenes.",
    baseUrlEditable: false,
    defaultModel: "claude-opus-5-5",
    modelSuggestions: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "openai",
    label: "OpenAI",
    hint: "Usa un modelo con visión de imágenes.",
    baseUrl: "https://api.openai.com/v1",
    baseUrlEditable: false,
    modelSuggestions: [],
    keyUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    hint: "Por su API compatible con OpenAI. Usa un modelo con visión.",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    baseUrlEditable: false,
    modelSuggestions: [],
    keyUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "openai-compatible",
    label: "Otra compatible con OpenAI",
    hint: "OpenRouter, Groq, DeepSeek, Ollama, LM Studio... Escribe la dirección de su API.",
    baseUrlEditable: true,
    modelSuggestions: [],
  },
]

export const IMAGE_SEARCH_PROVIDERS: { id: ImageSearchProviderId; label: string; hint: string; keyUrl: string }[] = [
  {
    id: "serper",
    label: "Serper.dev (Google Imágenes)",
    hint: "Resultados de Google Imágenes. Solo necesita la clave de API.",
    keyUrl: "https://serper.dev/api-keys",
  },
]

export const aiProviderInfo = (id: AiProviderId) => AI_PROVIDERS.find((provider) => provider.id === id)!

export const isAiProviderId = (value: unknown): value is AiProviderId => AI_PROVIDERS.some((provider) => provider.id === value)
export const isImageSearchProviderId = (value: unknown): value is ImageSearchProviderId =>
  IMAGE_SEARCH_PROVIDERS.some((provider) => provider.id === value)

// Lo que el panel puede ver de la configuracion (nunca las claves completas)
export interface AiSettingsView {
  provider: AiProviderId
  model: string
  baseUrl: string
  hasApiKey: boolean
  apiKeyHint?: string
  search: {
    provider: ImageSearchProviderId
    hasApiKey: boolean
    apiKeyHint?: string
  }
  aiReady: boolean
  searchReady: boolean
}
