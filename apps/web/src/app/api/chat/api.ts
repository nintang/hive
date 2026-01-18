import { saveFinalAssistantMessage } from "@/app/api/chat/db"
import type {
  ChatApiParams,
  Message,
} from "@/app/types/api.types"
import { FREE_MODELS_IDS, NON_AUTH_ALLOWED_MODELS } from "@/lib/config"
import { getDb, messages } from "@/lib/db"
import { getProviderForModel } from "@/lib/openproviders/provider-map"
import { sanitizeUserInput } from "@/lib/sanitize"
import { validateUserIdentity } from "@/lib/server/api"
import { checkUsageByModel, incrementUsage } from "@/lib/usage"
import { getUserKey, type ProviderWithoutOllama } from "@/lib/user-keys"
import { Attachment } from "@ai-sdk/ui-utils"

type DbClient = ReturnType<typeof getDb>

export async function validateAndTrackUsage({
  userId,
  model,
  isAuthenticated,
}: ChatApiParams): Promise<DbClient | null> {
  const db = await validateUserIdentity(userId, isAuthenticated)
  if (!db) return null

  // Check if user is authenticated
  if (!isAuthenticated) {
    // For unauthenticated users, only allow specific models
    if (!NON_AUTH_ALLOWED_MODELS.includes(model)) {
      throw new Error(
        "This model requires authentication. Please sign in to access more models."
      )
    }
  } else {
    // For authenticated users, check API key requirements
    const provider = getProviderForModel(model)

    if (provider !== "ollama") {
      const userApiKey = await getUserKey(
        userId,
        provider as ProviderWithoutOllama
      )

      // If no API key and model is not in free list, deny access
      if (!userApiKey && !FREE_MODELS_IDS.includes(model)) {
        throw new Error(
          `This model requires an API key for ${provider}. Please add your API key in settings or use a free model.`
        )
      }
    }
  }

  // Check usage limits for the model
  await checkUsageByModel(db, userId, model, isAuthenticated)

  return db
}

export async function incrementMessageCount({
  db,
  userId,
}: {
  db: DbClient
  userId: string
}): Promise<void> {
  if (!db) return

  try {
    await incrementUsage(db, userId)
  } catch (err) {
    console.error("Failed to increment message count:", err)
    // Don't throw error as this shouldn't block the chat
  }
}

export async function logUserMessage({
  db,
  userId,
  chatId,
  content,
  attachments,
  message_group_id,
}: {
  db: DbClient
  userId: string
  chatId: string
  content: string
  attachments?: Attachment[]
  message_group_id?: string
}): Promise<void> {
  if (!db) return

  try {
    await db
      .insert(messages)
      .values({
        chatId,
        role: "user",
        content: sanitizeUserInput(content),
        experimentalAttachments: attachments as unknown,
        userId,
        messageGroupId: message_group_id || null,
        createdAt: new Date().toISOString(),
      })
      .run()
  } catch (error) {
    console.error("Error saving user message:", error)
  }
}

export async function storeAssistantMessage({
  db,
  chatId,
  messages: msgList,
  message_group_id,
  model,
}: {
  db: DbClient
  chatId: string
  messages: Message[]
  message_group_id?: string
  model?: string
}): Promise<void> {
  if (!db) return
  try {
    await saveFinalAssistantMessage(
      db,
      chatId,
      msgList,
      message_group_id,
      model
    )
  } catch (err) {
    console.error("Failed to save assistant messages:", err)
  }
}
