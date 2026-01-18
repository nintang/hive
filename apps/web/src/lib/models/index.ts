import { FREE_MODELS_IDS } from "../config"
import { getOllamaModels, ollamaModels } from "./data/ollama"
import {
  fetchOpenRouterModels,
  refreshOpenRouterModelsCache,
} from "./data/openrouter-api"
import { ModelConfig } from "./types"

// Static models - only Ollama as fallback
// All other models are now fetched dynamically from OpenRouter
const STATIC_MODELS: ModelConfig[] = [
  ...ollamaModels, // Static fallback Ollama models
]

// Dynamic models cache
let dynamicModelsCache: ModelConfig[] | null = null
let lastFetchTime = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Function to get all models including dynamically detected ones
export async function getAllModels(): Promise<ModelConfig[]> {
  const now = Date.now()

  // Use cache if it's still valid
  if (dynamicModelsCache && now - lastFetchTime < CACHE_DURATION) {
    return dynamicModelsCache
  }

  try {
    // Fetch models from OpenRouter API and Ollama in parallel
    const [openRouterModels, detectedOllamaModels] = await Promise.all([
      fetchOpenRouterModels(),
      getOllamaModels(),
    ])

    // Combine OpenRouter models with Ollama models
    dynamicModelsCache = [...openRouterModels, ...detectedOllamaModels]

    lastFetchTime = now
    return dynamicModelsCache
  } catch (error) {
    console.warn("Failed to load dynamic models, using static models:", error)
    return STATIC_MODELS
  }
}

export async function getModelsWithAccessFlags(): Promise<ModelConfig[]> {
  const models = await getAllModels()

  const freeModels = models
    .filter(
      (model) =>
        FREE_MODELS_IDS.includes(model.id) || model.providerId === "ollama"
    )
    .map((model) => ({
      ...model,
      accessible: true,
    }))

  const proModels = models
    .filter((model) => !freeModels.map((m) => m.id).includes(model.id))
    .map((model) => ({
      ...model,
      accessible: false,
    }))

  return [...freeModels, ...proModels]
}

export async function getModelsForProvider(
  provider: string
): Promise<ModelConfig[]> {
  const models = await getAllModels()

  const providerModels = models
    .filter(
      (model) =>
        model.providerId === provider || model.baseProviderId === provider
    )
    .map((model) => ({
      ...model,
      accessible: true,
    }))

  return providerModels
}

// Function to get models based on user's available providers
export async function getModelsForUserProviders(
  providers: string[]
): Promise<ModelConfig[]> {
  const providerModels = await Promise.all(
    providers.map((provider) => getModelsForProvider(provider))
  )

  const flatProviderModels = providerModels.flat()

  return flatProviderModels
}

// Synchronous function to get model info for simple lookups
// This uses cached data if available, otherwise falls back to static models
export function getModelInfo(modelId: string): ModelConfig | undefined {
  // First check the cache if it exists
  if (dynamicModelsCache) {
    return dynamicModelsCache.find((model) => model.id === modelId)
  }

  // Fall back to static models for immediate lookup
  return STATIC_MODELS.find((model) => model.id === modelId)
}

// For backward compatibility - static models only
export const MODELS: ModelConfig[] = STATIC_MODELS

// Function to refresh the models cache
export function refreshModelsCache(): void {
  dynamicModelsCache = null
  lastFetchTime = 0
  refreshOpenRouterModelsCache()
}
