import { NextResponse } from "next/server"

// OAuth callback handler - Composio is the source of truth for connections
// We just need to redirect the user back to the app with a status indicator
export async function GET(request: Request) {
  // Auto-detect the app URL from the request, with fallbacks
  const requestUrl = new URL(request.url)
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    `${requestUrl.protocol}//${requestUrl.host}`

  try {
    const { searchParams } = new URL(request.url)

    // Composio sends these params in the callback
    const status = searchParams.get("status")
    const connectionId = searchParams.get("connectedAccountId")

    if (status === "success" && connectionId) {
      // Connection successful - Composio has stored the connection
      // No need to store in D1, just redirect with success status
      console.log("[OAuth Callback] Connection successful:", connectionId)
      return NextResponse.redirect(new URL("/?connection=success", appUrl))
    }

    // Handle failure
    if (status === "failed" || status === "error") {
      console.log("[OAuth Callback] Connection failed:", status)
      return NextResponse.redirect(new URL("/?connection=failed", appUrl))
    }

    // If we get here without proper params, it might be an error
    console.log("[OAuth Callback] Unknown status:", { status, connectionId })
    return NextResponse.redirect(new URL("/?connection=unknown", appUrl))
  } catch (error) {
    console.error("Error in OAuth callback:", error)
    return NextResponse.redirect(new URL("/?connection=error", appUrl))
  }
}
