import type { ContentPart, Json, Message } from "@/app/types/api.types"
import { getDb, messages } from "@/lib/db"

type DbClient = ReturnType<typeof getDb>

const DEFAULT_STEP = 0

// Helper to check if a part is an AI SDK v6 typed tool part (type: "tool-{toolName}")
function isV6ToolPart(part: { type: string }): boolean {
  return part.type.startsWith("tool-") &&
         part.type !== "tool-result" &&
         part.type !== "tool-invocation"
}

// Helper to check if state indicates completion
function isCompletedState(state: string): boolean {
  return state === "output-available" || state === "result"
}

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
          // Legacy format: { type: "tool-invocation", toolInvocation: { ... } }
          const { toolCallId, state } = part.toolInvocation
          if (!toolCallId) continue

          const existing = toolMap.get(toolCallId)
          if (isCompletedState(state) || !existing) {
            toolMap.set(toolCallId, {
              ...part,
              toolInvocation: {
                ...part.toolInvocation,
                args: part.toolInvocation?.args || {},
              },
            })
          }
        } else if (isV6ToolPart(part)) {
          // AI SDK v6 format: { type: "tool-{toolName}", toolCallId, state, input, output }
          const v6Part = part as {
            type: string
            toolCallId?: string
            state?: string
            input?: Record<string, unknown>
            output?: unknown
            error?: string
          }
          const toolCallId = v6Part.toolCallId || ""
          const state = v6Part.state || "input-available"
          const toolName = part.type.replace(/^tool-/, "")

          if (!toolCallId) continue

          const existing = toolMap.get(toolCallId)
          if (isCompletedState(state) || !existing) {
            // Store in legacy format for backwards compatibility with UI
            toolMap.set(toolCallId, {
              type: "tool-invocation",
              toolInvocation: {
                state: state,
                step: DEFAULT_STEP,
                toolCallId,
                toolName,
                args: (v6Part.input || {}) as Json,
                result: v6Part.output as Json,
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
              state: "output-available", // Use modern state for consistency
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
