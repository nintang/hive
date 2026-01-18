import { auth } from "@clerk/nextjs/server"
import { getComposioClient } from "@/lib/composio/client"
import { NextResponse } from "next/server"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { slug } = await params
    const composio = getComposioClient()

    // Find the connected account for this toolkit from Composio
    const accounts = await composio.connectedAccounts.list({
      userIds: [userId],
      toolkitSlugs: [slug],
    })

    const account = accounts.items.find(
      (acc) => acc.toolkit.slug === slug && acc.status === "ACTIVE"
    )

    if (!account) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 }
      )
    }

    // Delete from Composio (single source of truth)
    await composio.connectedAccounts.delete(account.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error disconnecting account:", error)
    return NextResponse.json(
      { error: "Failed to disconnect account" },
      { status: 500 }
    )
  }
}
