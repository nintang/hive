import { getDb, messages, isD1Enabled } from "@/lib/db"
import { eq, asc, desc } from "drizzle-orm"
import type { Message as MessageAISDK } from "ai"
import { readFromIndexedDB, writeToIndexedDB } from "../persist"

export interface ExtendedMessageAISDK extends MessageAISDK {
  message_group_id?: string
  model?: string
}

export async function getMessagesFromDb(
  chatId: string
): Promise<MessageAISDK[]> {
  // fallback to local cache only
  if (!isD1Enabled()) {
    const cached = await getCachedMessages(chatId)
    return cached
  }

  const db = getDb()
  const data = await db
    .select({
      id: messages.id,
      content: messages.content,
      role: messages.role,
      experimentalAttachments: messages.experimentalAttachments,
      createdAt: messages.createdAt,
      parts: messages.parts,
      messageGroupId: messages.messageGroupId,
      model: messages.model,
    })
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(asc(messages.createdAt))
    .all()

  return data.map((message) => ({
    id: String(message.id),
    content: message.content ?? "",
    role: message.role as MessageAISDK["role"],
    experimental_attachments: message.experimentalAttachments as MessageAISDK["experimental_attachments"],
    createdAt: new Date(message.createdAt || ""),
    parts: message.parts as MessageAISDK["parts"],
    message_group_id: message.messageGroupId ?? undefined,
    model: message.model ?? undefined,
  }))
}

export async function getLastMessagesFromDb(
  chatId: string,
  limit: number = 2
): Promise<MessageAISDK[]> {
  if (!isD1Enabled()) {
    const cached = await getCachedMessages(chatId)
    return cached.slice(-limit)
  }

  const db = getDb()
  const data = await db
    .select({
      id: messages.id,
      content: messages.content,
      role: messages.role,
      experimentalAttachments: messages.experimentalAttachments,
      createdAt: messages.createdAt,
      parts: messages.parts,
      messageGroupId: messages.messageGroupId,
      model: messages.model,
    })
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(desc(messages.createdAt))
    .limit(limit)
    .all()

  const ascendingData = [...data].reverse()
  return ascendingData.map((message) => ({
    id: String(message.id),
    content: message.content ?? "",
    role: message.role as MessageAISDK["role"],
    experimental_attachments: message.experimentalAttachments as MessageAISDK["experimental_attachments"],
    createdAt: new Date(message.createdAt || ""),
    parts: message.parts as MessageAISDK["parts"],
    message_group_id: message.messageGroupId ?? undefined,
    model: message.model ?? undefined,
  }))
}

async function insertMessageToDb(
  chatId: string,
  message: ExtendedMessageAISDK
) {
  if (!isD1Enabled()) return

  const db = getDb()
  await db
    .insert(messages)
    .values({
      chatId,
      role: message.role,
      content: message.content,
      experimentalAttachments: message.experimental_attachments as unknown,
      createdAt: message.createdAt?.toISOString() || new Date().toISOString(),
      messageGroupId: message.message_group_id || null,
      model: message.model || null,
    })
    .run()
}

async function insertMessagesToDb(
  chatId: string,
  messagesToInsert: ExtendedMessageAISDK[]
) {
  if (!isD1Enabled()) return

  const db = getDb()
  const payload = messagesToInsert.map((message) => ({
    chatId,
    role: message.role,
    content: message.content,
    experimentalAttachments: message.experimental_attachments as unknown,
    createdAt: message.createdAt?.toISOString() || new Date().toISOString(),
    messageGroupId: message.message_group_id || null,
    model: message.model || null,
  }))

  for (const msg of payload) {
    await db.insert(messages).values(msg).run()
  }
}

async function deleteMessagesFromDb(chatId: string) {
  if (!isD1Enabled()) return

  const db = getDb()
  await db.delete(messages).where(eq(messages.chatId, chatId)).run()
}

type ChatMessageEntry = {
  id: string
  messages: MessageAISDK[]
}

export async function getCachedMessages(
  chatId: string
): Promise<MessageAISDK[]> {
  const entry = await readFromIndexedDB<ChatMessageEntry>("messages", chatId)

  if (!entry || Array.isArray(entry)) return []

  return (entry.messages || []).sort(
    (a, b) => +new Date(a.createdAt || 0) - +new Date(b.createdAt || 0)
  )
}

export async function cacheMessages(
  chatId: string,
  messagesToCache: MessageAISDK[]
): Promise<void> {
  await writeToIndexedDB("messages", { id: chatId, messages: messagesToCache })
}

export async function addMessage(
  chatId: string,
  message: MessageAISDK
): Promise<void> {
  await insertMessageToDb(chatId, message)
  const current = await getCachedMessages(chatId)
  const updated = [...current, message]

  await writeToIndexedDB("messages", { id: chatId, messages: updated })
}

export async function setMessages(
  chatId: string,
  messagesToSet: MessageAISDK[]
): Promise<void> {
  await insertMessagesToDb(chatId, messagesToSet)
  await writeToIndexedDB("messages", { id: chatId, messages: messagesToSet })
}

export async function clearMessagesCache(chatId: string): Promise<void> {
  await writeToIndexedDB("messages", { id: chatId, messages: [] })
}

export async function clearMessagesForChat(chatId: string): Promise<void> {
  await deleteMessagesFromDb(chatId)
  await clearMessagesCache(chatId)
}
