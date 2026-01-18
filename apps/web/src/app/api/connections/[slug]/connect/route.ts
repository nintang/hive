import { auth } from "@clerk/nextjs/server"
import {
  getComposioClient,
  getAuthConfigForToolkit,
  createNoAuthConnection,
} from "@/lib/composio/client"
import { getDb, connectedAccounts, isD1Enabled } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { slug: toolkitSlug } = await params
    const composio = getComposioClient()

    // Get or create a Composio-managed auth config for this toolkit
    const authConfigId = await getAuthConfigForToolkit(toolkitSlug)

    // If no auth config is needed (no-auth toolkit), save to database
    if (authConfigId === null) {
      const connection = await createNoAuthConnection(userId, toolkitSlug)

      // Save no-auth connection to database for persistence
      if (isD1Enabled()) {
        const db = getDb()
        const now = new Date().toISOString()

        // Check if connection already exists
        const existing = await db
          .select()
          .from(connectedAccounts)
          .where(
            and(
              eq(connectedAccounts.userId, userId),
              eq(connectedAccounts.toolkitSlug, toolkitSlug)
            )
          )
          .get()

        if (!existing) {
          await db.insert(connectedAccounts).values({
            id: connection.id,
            userId,
            toolkitSlug,
            toolkitName: toolkitSlug.charAt(0).toUpperCase() + toolkitSlug.slice(1),
            toolkitLogo: null,
            status: "ACTIVE",
            createdAt: now,
            updatedAt: now,
          })
        }
      }

      return NextResponse.json({
        connected: true,
        connectionId: connection.id,
        status: connection.status,
      })
    }

    // Generate callback URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const callbackUrl = `${appUrl}/api/connections/callback`

    // Initiate connection with Composio using the link method for OAuth
    // Allow multiple connected accounts so users can reconnect
    // Composio stores the connection - no need for local D1 storage
    const connectionRequest = await composio.connectedAccounts.initiate(
      userId,
      authConfigId,
      {
        callbackUrl,
        allowMultiple: true,
      }
    )

    return NextResponse.json({
      redirectUrl: connectionRequest.redirectUrl,
      requestId: connectionRequest.id,
    })
  } catch (error) {
    console.error("Error initiating connection:", error)
    return NextResponse.json(
      { error: "Failed to initiate connection" },
      { status: 500 }
    )
  }
}
