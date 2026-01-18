import { getDb, isD1Enabled, chats } from "@/lib/db"
import { eq } from "drizzle-orm"

export async function POST(request: Request) {
  try {
    const { chatId, model } = await request.json()

    if (!chatId || !model) {
      return new Response(
        JSON.stringify({ error: "Missing chatId or model" }),
        { status: 400 }
      )
    }

    // If D1 is not available, we still return success
    if (!isD1Enabled()) {
      console.log("D1 not enabled, skipping DB update")
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }

    const db = getDb()
    await db.update(chats).set({ model }).where(eq(chats.id, chatId)).run()

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
    })
  } catch (err: unknown) {
    console.error("Error in update-chat-model endpoint:", err)
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal server error" }),
      { status: 500 }
    )
  }
}
