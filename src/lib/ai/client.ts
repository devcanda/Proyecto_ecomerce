import { createAnthropicClient } from "@/lib/ai/anthropic"
import { createOpenAiCompatibleClient } from "@/lib/ai/openai-compatible"
import { isAiReady, type AiConfig } from "@/lib/ai/settings"
import { AiError, type AiClient } from "@/lib/ai/types"

// Cliente de IA segun lo configurado en el panel
export function createAiClient(config: AiConfig): AiClient {
  if (!isAiReady(config)) throw new AiError("La IA no está configurada. Ve a Configuración > Inteligencia artificial.")
  if (config.provider === "anthropic") return createAnthropicClient(config.apiKey!, config.model)
  return createOpenAiCompatibleClient(config.baseUrl, config.apiKey, config.model)
}
