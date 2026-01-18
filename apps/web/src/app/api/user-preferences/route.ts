import { getDb, isD1Enabled, userPreferences, users } from "@/lib/db"
import { auth, currentUser } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

/**
 * Ensures a Clerk user exists in the database, creating them if necessary.
 */
async function ensureUserExists(
  db: ReturnType<typeof getDb>,
  clerkUserId: string
) {
  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, clerkUserId))
    .get()

  if (existingUser) {
    return existingUser
  }

  const clerkUser = await currentUser()
  if (!clerkUser) {
    throw new Error("Unable to fetch Clerk user details")
  }

  const email =
    clerkUser.emailAddresses[0]?.emailAddress || `${clerkUserId}@clerk.user`
  const displayName = clerkUser.fullName || clerkUser.firstName || null
  const profileImage = clerkUser.imageUrl || null

  await db
    .insert(users)
    .values({
      id: clerkUserId,
      email,
      displayName,
      profileImage,
      anonymous: false,
      premium: false,
      messageCount: 0,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })
    .run()

  return { id: clerkUserId }
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
    const data = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .get()

    // If no preferences exist, return defaults
    if (!data) {
      return NextResponse.json({
        layout: "fullscreen",
        prompt_suggestions: true,
        show_tool_invocations: true,
        show_conversation_previews: true,
        multi_model_enabled: false,
        hidden_models: [],
      })
    }

    return NextResponse.json({
      layout: data.layout,
      prompt_suggestions: data.promptSuggestions,
      show_tool_invocations: data.showToolInvocations,
      show_conversation_previews: data.showConversationPreviews,
      multi_model_enabled: data.multiModelEnabled,
      hidden_models: data.hiddenModels ? JSON.parse(data.hiddenModels) : [],
    })
  } catch (error) {
    console.error("Error in user-preferences GET API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
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

    const body = await request.json()

    const {
      layout,
      prompt_suggestions,
      show_tool_invocations,
      show_conversation_previews,
      multi_model_enabled,
      hidden_models,
    } = body

    // Validate the data types
    if (layout && typeof layout !== "string") {
      return NextResponse.json(
        { error: "layout must be a string" },
        { status: 400 }
      )
    }

    if (hidden_models && !Array.isArray(hidden_models)) {
      return NextResponse.json(
        { error: "hidden_models must be an array" },
        { status: 400 }
      )
    }

    const db = getDb()

    // Ensure the user exists in the database before saving preferences
    await ensureUserExists(db, userId)

    // Check if user preferences exist
    const existing = await db
      .select({ userId: userPreferences.userId })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .get()
    const hasExisting = existing?.userId !== undefined

    const now = new Date().toISOString()

    // Prepare update object with only provided fields (using camelCase for Drizzle)
    const updateData: Record<string, unknown> = { updatedAt: now }
    if (layout !== undefined) updateData.layout = layout
    if (prompt_suggestions !== undefined)
      updateData.promptSuggestions = prompt_suggestions
    if (show_tool_invocations !== undefined)
      updateData.showToolInvocations = show_tool_invocations
    if (show_conversation_previews !== undefined)
      updateData.showConversationPreviews = show_conversation_previews
    if (multi_model_enabled !== undefined)
      updateData.multiModelEnabled = multi_model_enabled
    if (hidden_models !== undefined) updateData.hiddenModels = JSON.stringify(hidden_models)

    if (!hasExisting) {
      // Insert new preferences
      await db
        .insert(userPreferences)
        .values({
          userId,
          layout: layout || "fullscreen",
          promptSuggestions: prompt_suggestions ?? true,
          showToolInvocations: show_tool_invocations ?? true,
          showConversationPreviews: show_conversation_previews ?? true,
          multiModelEnabled: multi_model_enabled ?? false,
          hiddenModels: JSON.stringify(hidden_models || []),
          createdAt: now,
          updatedAt: now,
        })
        .run()
    } else {
      // Update existing preferences
      await db
        .update(userPreferences)
        .set(updateData)
        .where(eq(userPreferences.userId, userId))
        .run()
    }

    // Fetch the updated data
    const data = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .get()

    if (!data) {
      return NextResponse.json(
        { error: "Failed to update user preferences" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      layout: data.layout,
      prompt_suggestions: data.promptSuggestions,
      show_tool_invocations: data.showToolInvocations,
      show_conversation_previews: data.showConversationPreviews,
      multi_model_enabled: data.multiModelEnabled,
      hidden_models: data.hiddenModels ? JSON.parse(data.hiddenModels) : [],
    })
  } catch (error) {
    console.error("Error in user-preferences PUT API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
