import type { ContentPart, Message } from "@/app/types/api.types"
import { getDb, messages } from "@/lib/db"

type DbClient = ReturnType<typeof getDb>

const DEFAULT_STEP = 0

export async function saveFinalAssistantMessage(
  db: DbClient,
  chatId: string,
  messageList: Message[],
  message_group_id?: string,
  model?: string
) {
  const parts: ContentPart[] = []
  const toolMap = new Map<string, ContentPart>()
  const textParts: string[] = []

  for (const msg of messageList) {
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "text") {
          textParts.push(part.text || "")
          parts.push(part)
        } else if (part.type === "tool-invocation" && part.toolInvocation) {
          const { toolCallId, state } = part.toolInvocation
          if (!toolCallId) continue

          const existing = toolMap.get(toolCallId)
          if (state === "result" || !existing) {
            toolMap.set(toolCallId, {
              ...part,
              toolInvocation: {
                ...part.toolInvocation,
                args: part.toolInvocation?.args || {},
              },
            })
          }
        } else if (part.type === "reasoning") {
          parts.push({
            type: "reasoning",
            reasoning: part.text || "",
            details: [
              {
                type: "text",
                text: part.text || "",
              },
            ],
          })
        } else if (part.type === "step-start") {
          parts.push(part)
        }
      }
    } else if (msg.role === "tool" && Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "tool-result") {
          const toolCallId = part.toolCallId || ""
          toolMap.set(toolCallId, {
            type: "tool-invocation",
            toolInvocation: {
              state: "result",
              step: DEFAULT_STEP,
              toolCallId,
              toolName: part.toolName || "",
              result: part.result,
            },
          })
        }
      }
    }
  }

  // Merge tool parts at the end
  parts.push(...toolMap.values())

  const finalPlainText = textParts.join("\n\n")

  try {
    await db
      .insert(messages)
      .values({
        chatId,
        role: "assistant",
        content: finalPlainText || "",
        parts: parts as unknown,
        messageGroupId: message_group_id || null,
        model: model || null,
        createdAt: new Date().toISOString(),
      })
      .run()

    console.log("Assistant message saved successfully (merged).")
  } catch (error) {
    console.error("Error saving final assistant message:", error)
    throw new Error(`Failed to save assistant message: ${error}`)
  }
}
