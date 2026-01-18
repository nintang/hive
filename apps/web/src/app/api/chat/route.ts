import { SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import { messages, connectedAccounts } from "@/lib/db"
import { getAllModels } from "@/lib/models"
import { getProviderForModel } from "@/lib/openproviders/provider-map"
import type { ProviderWithoutOllama } from "@/lib/user-keys"
import { Attachment, Message as MessageAISDK } from "@ai-sdk/ui-utils"
import { VercelProvider } from "@composio/vercel"
import { streamText, ToolSet } from "ai"
import { eq, and, inArray } from "drizzle-orm"
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
  selectedConnectionIds?: string[]
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
      selectedConnectionIds,
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

    // Get Composio tools for selected connections
    let composioTools: ToolSet = {}
    if (selectedConnectionIds?.length && isAuthenticated && db) {
      try {
        // Look up the user's connected accounts that match selected IDs
        const accounts = await db
          .select()
          .from(connectedAccounts)
          .where(
            and(
              eq(connectedAccounts.userId, userId),
              inArray(connectedAccounts.id, selectedConnectionIds),
              eq(connectedAccounts.status, "ACTIVE")
            )
          )
          .all()

        if (accounts.length > 0) {
          // Initialize Composio with VercelProvider - this makes tools.get return Vercel-compatible tools
          const { Composio } = await import("@composio/core")
          const composio = new Composio({
            apiKey: process.env.COMPOSIO_API_KEY,
            provider: new VercelProvider(),
          })

          // Get unique toolkit slugs from the accounts
          const toolkitSlugs = [...new Set(accounts.map((a) => a.toolkitSlug))]

          // Fetch tools from Composio for these toolkits (already in Vercel format)
          composioTools = await composio.tools.get(userId, {
            toolkits: toolkitSlugs,
          })
        }
      } catch (err) {
        console.error("Failed to load Composio tools:", err)
        // Continue without tools if there's an error
      }
    }

    // Filter out data messages and transform for API compatibility
    // AI SDK v6 UIMessage uses 'parts' array, but streamText expects 'content'
    const apiMessages = chatMessages
      .filter((m): m is MessageAISDK & { role: "system" | "user" | "assistant" } =>
        m.role !== "data"
      )
      .map((msg) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, parts, ...rest } = msg as MessageAISDK & { parts?: Array<{ type: string; text?: string }> }

        // If message has content, use it as-is
        if (rest.content) {
          return rest
        }

        // If message only has parts (UIMessage format), extract text content
        if (parts && Array.isArray(parts)) {
          const textContent = parts
            .filter((p): p is { type: "text"; text: string } => p.type === "text" && typeof p.text === "string")
            .map((p) => p.text)
            .join("")

          return {
            ...rest,
            content: textContent || "",
          }
        }

        return rest
      })

    /* eslint-disable @typescript-eslint/no-explicit-any */
    // Type casts are required for AI SDK v6 compatibility with model providers
    const result = streamText({
      model: modelConfig.apiSdk(apiKey, { enableSearch }) as any,
      system: effectiveSystemPrompt,
      messages: apiMessages as any,
      tools: composioTools,
      maxSteps: 10,
      onError: (err: unknown) => {
        console.error("Streaming error occurred:", err)
      },

      onFinish: async ({ response }: { response: any }) => {
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
    } as any)

    return (result as any).toUIMessageStreamResponse({
      onError: (error: unknown) => {
        console.error("Error forwarded to client:", error)
        return extractErrorMessage(error)
      },
    })
    /* eslint-enable @typescript-eslint/no-explicit-any */
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
