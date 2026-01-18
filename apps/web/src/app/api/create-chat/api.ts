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
  const db = await validateUserIdentity(userId, isAuthenticated)

  // If D1 is not configured, return a local-only chat object
  if (!db) {
    return {
      id: crypto.randomUUID(),
      user_id: userId,
      title: title || "New Chat",
      model,
      project_id: projectId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  await checkUsageByModel(db, userId, model, isAuthenticated)

  const chatId = crypto.randomUUID()
  const now = new Date().toISOString()

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

  // Fetch the created chat
  const data = await db.select().from(chats).where(eq(chats.id, chatId)).get()

  if (!data) {
    console.error("Error creating chat: failed to retrieve created chat")
    return null
  }

  // Return in snake_case format for backwards compatibility
  return {
    id: data.id,
    user_id: data.userId,
    title: data.title,
    model: data.model,
    project_id: data.projectId,
    created_at: data.createdAt,
    updated_at: data.updatedAt,
  }
}
