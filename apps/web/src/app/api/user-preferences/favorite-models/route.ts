import { getDb, isD1Enabled, users } from "@/lib/db"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    if (!isD1Enabled()) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      )
    }

    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse the request body
    const body = await request.json()
    const { favorite_models } = body

    // Validate the favorite_models array
    if (!Array.isArray(favorite_models)) {
      return NextResponse.json(
        { error: "favorite_models must be an array" },
        { status: 400 }
      )
    }

    // Validate that all items in the array are strings
    if (!favorite_models.every((model) => typeof model === "string")) {
      return NextResponse.json(
        { error: "All favorite_models must be strings" },
        { status: 400 }
      )
    }

    const db = getDb()

    // Update the user's favorite models
    await db
      .update(users)
      .set({ favoriteModels: JSON.stringify(favorite_models) })
      .where(eq(users.id, userId))
      .run()

    // Fetch the updated data
    const data = await db
      .select({ favoriteModels: users.favoriteModels })
      .from(users)
      .where(eq(users.id, userId))
      .get()

    if (!data) {
      return NextResponse.json(
        { error: "Failed to update favorite models" },
        { status: 500 }
      )
    }

    // Handle case where favoriteModels might already be parsed (object) or is a JSON string
    let favoriteModels: string[] = []
    if (data.favoriteModels) {
      if (typeof data.favoriteModels === "string") {
        try {
          favoriteModels = JSON.parse(data.favoriteModels)
        } catch {
          favoriteModels = []
        }
      } else if (Array.isArray(data.favoriteModels)) {
        favoriteModels = data.favoriteModels
      }
    }

    return NextResponse.json({
      success: true,
      favorite_models: favoriteModels,
    })
  } catch (error) {
    console.error("Error in favorite-models API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    if (!isD1Enabled()) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      )
    }

    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = getDb()

    // Get the user's favorite models
    const data = await db
      .select({ favoriteModels: users.favoriteModels })
      .from(users)
      .where(eq(users.id, userId))
      .get()

    if (!data) {
      return NextResponse.json(
        { error: "Failed to fetch favorite models" },
        { status: 500 }
      )
    }

    // Handle case where favoriteModels might already be parsed (object) or is a JSON string
    let favoriteModels: string[] = []
    if (data.favoriteModels) {
      if (typeof data.favoriteModels === "string") {
        try {
          favoriteModels = JSON.parse(data.favoriteModels)
        } catch {
          favoriteModels = []
        }
      } else if (Array.isArray(data.favoriteModels)) {
        favoriteModels = data.favoriteModels
      }
    }

    return NextResponse.json({
      favorite_models: favoriteModels,
    })
  } catch (error) {
    console.error("Error in favorite-models GET API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
