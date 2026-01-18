import { auth } from "@clerk/nextjs/server"
import { getDb } from "@/lib/db"
import { connectionRequests } from "@/lib/db/schema"
import { getComposioClient, getAuthConfigForToolkit } from "@/lib/composio/client"
import { NextResponse } from "next/server"

export async function POST(
  request: Request,
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

    // Generate callback URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const callbackUrl = `${appUrl}/api/connections/callback`

    // Initiate connection with Composio using the link method for OAuth
    const connectionRequest = await composio.connectedAccounts.initiate(
      userId,
      authConfigId,
      {
        callbackUrl,
      }
    )

    // Store the connection request in our database for tracking
    const db = getDb()
    const now = new Date().toISOString()

    await db
      .insert(connectionRequests)
      .values({
        id: connectionRequest.id,
        userId,
        toolkitSlug,
        status: "PENDING",
        createdAt: now,
      })
      .run()

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
