import { chats } from "@/lib/db"
import { validateUserIdentity } from "@/lib/server/api"
import { checkUsageByModel } from "@/lib/usage"
import { eq } from "drizzle-orm"

type CreateChatInput = {
  userId: string
  title?: string
  model: string
  isAuthenticated: boolean
  projectId?: string
}

export async function createChatInDb({
  userId,
  title,
  model,
  isAuthenticated,
  projectId,
}: CreateChatInput) {
  console.log("[createChatInDb] Starting with:", { userId, title, model, isAuthenticated, projectId })

  const db = await validateUserIdentity(userId, isAuthenticated)
  console.log("[createChatInDb] validateUserIdentity result:", db ? "db obtained" : "null (D1 not configured)")

  // If D1 is not configured, return a local-only chat object
  if (!db) {
    const localChat = {
      id: crypto.randomUUID(),
      user_id: userId,
      title: title || "New Chat",
      model,
      project_id: projectId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    console.log("[createChatInDb] Returning local-only chat:", localChat)
    return localChat
  }

  console.log("[createChatInDb] Checking usage by model...")
  await checkUsageByModel(db, userId, model, isAuthenticated)

  const chatId = crypto.randomUUID()
  const now = new Date().toISOString()
  console.log("[createChatInDb] Inserting chat with id:", chatId)

  await db
    .insert(chats)
    .values({
      id: chatId,
      userId,
      title: title || "New Chat",
      model,
      projectId: projectId || null,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  console.log("[createChatInDb] Insert complete, fetching created chat...")

  // Fetch the created chat
  const data = await db.select().from(chats).where(eq(chats.id, chatId)).get()
  console.log("[createChatInDb] Fetched data:", data)

  if (!data) {
    console.error("[createChatInDb] Error: failed to retrieve created chat")
    return null
  }

  // Return in snake_case format for backwards compatibility
  const result = {
    id: data.id,
    user_id: data.userId,
    title: data.title,
    model: data.model,
    project_id: data.projectId,
    created_at: data.createdAt,
    updated_at: data.updatedAt,
  }
  console.log("[createChatInDb] Returning result:", result)
  return result
}
