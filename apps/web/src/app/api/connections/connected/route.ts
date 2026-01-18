import { auth } from "@clerk/nextjs/server"
import { getComposioClient } from "@/lib/composio/client"
import { getDb, connectedAccounts, isD1Enabled } from "@/lib/db"
import { eq } from "drizzle-orm"
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
    const composioAccounts = result.items.map((acc) => {
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

    // Also fetch no-auth connections from the database
    let noAuthAccounts: typeof composioAccounts = []
    if (isD1Enabled()) {
      const db = getDb()
      const dbConnections = await db
        .select()
        .from(connectedAccounts)
        .where(eq(connectedAccounts.userId, userId))
        .all()

      // Filter to only include no-auth connections (those with id starting with "no-auth-")
      // and that aren't already in the Composio list
      const composioSlugs = new Set(composioAccounts.map((a) => a.toolkitSlug))
      noAuthAccounts = dbConnections
        .filter((conn) => conn.id.startsWith("no-auth-") && !composioSlugs.has(conn.toolkitSlug))
        .map((conn) => ({
          id: conn.id,
          toolkitSlug: conn.toolkitSlug,
          toolkitName: conn.toolkitName,
          toolkitLogo: conn.toolkitLogo,
          status: conn.status as "ACTIVE" | "FAILED" | "INITIALIZING" | "INITIATED" | "EXPIRED" | "INACTIVE",
          createdAt: conn.createdAt,
        }))
    }

    const accounts = [...composioAccounts, ...noAuthAccounts]
    return NextResponse.json({ accounts })
  } catch (error) {
    console.error("Error fetching connected accounts:", error)
    return NextResponse.json(
      { error: "Failed to fetch connected accounts" },
      { status: 500 }
    )
  }
}
