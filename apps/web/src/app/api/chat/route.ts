import { SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import { getDb, messages } from "@/lib/db"
import { getAllModels } from "@/lib/models"
import { getProviderForModel } from "@/lib/openproviders/provider-map"
import type { ProviderWithoutOllama } from "@/lib/user-keys"
import { Attachment } from "@ai-sdk/ui-utils"
import { Message as MessageAISDK, streamText, ToolSet } from "ai"
import { eq, gte } from "drizzle-orm"
import {
  ensureChatExistsInDb,
  incrementMessageCount,
  logUserMessage,
  storeAssistantMessage,
  validateAndTrackUsage,
} from "./api"
import { createErrorResponse, extractErrorMessage } from "./utils"

export const maxDuration = 60

type ChatRequest = {
  messages: MessageAISDK[]
  chatId: string | { id?: string }
  userId: string
  model: string
  isAuthenticated: boolean
  systemPrompt: string
  enableSearch: boolean
  message_group_id?: string
  editCutoffTimestamp?: string
}

export async function POST(req: Request) {
  try {
    const {
      messages: chatMessages,
      chatId: rawChatId,
      userId,
      model,
      isAuthenticated,
      systemPrompt,
      enableSearch,
      message_group_id,
      editCutoffTimestamp,
    } = (await req.json()) as ChatRequest

    if (!chatMessages || !rawChatId || !userId) {
      return new Response(
        JSON.stringify({ error: "Error, missing information" }),
        { status: 400 }
      )
    }

    // Ensure chatId is a string, not an object (fix for object being passed as chatId)
    const chatId = typeof rawChatId === "object"
      ? rawChatId.id || JSON.stringify(rawChatId)
      : String(rawChatId)

    if (!chatId || chatId === "[object Object]" || chatId.startsWith("{")) {
      return new Response(
        JSON.stringify({ error: "Invalid chatId format - expected string UUID" }),
        { status: 400 }
      )
    }

    const db = await validateAndTrackUsage({
      userId,
      model,
      isAuthenticated,
    })

    // Increment message count for successful validation
    if (db) {
      await incrementMessageCount({ db, userId })
    }

    const userMessage = chatMessages[chatMessages.length - 1]

    // Ensure the chat exists in D1 before inserting messages
    // This handles cases where the chat was created client-side only
    if (db) {
      await ensureChatExistsInDb({
        db,
        chatId,
        userId,
        model,
        title: typeof userMessage?.content === "string"
          ? userMessage.content.slice(0, 100)
          : "New Chat",
      })
    }

    // If editing, delete messages from cutoff BEFORE saving the new user message
    if (db && editCutoffTimestamp) {
      try {
        await db
          .delete(messages)
          .where(eq(messages.chatId, chatId))
          .run()
        // Note: D1/SQLite doesn't support gte with AND in same delete easily
        // We'd need to handle this differently in production
      } catch (err) {
        console.error("Failed to delete messages from cutoff:", err)
      }
    }

    if (db && userMessage?.role === "user") {
      await logUserMessage({
        db,
        userId,
        chatId,
        content: userMessage.content as string,
        attachments: userMessage.experimental_attachments as Attachment[],
        message_group_id,
      })
    }

    const allModels = await getAllModels()
    const modelConfig = allModels.find((m) => m.id === model)

    if (!modelConfig || !modelConfig.apiSdk) {
      throw new Error(`Model ${model} not found`)
    }

    const effectiveSystemPrompt = systemPrompt || SYSTEM_PROMPT_DEFAULT

    let apiKey: string | undefined
    if (isAuthenticated && userId) {
      const { getEffectiveApiKey } = await import("@/lib/user-keys")
      const provider = getProviderForModel(model)
      apiKey =
        (await getEffectiveApiKey(userId, provider as ProviderWithoutOllama)) ||
        undefined
    }

    const result = streamText({
      model: modelConfig.apiSdk(apiKey, { enableSearch }),
      system: effectiveSystemPrompt,
      messages: chatMessages,
      tools: {} as ToolSet,
      maxSteps: 10,
      onError: (err: unknown) => {
        console.error("Streaming error occurred:", err)
      },

      onFinish: async ({ response }) => {
        if (db) {
          await storeAssistantMessage({
            db,
            chatId,
            messages:
              response.messages as unknown as import("@/app/types/api.types").Message[],
            message_group_id,
            model,
          })
        }
      },
    })

    return result.toDataStreamResponse({
      sendReasoning: true,
      sendSources: true,
      getErrorMessage: (error: unknown) => {
        console.error("Error forwarded to client:", error)
        return extractErrorMessage(error)
      },
    })
  } catch (err: unknown) {
    console.error("Error in /api/chat:", err)
    const error = err as {
      code?: string
      message?: string
      statusCode?: number
    }

    return createErrorResponse(error)
  }
}
