import { auth } from "@clerk/nextjs/server"
import { getComposioClient } from "@/lib/composio/client"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const composio = getComposioClient()

    // Fetch connected accounts directly from Composio (single source of truth)
    const result = await composio.connectedAccounts.list({
      userIds: [userId],
    })

    // Map Composio response to our expected format
    // The Composio SDK types are incomplete - toolkit has more properties at runtime
    const accounts = result.items.map((acc) => {
      const toolkit = acc.toolkit as { slug: string; name?: string; meta?: { logo?: string } }
      return {
        id: acc.id,
        toolkitSlug: toolkit.slug,
        toolkitName: toolkit.name || toolkit.slug,
        toolkitLogo: toolkit.meta?.logo || null,
        status: acc.status,
        createdAt: acc.createdAt,
      }
    })

    return NextResponse.json({ accounts })
  } catch (error) {
    console.error("Error fetching connected accounts:", error)
    return NextResponse.json(
      { error: "Failed to fetch connected accounts" },
      { status: 500 }
    )
  }
}
