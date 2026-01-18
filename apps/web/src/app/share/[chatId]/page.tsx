import type { Json } from "@/app/types/database.types"
import { APP_DOMAIN } from "@/lib/config"
import { getDb, isD1Enabled, chats, messages } from "@/lib/db"
import { eq, asc } from "drizzle-orm"
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import Article from "./article"
import type { Attachment } from "@ai-sdk/ui-utils"

export const dynamic = "force-static"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ chatId: string }>
}): Promise<Metadata> {
  if (!isD1Enabled()) {
    return notFound()
  }

  const { chatId } = await params
  const db = getDb()

  const chat = await db
    .select({
      title: chats.title,
      createdAt: chats.createdAt,
    })
    .from(chats)
    .where(eq(chats.id, chatId))
    .get()

  const title = chat?.title || "Chat"
  const description = "A chat in Hive"

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `${APP_DOMAIN}/share/${chatId}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  }
}

export default async function ShareChat({
  params,
}: {
  params: Promise<{ chatId: string }>
}) {
  if (!isD1Enabled()) {
    return notFound()
  }

  const { chatId } = await params
  const db = getDb()

  const chatData = await db
    .select({
      id: chats.id,
      title: chats.title,
      createdAt: chats.createdAt,
    })
    .from(chats)
    .where(eq(chats.id, chatId))
    .get()

  if (!chatData) {
    redirect("/")
  }

  const messagesData = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(asc(messages.createdAt))
    .all()

  if (!messagesData) {
    redirect("/")
  }

  // Convert to snake_case format for backwards compatibility
  const formattedMessages = messagesData.map((m) => ({
    id: m.id,
    chat_id: m.chatId,
    user_id: m.userId,
    role: m.role,
    content: m.content,
    parts: m.parts as Json,
    experimental_attachments: (m.experimentalAttachments || []) as Attachment[],
    message_group_id: m.messageGroupId,
    model: m.model,
    created_at: m.createdAt,
  }))

  return (
    <Article
      messages={formattedMessages}
      date={chatData.createdAt || ""}
      title={chatData.title || ""}
      subtitle={"A conversation in Hive"}
    />
  )
}
