import { auth, currentUser } from "@clerk/nextjs/server"
import { getDb, isD1Enabled, users, userPreferences } from "@/lib/db"
import { eq } from "drizzle-orm"
import {
  convertFromApiFormat,
  defaultPreferences,
  type LayoutType,
} from "@/lib/user-preference-store/utils"
import type { UserProfile } from "./types"

export async function getClerkUser() {
  const { userId } = await auth()
  if (!userId) return { userId: null, user: null }

  const user = await currentUser()
  return {
    userId,
    user,
  }
}

export async function getUserProfile(): Promise<UserProfile | null> {
  if (!isD1Enabled()) {
    // return fake user profile when D1 is not enabled
    return {
      id: "guest",
      email: "guest@hive.chat",
      display_name: "Guest",
      profile_image: "",
      anonymous: true,
      preferences: defaultPreferences,
    } as UserProfile
  }

  const { userId, user } = await getClerkUser()
  if (!userId || !user) return null

  const db = getDb()

  // Get user profile and preferences
  const userProfileData = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .get()

  // Don't load anonymous users in the user store
  if (userProfileData?.anonymous) return null

  // Get user preferences if they exist
  const preferencesData = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .get()

  // Format user preferences if they exist
  const formattedPreferences = preferencesData
    ? convertFromApiFormat({
        layout: (preferencesData.layout as LayoutType) ?? undefined,
        prompt_suggestions: preferencesData.promptSuggestions ?? undefined,
        show_tool_invocations: preferencesData.showToolInvocations ?? undefined,
        show_conversation_previews: preferencesData.showConversationPreviews ?? undefined,
        multi_model_enabled: preferencesData.multiModelEnabled ?? undefined,
        hidden_models: preferencesData.hiddenModels ? JSON.parse(preferencesData.hiddenModels) : [],
      })
    : undefined

  return {
    id: userId,
    email: user.emailAddresses[0]?.emailAddress || "",
    display_name: user.fullName || user.firstName || "",
    profile_image: user.imageUrl || "",
    anonymous: false,
    favorite_models: userProfileData?.favoriteModels ? JSON.parse(userProfileData.favoriteModels) : [],
    preferences: formattedPreferences,
  } as UserProfile
}
