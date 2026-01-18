import {
  getAllModels,
  getModelsForUserProviders,
  getModelsWithAccessFlags,
  refreshModelsCache,
} from "@/lib/models"
import { getDb, isD1Enabled, userKeys } from "@/lib/db"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    if (!isD1Enabled()) {
      const allModels = await getAllModels()
      const models = allModels.map((model) => ({
        ...model,
        accessible: true,
      }))
      return new Response(JSON.stringify({ models }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    }

    const { userId } = await auth()

    if (!userId) {
      const models = await getModelsWithAccessFlags()
      return new Response(JSON.stringify({ models }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    }

    const db = getDb()
    const data = await db
      .select({ provider: userKeys.provider })
      .from(userKeys)
      .where(eq(userKeys.userId, userId))
      .all()

    if (!data || data.length === 0) {
      const models = await getModelsWithAccessFlags()
      return new Response(JSON.stringify({ models }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    }

    const userProviders = data.map((k: { provider: string }) => k.provider)

    const models = await getModelsForUserProviders(userProviders)

    return new Response(JSON.stringify({ models }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    })
  } catch (error) {
    console.error("Error fetching models:", error)
    return new Response(JSON.stringify({ error: "Failed to fetch models" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    })
  }
}

export async function POST() {
  try {
    refreshModelsCache()
    const models = await getAllModels()

    return NextResponse.json({
      message: "Models cache refreshed",
      models,
      timestamp: new Date().toISOString(),
      count: models.length,
    })
  } catch (error) {
    console.error("Failed to refresh models:", error)
    return NextResponse.json(
      { error: "Failed to refresh models" },
      { status: 500 }
    )
  }
}
