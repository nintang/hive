/* eslint-disable @typescript-eslint/no-explicit-any */
import { anthropic, createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI, google } from "@ai-sdk/google"
import { createMistral, mistral } from "@ai-sdk/mistral"
import { createOpenAI, openai } from "@ai-sdk/openai"
import { createPerplexity, perplexity } from "@ai-sdk/perplexity"
import { createXai, xai } from "@ai-sdk/xai"
import { getProviderForModel } from "./provider-map"
import type {
  AnthropicModel,
  GeminiModel,
  MistralModel,
  OllamaModel,
  OpenAIModel,
  PerplexityModel,
  SupportedModel,
  XaiModel,
} from "./types"

// Provider settings types - extracted from create* factory functions
type OpenAIChatSettings = Parameters<typeof createOpenAI>[0]
type MistralProviderSettings = Parameters<typeof createMistral>[0]
type GoogleGenerativeAIProviderSettings = Parameters<typeof createGoogleGenerativeAI>[0]
type PerplexityProviderSettings = Parameters<typeof createPerplexity>[0]
type AnthropicProviderSettings = Parameters<typeof createAnthropic>[0]
type XaiProviderSettings = Parameters<typeof createXai>[0]
type OllamaProviderSettings = OpenAIChatSettings // Ollama uses OpenAI-compatible API

type ModelSettings<T extends SupportedModel> = T extends OpenAIModel
  ? OpenAIChatSettings
  : T extends MistralModel
    ? MistralProviderSettings
    : T extends PerplexityModel
      ? PerplexityProviderSettings
      : T extends GeminiModel
        ? GoogleGenerativeAIProviderSettings
        : T extends AnthropicModel
          ? AnthropicProviderSettings
          : T extends XaiModel
            ? XaiProviderSettings
            : T extends OllamaModel
              ? OllamaProviderSettings
              : never

export type OpenProvidersOptions<T extends SupportedModel> = ModelSettings<T>

// Get Ollama base URL from environment or use default
const getOllamaBaseURL = () => {
  if (typeof window !== "undefined") {
    // Client-side: use localhost
    return "http://localhost:11434/v1"
  }

  // Server-side: check environment variables
  return (
    process.env.OLLAMA_BASE_URL?.replace(/\/+$/, "") + "/v1" ||
    "http://localhost:11434/v1"
  )
}

// Create Ollama provider instance with configurable baseURL
const createOllamaProvider = () => {
  return createOpenAI({
    baseURL: getOllamaBaseURL(),
    apiKey: "ollama", // Ollama doesn't require a real API key
    name: "ollama",
  })
}

export function openproviders<T extends SupportedModel>(
  modelId: T,
  _settings?: OpenProvidersOptions<T>,
  apiKey?: string
): any {
  const provider = getProviderForModel(modelId)

  if (provider === "openai") {
    if (apiKey) {
      const openaiProvider = createOpenAI({ apiKey })
      return openaiProvider(modelId as OpenAIModel)
    }
    return openai(modelId as OpenAIModel)
  }

  if (provider === "mistral") {
    if (apiKey) {
      const mistralProvider = createMistral({ apiKey })
      return mistralProvider(modelId as MistralModel)
    }
    return mistral(modelId as MistralModel)
  }

  if (provider === "google") {
    if (apiKey) {
      const googleProvider = createGoogleGenerativeAI({ apiKey })
      return googleProvider(modelId as GeminiModel)
    }
    return google(modelId as GeminiModel)
  }

  if (provider === "perplexity") {
    if (apiKey) {
      const perplexityProvider = createPerplexity({ apiKey })
      return perplexityProvider(modelId as PerplexityModel)
    }
    return perplexity(modelId as PerplexityModel)
  }

  if (provider === "anthropic") {
    if (apiKey) {
      const anthropicProvider = createAnthropic({ apiKey })
      return anthropicProvider(modelId as AnthropicModel)
    }
    return anthropic(modelId as AnthropicModel)
  }

  if (provider === "xai") {
    if (apiKey) {
      const xaiProvider = createXai({ apiKey })
      return xaiProvider(modelId as XaiModel)
    }
    return xai(modelId as XaiModel)
  }

  if (provider === "ollama") {
    const ollamaProvider = createOllamaProvider()
    return ollamaProvider(modelId as OllamaModel)
  }

  throw new Error(`Unsupported model: ${modelId}`)
}
