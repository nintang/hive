import { getDb } from "@/lib/db"
import { connectionRequests, connectedAccounts } from "@/lib/db/schema"
import { getComposioClient } from "@/lib/composio/client"
import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"

export async function GET(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  try {
    const { searchParams } = new URL(request.url)

    // Composio sends these params in the callback
    const connectionId = searchParams.get("connectedAccountId")
    const status = searchParams.get("status")

    // If Composio provides a connection ID directly, use it
    if (connectionId && status === "success") {
      const db = getDb()
      const composio = getComposioClient()

      // Get the connected account details from Composio
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const connectedAccountsList = await (composio.connectedAccounts as any).list({})
      const connectedAccount = connectedAccountsList.items.find(
        (acc: { id: string }) => acc.id === connectionId
      )

      if (connectedAccount) {
        // Get toolkit info
        const toolkit = await composio.toolkits.get(connectedAccount.toolkit.slug)

        const now = new Date().toISOString()

        // Get user ID from Composio response (the userId we passed during initiate)
        let userId = connectedAccount.userId

        // If not available from Composio, try to find it from our pending connection requests
        if (!userId) {
          const pendingRequests = await db
            .select()
            .from(connectionRequests)
            .where(eq(connectionRequests.status, "PENDING"))
            .all()

          // Find a pending request for this toolkit
          const matchingRequest = pendingRequests.find(
            (req) => req.toolkitSlug === connectedAccount.toolkit.slug
          )
          if (matchingRequest) {
            userId = matchingRequest.userId
          }
        }

        // If we still don't have a user ID, we can't proceed
        if (!userId) {
          console.error("Could not determine user ID for connected account:", connectionId)
          return NextResponse.redirect(
            new URL("/?connection=error", appUrl)
          )
        }

        // Store the connected account
        await db
          .insert(connectedAccounts)
          .values({
            id: connectedAccount.id,
            userId,
            toolkitSlug: connectedAccount.toolkit.slug,
            toolkitName: toolkit.name || connectedAccount.toolkit.slug,
            toolkitLogo: toolkit.meta?.logo || null,
            status: connectedAccount.status || "ACTIVE",
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: connectedAccounts.id,
            set: {
              status: connectedAccount.status || "ACTIVE",
              updatedAt: now,
            },
          })
          .run()

        // Update the connection request status
        await db
          .update(connectionRequests)
          .set({ status: "COMPLETED" })
          .where(eq(connectionRequests.userId, userId))
          .run()

        return NextResponse.redirect(
          new URL("/?connection=success", appUrl)
        )
      }
    }

    // Handle failure
    if (status === "failed" || status === "error") {
      return NextResponse.redirect(
        new URL("/?connection=failed", appUrl)
      )
    }

    // If we get here without proper params, it might be an error
    return NextResponse.redirect(
      new URL("/?connection=unknown", appUrl)
    )
  } catch (error) {
    console.error("Error in OAuth callback:", error)
    return NextResponse.redirect(
      new URL("/?connection=error", appUrl)
    )
  }
}
