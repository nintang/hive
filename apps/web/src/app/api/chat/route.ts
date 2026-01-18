import { SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import { messages } from "@/lib/db"
import { getComposioClient } from "@/lib/composio/client"
import { getAllModels } from "@/lib/models"
import { getProviderForModel } from "@/lib/openproviders/provider-map"
import type { ProviderWithoutOllama } from "@/lib/user-keys"
import { Attachment, Message as MessageAISDK } from "@ai-sdk/ui-utils"
import { VercelProvider } from "@composio/vercel"
import { streamText, ToolSet, stepCountIs } from "ai"
import { eq } from "drizzle-orm"
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
  projectId?: string // For loading project-specific skills
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
      projectId,
    } = (await req.json()) as ChatRequest

    console.log("[Chat API] Request received:", {
      hasMessages: !!chatMessages?.length,
      chatId: rawChatId,
      userId,
      selectedConnectionIds,
      isAuthenticated,
    })

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

    // Capture the apiSdk function for use in callbacks where TypeScript can't narrow the type
    const modelApiSdk = modelConfig.apiSdk

    const effectiveSystemPrompt = systemPrompt || SYSTEM_PROMPT_DEFAULT

    let apiKey: string | undefined
    if (isAuthenticated && userId) {
      const { getEffectiveApiKey } = await import("@/lib/user-keys")
      const provider = getProviderForModel(model)
      apiKey =
        (await getEffectiveApiKey(userId, provider as ProviderWithoutOllama)) ||
        undefined
    }

    // Get Composio tools via Tool Router for selected connections
    // Tool Router provides unified search, plan, authenticate, and execute across all tools
    // Composio is the single source of truth for connections - no D1 lookup needed
    let composioTools: ToolSet = {}
    let activeToolkitSlugs: string[] = []
    if (selectedConnectionIds?.length && isAuthenticated) {
      try {
        // Query Composio directly for connected accounts (single source of truth)
        const composioClient = getComposioClient()

        console.log("[Composio] Checking connections for user:", userId)
        console.log("[Composio] Selected toolkit slugs from UI:", selectedConnectionIds)

        const accountsResult = await composioClient.connectedAccounts.list({
          userIds: [userId],
        })

        console.log("[Composio] All connected accounts for user:", accountsResult.items.map(a => ({
          id: a.id,
          toolkit: a.toolkit.slug,
          status: a.status,
        })))

        // Filter for active accounts that match the selected toolkits
        const activeAccounts = accountsResult.items.filter(
          (acc) => acc.status === "ACTIVE" && selectedConnectionIds.includes(acc.toolkit.slug)
        )

        console.log("[Composio] Active accounts matching selection:", activeAccounts.length)

        if (activeAccounts.length > 0) {
          // Initialize Composio with VercelProvider for AI SDK compatibility
          const { Composio } = await import("@composio/core")
          const composio = new Composio({
            apiKey: process.env.COMPOSIO_API_KEY,
            provider: new VercelProvider(),
          })

          activeToolkitSlugs = [...new Set(activeAccounts.map((a) => a.toolkit.slug))]

          console.log("[Composio] Creating Tool Router session for user:", userId)
          console.log("[Composio] Toolkit slugs:", activeToolkitSlugs)
          console.log("[Composio] Connected accounts:", activeAccounts.map(a => ({ id: a.id, toolkit: a.toolkit.slug, status: a.status })))

          // Create a Tool Router session for this user with ONLY the selected toolkits
          // Tool Router handles: search (finds right tools), context management (workbench for large results),
          // and authentication across all connected apps
          const session = await composio.create(userId, {
            toolkits: { enable: activeToolkitSlugs },
          })

          // Get native tools from the session (in Vercel AI SDK format)
          composioTools = await session.tools()

          console.log("[Composio] Tool Router tools loaded:", Object.keys(composioTools))
          const toolsWithExecute = Object.entries(composioTools).filter(([, tool]) => typeof (tool as { execute?: unknown }).execute === 'function')
          console.log("[Composio] Tools with execute function:", toolsWithExecute.length, "of", Object.keys(composioTools).length)
        }
      } catch (err) {
        console.error("Failed to load Composio Tool Router:", err)
        // Continue without tools if there's an error
      }
    }

    // Load E2B skills tools if project has skills enabled
    let skillsTools: ToolSet = {}
    let enabledSkillIds: string[] = []
    if (projectId && isAuthenticated && db) {
      try {
        const { projectSkills } = await import("@/lib/db")
        const { and, eq } = await import("drizzle-orm")
        const { buildSkillsTools } = await import("@/lib/skills")

        // Get enabled skills for this project
        const projectSkillsData = await db
          .select()
          .from(projectSkills)
          .where(and(eq(projectSkills.projectId, projectId), eq(projectSkills.enabled, true)))
          .all()

        enabledSkillIds = projectSkillsData.map((ps) => ps.skillId)

        if (enabledSkillIds.length > 0) {
          console.log("[Skills] Loading skills for project:", projectId)
          console.log("[Skills] Enabled skill IDs:", enabledSkillIds)

          // Build execute_code tool with the enabled skills
          skillsTools = buildSkillsTools({
            skillIds: enabledSkillIds,
            userId,
            chatId,
          })

          console.log("[Skills] Tools loaded:", Object.keys(skillsTools))
        }
      } catch (err) {
        console.error("Failed to load skills tools:", err)
        // Continue without skills tools if there's an error
      }
    }

    // Merge Composio tools and Skills tools
    const allTools: ToolSet = { ...composioTools, ...skillsTools }

    // Build system prompt with toolkit and skills context
    let systemPromptWithContext = effectiveSystemPrompt

    // Add Composio toolkit context
    if (activeToolkitSlugs.length > 0) {
      const toolkitContext = `\n\n## Connected Tools\nYou have access to the following connected services: ${activeToolkitSlugs.join(", ")}.\nWhen searching for tools or performing actions, focus ONLY on these connected services. Do not suggest or search for tools from other services.`
      systemPromptWithContext += toolkitContext
    }

    // Add E2B skills context
    if (enabledSkillIds.length > 0) {
      const { getSkill } = await import("@/lib/skills")
      const skillNames = enabledSkillIds
        .map((id) => getSkill(id)?.name)
        .filter(Boolean)
        .join(", ")

      const skillsContext = `\n\n## Code Execution Skills\nYou have access to the execute_code tool which can run Python code in a secure sandbox. The following skills are enabled: ${skillNames}.\n\nWhen creating documents (Excel, PowerPoint, PDF, Word), charts, or running data analysis:\n1. Use the execute_code tool to run Python code\n2. Save output files to the current directory\n3. The files will be automatically uploaded and made available for download\n4. Always print helpful output so the user knows what happened`
      systemPromptWithContext += skillsContext
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
    const hasTools = Object.keys(allTools).length > 0

    // Let AI SDK handle telemetry via experimental_telemetry
    // OpenInference will automatically capture spans and group them by session
    const result = streamText({
      model: modelApiSdk(apiKey, { enableSearch }) as any,
      system: systemPromptWithContext,
      messages: apiMessages as any,
      tools: allTools,
      // AI SDK v6: Use stopWhen instead of maxSteps for multi-step tool execution
      // Only enable multi-step when tools are available
      stopWhen: hasTools ? stepCountIs(10) : stepCountIs(1),
      experimental_telemetry: {
        isEnabled: true,
        functionId: "chat-agent",
        metadata: {
          // Session & user context
          sessionId: chatId,
          userId,
          model,
          // Tool configuration
          hasTools: String(hasTools),
          toolCount: String(Object.keys(allTools).length),
          toolNames: Object.keys(allTools).join(","),
          // Skills configuration
          hasSkills: String(enabledSkillIds.length > 0),
          skillIds: enabledSkillIds.join(","),
          // Composio integrations
          hasComposio: String(activeToolkitSlugs.length > 0),
          composioToolkits: activeToolkitSlugs.join(","),
          // Agent graph metadata for Arize visualization
          "graph.node.id": "chat-agent",
          "graph.node.parent_id": projectId || "root",
          // Additional context
          projectId: projectId || "",
        },
      },
      onError: (err: unknown) => {
        console.error("Streaming error occurred:", err)
      },
      // Called after each step completes (useful for debugging tool execution)
      onStepFinish: async ({ stepType, toolCalls, toolResults }: { stepType: string; toolCalls: Array<{ toolName: string; args: unknown }>; toolResults: Array<{ toolName: string; result: unknown }> }) => {
        console.log(`[Step ${stepType}] Tool calls:`, toolCalls?.map((c) => ({
          toolName: c.toolName,
          args: c.args,
        })))
        console.log(`[Step ${stepType}] Tool results:`, toolResults?.map((r) => ({
          toolName: r.toolName,
          hasResult: !!r.result,
          resultType: typeof r.result,
          resultPreview: r.result ? JSON.stringify(r.result).slice(0, 200) : null,
        })))
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
