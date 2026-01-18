import { auth, currentUser } from "@clerk/nextjs/server"
import { getDb, isD1Enabled, users } from "@/lib/db"
import { eq, and } from "drizzle-orm"

/**
 * Ensures a Clerk user exists in the database, creating them if necessary.
 * This is called lazily when an authenticated user makes their first request.
 */
async function ensureClerkUserExists(
  db: ReturnType<typeof getDb>,
  clerkUserId: string
) {
  console.log("[ensureClerkUserExists] Checking for user:", clerkUserId)

  // Check if user already exists
  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, clerkUserId))
    .get()

  console.log("[ensureClerkUserExists] Query result:", existingUser, "type:", typeof existingUser)

  // Handle both object format {id: ...} and array format [...]
  const userId = existingUser?.id ?? (Array.isArray(existingUser) ? existingUser[0] : null)

  if (userId) {
    console.log("[ensureClerkUserExists] User exists with id:", userId)
    return { id: userId }
  }

  console.log("[ensureClerkUserExists] User doesn't exist, creating...")
  // User doesn't exist, create them
  const clerkUser = await currentUser()
  if (!clerkUser) {
    throw new Error("Unable to fetch Clerk user details")
  }

  const email = clerkUser.emailAddresses[0]?.emailAddress || `${clerkUserId}@clerk.user`
  const displayName = clerkUser.fullName || clerkUser.firstName || null
  const profileImage = clerkUser.imageUrl || null

  try {
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
    console.log("[ensureClerkUserExists] User created successfully:", clerkUserId)
  } catch (err) {
    console.error("[ensureClerkUserExists] Failed to create user:", err)
    throw err
  }

  return { id: clerkUserId }
}

/**
 * Validates the user's identity using Clerk authentication
 * @param userId - The ID of the user.
 * @param isAuthenticated - Whether the user is authenticated.
 * @returns The database instance if validation succeeds, or null if D1 is not configured.
 */
export async function validateUserIdentity(
  userId: string,
  isAuthenticated: boolean
) {
  // If D1 is not configured, return null to allow local-only mode
  if (!isD1Enabled()) {
    return null
  }

  const db = getDb()

  if (isAuthenticated) {
    const { userId: clerkUserId } = await auth()

    if (!clerkUserId) {
      throw new Error("Unable to get authenticated user")
    }

    if (clerkUserId !== userId) {
      throw new Error("User ID does not match authenticated user")
    }

    // Ensure the Clerk user exists in our database
    await ensureClerkUserExists(db, clerkUserId)
  } else {
    // For guest/anonymous users, verify they exist in the database
    const userRecord = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.anonymous, true)))
      .get()

    if (!userRecord) {
      throw new Error("Invalid or missing guest user")
    }
  }

  return db
}

/**
 * Get the current authenticated user ID from Clerk
 */
export async function getAuthUserId(): Promise<string | null> {
  const { userId } = await auth()
  return userId
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(): Promise<string> {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Unauthorized")
  }
  return userId
}
