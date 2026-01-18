import { getDb, isD1Enabled, chats } from "@/lib/db"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { chatId, pinned } = await request.json()

    if (!chatId || typeof pinned !== "boolean") {
      return NextResponse.json(
        { error: "Missing chatId or pinned" },
        { status: 400 }
      )
    }

    if (!isD1Enabled()) {
      return NextResponse.json({ success: true }, { status: 200 })
    }

    const db = getDb()
    const toggle = pinned
      ? { pinned: true, pinnedAt: new Date().toISOString() }
      : { pinned: false, pinnedAt: null }

    await db.update(chats).set(toggle).where(eq(chats.id, chatId)).run()

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("toggle-chat-pin unhandled error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
