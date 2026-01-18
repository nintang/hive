import { getDb, isD1Enabled, feedback } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  if (!isD1Enabled()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 })
  }

  try {
    const { message, userId } = await request.json()

    if (!message || !userId) {
      return NextResponse.json(
        { error: "Message and userId are required" },
        { status: 400 }
      )
    }

    const db = getDb()
    const id = crypto.randomUUID()
    const createdAt = new Date().toISOString()

    await db
      .insert(feedback)
      .values({
        id,
        userId,
        message,
        createdAt,
      })
      .run()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error submitting feedback:", error)
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    )
  }
}
