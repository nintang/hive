import { getDb, isD1Enabled, chats } from "@/lib/db"
import { auth } from "@clerk/nextjs/server"
import { eq, and } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  if (!isD1Enabled()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 })
  }

  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { chatId, public: isPublic } = await request.json()

    if (!chatId || typeof isPublic !== "boolean") {
      return NextResponse.json(
        { error: "chatId and public are required" },
        { status: 400 }
      )
    }

    const db = getDb()

    // Verify the chat belongs to the user
    const chat = await db
      .select({ id: chats.id })
      .from(chats)
      .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
      .get()

    if (!chat) {
      return NextResponse.json(
        { error: "Chat not found or unauthorized" },
        { status: 404 }
      )
    }

    // Update the public status
    await db
      .update(chats)
      .set({ public: isPublic, updatedAt: new Date().toISOString() })
      .where(eq(chats.id, chatId))
      .run()

    return NextResponse.json({ success: true, public: isPublic })
  } catch (error) {
    console.error("Error toggling chat public status:", error)
    return NextResponse.json(
      { error: "Failed to update chat" },
      { status: 500 }
    )
  }
}
