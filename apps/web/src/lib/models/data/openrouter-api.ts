import { createOpenAI } from "@ai-sdk/openai"
import { ModelConfig } from "../types"

/**
 * Creates an OpenRouter-compatible provider using @ai-sdk/openai
 * OpenRouter exposes an OpenAI-compatible API at https://openrouter.ai/api/v1
 */
function createOpenRouterProvider(apiKey?: string, extraBody?: Record<string, unknown>) {
  return createOpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: apiKey || process.env.OPENROUTER_API_KEY || "",
    headers: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://hive.chat",
      "X-Title": "Hive Chat",
    },
    fetch: extraBody
      ? async (url, options) => {
          // Inject extraBody into the request body for web search plugins
          const body = options?.body ? JSON.parse(options.body as string) : {}
          return fetch(url, {
            ...options,
            body: JSON.stringify({ ...body, ...extraBody }),
          })
        }
      : undefined,
  })
}

// OpenRouter API response types
interface OpenRouterModel {
  id: string
  name: string
  description?: string
  context_length: number
  pricing: {
    prompt: string // Cost per token as string (e.g., "0.000001")
    completion: string
  }
  architecture?: {
    modality?: string
    tokenizer?: string
    instruct_type?: string
  }
  top_provider?: {
    max_completion_tokens?: number
    is_moderated?: boolean
  }
  per_request_limits?: {
    prompt_tokens?: string
    completion_tokens?: string
  }
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[]
}

// Provider mapping for icons and base provider IDs
const PROVIDER_MAP: Record<
  string,
  { icon: string; baseProviderId: string; providerName: string }
> = {
  openai: { icon: "openai", baseProviderId: "openai", providerName: "OpenAI" },
  anthropic: {
    icon: "claude",
    baseProviderId: "claude",
    providerName: "Anthropic",
  },
  google: { icon: "gemini", baseProviderId: "google", providerName: "Google" },
  "x-ai": { icon: "xai", baseProviderId: "xai", providerName: "xAI" },
  mistralai: {
    icon: "mistral",
    baseProviderId: "mistral",
    providerName: "Mistral",
  },
  deepseek: {
    icon: "deepseek",
    baseProviderId: "deepseek",
    providerName: "DeepSeek",
  },
  perplexity: {
    icon: "perplexity",
    baseProviderId: "perplexity",
    providerName: "Perplexity",
  },
  "meta-llama": {
    icon: "meta",
    baseProviderId: "meta",
    providerName: "Meta",
  },
  cohere: {
    icon: "cohere",
    baseProviderId: "cohere",
    providerName: "Cohere",
  },
}

// Only include these specific models (latest/recommended from each provider)
// This list should be updated periodically to include new flagship models
// Model IDs must match exactly what OpenRouter API returns
// All models verified to support tools via OpenRouter API (except Perplexity)
const ALLOWED_MODELS = new Set([
  // OpenAI - Latest flagship models
  "openai/gpt-5.2",
  "openai/gpt-5.2-pro",
  "openai/gpt-5.1",
  "openai/gpt-5",
  "openai/gpt-5-pro",
  "openai/o4-mini",
  "openai/o3",
  "openai/o3-pro",
  "openai/gpt-4.1",
  "openai/gpt-4.1-mini",

  // Anthropic - Latest Claude models
  "anthropic/claude-opus-4.5",
  "anthropic/claude-sonnet-4.5",
  "anthropic/claude-haiku-4.5",
  "anthropic/claude-opus-4",
  "anthropic/claude-opus-4.1",
  "anthropic/claude-sonnet-4",

  // Google - Latest Gemini models
  "google/gemini-3-pro-preview",
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",

  // xAI - Latest Grok models
  "x-ai/grok-4",
  "x-ai/grok-4-fast",
  "x-ai/grok-4.1-fast",

  // DeepSeek - Latest models (tools supported)
  "deepseek/deepseek-v3.2",
  "deepseek/deepseek-r1-0528",
  "deepseek/deepseek-chat-v3.1",

  // Perplexity - Sonar models (NO tools support, web search only)
  "perplexity/sonar-pro",
  "perplexity/sonar-pro-search",
  "perplexity/sonar-reasoning-pro",
  "perplexity/sonar-deep-research",

  // Mistral - Latest models
  "mistralai/mistral-large-2512",
  "mistralai/mistral-medium-3",
  "mistralai/mistral-medium-3.1",
  "mistralai/mistral-small-creative",
])

// Cache for fetched models
let openrouterModelsCache: ModelConfig[] | null = null
let lastFetchTime = 0
const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes

/**
 * Fetches the latest models from OpenRouter's API
 */
export async function fetchOpenRouterModels(): Promise<ModelConfig[]> {
  const now = Date.now()

  // Use cache if valid
  if (openrouterModelsCache && now - lastFetchTime < CACHE_DURATION) {
    return openrouterModelsCache
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        "Content-Type": "application/json",
      },
      next: { revalidate: 600 }, // Cache for 10 minutes
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch OpenRouter models: ${response.status}`)
    }

    const data: OpenRouterModelsResponse = await response.json()

    // Log available model IDs for debugging
    const availableIds = data.data.map((m) => m.id)
    const allowedArray = Array.from(ALLOWED_MODELS)
    const missingModels = allowedArray.filter((id) => !availableIds.includes(id))
    if (missingModels.length > 0) {
      console.log(
        "OpenRouter: These models in ALLOWED_MODELS are not available:",
        missingModels
      )
    }

    // Filter to only allowed models and transform them
    const models = data.data
      .filter((model) => {
        // Only include models in our curated list
        return ALLOWED_MODELS.has(model.id)
      })
      .map((model) => transformOpenRouterModel(model))
      .filter((model): model is ModelConfig => model !== null)

    console.log(`OpenRouter: Fetched ${models.length} models`)

    // Sort by provider name
    models.sort((a, b) => a.provider.localeCompare(b.provider))

    openrouterModelsCache = models
    lastFetchTime = now

    return models
  } catch (error) {
    console.warn("Failed to fetch OpenRouter models:", error)
    // Return cached models if available, otherwise empty array
    return openrouterModelsCache || []
  }
}

/**
 * Transforms an OpenRouter API model to our ModelConfig format
 */
function transformOpenRouterModel(model: OpenRouterModel): ModelConfig | null {
  const providerSlug = model.id.split("/")[0]
  const providerInfo = PROVIDER_MAP[providerSlug]

  if (!providerInfo) {
    return null
  }

  // Parse pricing (convert from per-token to per-million tokens)
  const inputCost = parseFloat(model.pricing.prompt) * 1_000_000
  const outputCost = parseFloat(model.pricing.completion) * 1_000_000

  // Determine capabilities from model name/description
  const nameLower = model.name.toLowerCase()
  const descLower = (model.description || "").toLowerCase()
  const hasVision =
    nameLower.includes("vision") ||
    descLower.includes("vision") ||
    descLower.includes("image")
  const hasReasoning =
    nameLower.includes("reasoning") ||
    nameLower.includes("think") ||
    descLower.includes("reasoning") ||
    model.id.includes("o1") ||
    model.id.includes("o3") ||
    model.id.includes("o4") ||
    model.id.includes("r1")
  const hasAudio =
    descLower.includes("audio") || descLower.includes("multimodal")

  // Determine speed based on model name
  let speed: "Fast" | "Medium" | "Slow" = "Medium"
  if (
    nameLower.includes("flash") ||
    nameLower.includes("mini") ||
    nameLower.includes("nano") ||
    nameLower.includes("fast") ||
    nameLower.includes("lite")
  ) {
    speed = "Fast"
  } else if (
    nameLower.includes("opus") ||
    nameLower.includes("pro") ||
    nameLower.includes("large")
  ) {
    speed = "Slow"
  }

  // Determine intelligence level
  let intelligence: "Low" | "Medium" | "High" = "Medium"
  if (
    nameLower.includes("opus") ||
    nameLower.includes("pro") ||
    nameLower.includes("large") ||
    nameLower.includes("gpt-5") ||
    nameLower.includes("gpt-4.5") ||
    nameLower.includes("sonnet-4") ||
    nameLower.includes("grok-3") ||
    nameLower.includes("grok-4")
  ) {
    intelligence = "High"
  } else if (
    nameLower.includes("nano") ||
    nameLower.includes("3b") ||
    nameLower.includes("7b") ||
    nameLower.includes("8b")
  ) {
    intelligence = "Low"
  }

  // Determine model family
  let modelFamily = providerInfo.providerName
  if (model.id.includes("gpt-5")) modelFamily = "GPT-5"
  else if (model.id.includes("gpt-4")) modelFamily = "GPT-4"
  else if (model.id.includes("claude-sonnet")) modelFamily = "Claude Sonnet"
  else if (model.id.includes("claude-opus")) modelFamily = "Claude Opus"
  else if (model.id.includes("claude-haiku")) modelFamily = "Claude Haiku"
  else if (model.id.includes("gemini-3")) modelFamily = "Gemini 3"
  else if (model.id.includes("gemini-2.5")) modelFamily = "Gemini 2.5"
  else if (model.id.includes("gemini-2")) modelFamily = "Gemini 2"
  else if (model.id.includes("grok-4")) modelFamily = "Grok 4"
  else if (model.id.includes("grok-3")) modelFamily = "Grok 3"
  else if (model.id.includes("grok-2")) modelFamily = "Grok 2"
  else if (model.id.includes("sonar")) modelFamily = "Sonar"
  else if (model.id.includes("deepseek-r1")) modelFamily = "DeepSeek R1"
  else if (model.id.includes("deepseek-v3")) modelFamily = "DeepSeek V3"

  // Generate tags
  const tags: string[] = []
  if (inputCost === 0) tags.push("free")
  if (speed === "Fast") tags.push("fast")
  if (hasVision) tags.push("vision")
  if (hasReasoning) tags.push("reasoning")
  if (hasAudio) tags.push("audio")
  if (intelligence === "High") tags.push("flagship")
  if (nameLower.includes("preview") || nameLower.includes("beta"))
    tags.push("preview")

  // Truncate description to ~100 chars, ending at a sentence or word boundary
  let description =
    model.description ||
    `${providerInfo.providerName} model available via OpenRouter`
  if (description.length > 120) {
    // Try to cut at sentence boundary
    const sentenceEnd = description.slice(0, 120).lastIndexOf(".")
    if (sentenceEnd > 60) {
      description = description.slice(0, sentenceEnd + 1)
    } else {
      // Cut at word boundary
      const wordEnd = description.slice(0, 117).lastIndexOf(" ")
      description = description.slice(0, wordEnd > 60 ? wordEnd : 117) + "..."
    }
  }

  return {
    id: `openrouter:${model.id}`,
    name: model.name,
    provider: "OpenRouter",
    providerId: "openrouter",
    modelFamily,
    baseProviderId: providerInfo.baseProviderId,
    description,
    tags,
    contextWindow: model.context_length,
    inputCost: Math.round(inputCost * 100) / 100, // Round to 2 decimal places
    outputCost: Math.round(outputCost * 100) / 100,
    priceUnit: "per 1M tokens",
    vision: hasVision,
    tools: providerSlug !== "perplexity", // Perplexity models don't support tools
    audio: hasAudio,
    reasoning: hasReasoning,
    webSearch: true, // OpenRouter supports web search plugin
    openSource: false,
    speed,
    intelligence,
    website: "https://openrouter.ai",
    apiDocs: `https://openrouter.ai/${model.id}`,
    modelPage: `https://openrouter.ai/${model.id}`,
    icon: providerInfo.icon,
    apiSdk: (apiKey?: string, opts?: { enableSearch?: boolean }) => {
      const extraBody = opts?.enableSearch
        ? { plugins: [{ id: "web", max_results: 3 }] }
        : undefined
      // Use .chat() to force Chat Completions API (OpenRouter doesn't support Responses API)
      return createOpenRouterProvider(apiKey, extraBody).chat(model.id)
    },
  }
}

/**
 * Force refresh the OpenRouter models cache
 */
export function refreshOpenRouterModelsCache(): void {
  openrouterModelsCache = null
  lastFetchTime = 0
}
