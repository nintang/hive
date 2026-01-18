import { toast } from "@/components/ui/toast"
import { getDb, users, isD1Enabled } from "@/lib/db"
import { eq } from "drizzle-orm"
import type { UserProfile } from "@/lib/user/types"

export async function fetchUserProfile(
  id: string
): Promise<UserProfile | null> {
  if (!isD1Enabled()) return null

  const db = getDb()
  const data = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .get()

  if (!data) {
    console.error("Failed to fetch user")
    return null
  }

  // Don't return anonymous users
  if (data.anonymous) return null

  return {
    id: data.id,
    email: data.email,
    display_name: data.displayName || "",
    profile_image: data.profileImage || "",
    anonymous: data.anonymous ?? false,
    premium: data.premium ?? false,
    message_count: data.messageCount ?? 0,
    daily_message_count: data.dailyMessageCount ?? 0,
    daily_reset: data.dailyReset,
    daily_pro_message_count: data.dailyProMessageCount ?? 0,
    daily_pro_reset: data.dailyProReset,
    favorite_models: data.favoriteModels ?? [],
    system_prompt: data.systemPrompt,
    created_at: data.createdAt,
    last_active_at: data.lastActiveAt,
  }
}

export async function updateUserProfile(
  id: string,
  updates: Partial<UserProfile>
): Promise<boolean> {
  if (!isD1Enabled()) return false

  const db = getDb()

  // Convert snake_case to camelCase for Drizzle schema
  const drizzleUpdates: Record<string, unknown> = {}
  if (updates.display_name !== undefined) drizzleUpdates.displayName = updates.display_name
  if (updates.profile_image !== undefined) drizzleUpdates.profileImage = updates.profile_image
  if (updates.favorite_models !== undefined) drizzleUpdates.favoriteModels = updates.favorite_models
  if (updates.system_prompt !== undefined) drizzleUpdates.systemPrompt = updates.system_prompt
  if (updates.premium !== undefined) drizzleUpdates.premium = updates.premium
  if (updates.last_active_at !== undefined) drizzleUpdates.lastActiveAt = updates.last_active_at

  try {
    await db.update(users).set(drizzleUpdates).where(eq(users.id, id)).run()
    return true
  } catch (error) {
    console.error("Failed to update user:", error)
    return false
  }
}

export async function signOutUser(): Promise<boolean> {
  // Note: With Clerk, sign out is handled client-side via useClerk hook
  // This function is kept for API compatibility but should use Clerk's signOut
  toast({
    title: "Use the sign out button in the UI",
    status: "info",
  })
  return false
}

// Polling-based user updates (replaces realtime subscriptions)
export async function pollUserUpdates(
  userId: string
): Promise<Partial<UserProfile> | null> {
  try {
    const profile = await fetchUserProfile(userId)
    return profile
  } catch (error) {
    console.error("Failed to poll user updates:", error)
    return null
  }
}

// For backwards compatibility - now a no-op since we use polling
export function subscribeToUserUpdates(
  userId: string,
  onUpdate: (newData: Partial<UserProfile>) => void
) {
  // Return empty cleanup function
  // User updates are now handled via polling in the user provider
  return () => {}
}
