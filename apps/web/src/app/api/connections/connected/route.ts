import { auth } from "@clerk/nextjs/server"
import { getDb } from "@/lib/db"
import { connectedAccounts } from "@/lib/db/schema"
import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = getDb()

    const accounts = await db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, userId))
      .all()

    return NextResponse.json({
      accounts: accounts.map((acc) => ({
        id: acc.id,
        toolkitSlug: acc.toolkitSlug,
        toolkitName: acc.toolkitName,
        toolkitLogo: acc.toolkitLogo,
        status: acc.status,
        createdAt: acc.createdAt,
      })),
    })
  } catch (error) {
    console.error("Error fetching connected accounts:", error)
    return NextResponse.json(
      { error: "Failed to fetch connected accounts" },
      { status: 500 }
    )
  }
}
