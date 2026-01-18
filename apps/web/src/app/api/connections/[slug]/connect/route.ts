import { auth } from "@clerk/nextjs/server"
import { getComposioClient, getAuthConfigForToolkit } from "@/lib/composio/client"
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
