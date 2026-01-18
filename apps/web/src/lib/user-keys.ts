import { decryptKey } from "./encryption"
import { getDb, isD1Enabled, userKeys } from "./db"
import { eq, and } from "drizzle-orm"
import { env } from "./openproviders/env"
import { Provider } from "./openproviders/types"

export type { Provider } from "./openproviders/types"
export type ProviderWithoutOllama = Exclude<Provider, "ollama">

export async function getUserKey(
  userId: string,
  provider: Provider
): Promise<string | null> {
  try {
    if (!isD1Enabled()) return null

    const db = getDb()
    const data = await db
      .select({
        encryptedKey: userKeys.encryptedKey,
        iv: userKeys.iv,
      })
      .from(userKeys)
      .where(and(eq(userKeys.userId, userId), eq(userKeys.provider, provider)))
      .get()

    if (!data) return null

    return decryptKey(data.encryptedKey, data.iv)
  } catch (error) {
    console.error("Error retrieving user key:", error)
    return null
  }
}

export async function getEffectiveApiKey(
  userId: string | null,
  provider: ProviderWithoutOllama
): Promise<string | null> {
  if (userId) {
    const userKey = await getUserKey(userId, provider)
    if (userKey) return userKey
  }

  const envKeyMap: Record<ProviderWithoutOllama, string | undefined> = {
    openai: env.OPENAI_API_KEY,
    mistral: env.MISTRAL_API_KEY,
    perplexity: env.PERPLEXITY_API_KEY,
    google: env.GOOGLE_GENERATIVE_AI_API_KEY,
    anthropic: env.ANTHROPIC_API_KEY,
    xai: env.XAI_API_KEY,
    openrouter: env.OPENROUTER_API_KEY,
  }

  return envKeyMap[provider] || null
}
