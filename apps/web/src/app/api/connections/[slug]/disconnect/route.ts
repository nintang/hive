import { auth } from "@clerk/nextjs/server"
import { getDb } from "@/lib/db"
import { connectedAccounts } from "@/lib/db/schema"
import { getComposioClient } from "@/lib/composio/client"
import { NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { slug } = await params
    const db = getDb()
    const composio = getComposioClient()

    // Find the connected account for this toolkit
    const account = await db
      .select()
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.toolkitSlug, slug),
          eq(connectedAccounts.userId, userId)
        )
      )
      .get()

    if (!account) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 }
      )
    }

    // Delete from Composio
    try {
      await composio.connectedAccounts.delete(account.id)
    } catch (e) {
      console.warn("Failed to delete from Composio (may already be deleted):", e)
    }

    // Delete from our database
    await db
      .delete(connectedAccounts)
      .where(eq(connectedAccounts.id, account.id))
      .run()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error disconnecting account:", error)
    return NextResponse.json(
      { error: "Failed to disconnect account" },
      { status: 500 }
    )
  }
}
