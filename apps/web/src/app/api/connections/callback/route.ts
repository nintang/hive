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

        // Extract user ID from the connected account (varies by SDK version)
        const userId = connectedAccount.member?.externalId ||
                      connectedAccount.externalId ||
                      connectedAccount.userId ||
                      "unknown"

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

        // Update any pending connection request
        if (userId !== "unknown") {
          await db
            .update(connectionRequests)
            .set({ status: "COMPLETED" })
            .where(eq(connectionRequests.userId, userId))
            .run()
        }

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
