import { PROVIDERS } from "@/lib/providers"
import { getDb, isD1Enabled, userKeys } from "@/lib/db"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

const SUPPORTED_PROVIDERS = PROVIDERS.map((p) => p.id)

export async function GET() {
  try {
    if (!isD1Enabled()) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 500 }
      )
    }

    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = getDb()
    const data = await db
      .select({ provider: userKeys.provider })
      .from(userKeys)
      .where(eq(userKeys.userId, userId))
      .all()

    // Create status object for all supported providers
    const userProviders = data?.map((k: { provider: string }) => k.provider) || []
    const providerStatus = SUPPORTED_PROVIDERS.reduce(
      (acc, provider) => {
        acc[provider] = userProviders.includes(provider)
        return acc
      },
      {} as Record<string, boolean>
    )

    return NextResponse.json(providerStatus)
  } catch (err) {
    console.error("Key status error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
