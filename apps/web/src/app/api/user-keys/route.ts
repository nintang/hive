import { encryptKey } from "@/lib/encryption"
import { getModelsForProvider } from "@/lib/models"
import { getDb, isD1Enabled, userKeys, users } from "@/lib/db"
import { auth } from "@clerk/nextjs/server"
import { eq, and } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { provider, apiKey } = await request.json()

    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: "Provider and API key are required" },
        { status: 400 }
      )
    }

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
    const { encrypted, iv } = encryptKey(apiKey)

    // Check if this is a new API key (not an update)
    const existingKey = await db
      .select({ provider: userKeys.provider })
      .from(userKeys)
      .where(and(eq(userKeys.userId, userId), eq(userKeys.provider, provider)))
      .get()

    const isNewKey = !existingKey

    // Save the API key using INSERT OR REPLACE for SQLite upsert
    const now = new Date().toISOString()
    if (isNewKey) {
      await db
        .insert(userKeys)
        .values({
          userId,
          provider,
          encryptedKey: encrypted,
          iv,
          createdAt: now,
          updatedAt: now,
        })
        .run()
    } else {
      await db
        .update(userKeys)
        .set({
          encryptedKey: encrypted,
          iv,
          updatedAt: now,
        })
        .where(and(eq(userKeys.userId, userId), eq(userKeys.provider, provider)))
        .run()
    }

    // If this is a new API key, add provider models to favorites
    if (isNewKey) {
      try {
        // Get current user's favorite models
        const userData = await db
          .select({ favoriteModels: users.favoriteModels })
          .from(users)
          .where(eq(users.id, userId))
          .get()

        const currentFavorites = (userData?.favoriteModels as string[]) || []

        // Get models for this provider
        const providerModels = await getModelsForProvider(provider)
        const providerModelIds = providerModels.map((model) => model.id)

        // Skip if no models found for this provider
        if (providerModelIds.length === 0) {
          return NextResponse.json({
            success: true,
            isNewKey,
            message: "API key saved",
          })
        }

        // Add provider models to favorites (only if not already there)
        const newModelsToAdd = providerModelIds.filter(
          (modelId) => !currentFavorites.includes(modelId)
        )

        if (newModelsToAdd.length > 0) {
          const updatedFavorites = [...currentFavorites, ...newModelsToAdd]

          // Update user's favorite models
          await db
            .update(users)
            .set({ favoriteModels: updatedFavorites })
            .where(eq(users.id, userId))
            .run()
        }
      } catch (modelsError) {
        console.error("Failed to update favorite models:", modelsError)
        // Don't fail the main request if favorite models update fails
      }
    }

    return NextResponse.json({
      success: true,
      isNewKey,
      message: isNewKey
        ? `API key saved and ${provider} models added to favorites`
        : "API key updated",
    })
  } catch (error) {
    console.error("Error in POST /api/user-keys:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { provider } = await request.json()

    if (!provider) {
      return NextResponse.json(
        { error: "Provider is required" },
        { status: 400 }
      )
    }

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
    await db
      .delete(userKeys)
      .where(and(eq(userKeys.userId, userId), eq(userKeys.provider, provider)))
      .run()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in DELETE /api/user-keys:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
