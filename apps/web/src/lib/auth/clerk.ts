import { auth, currentUser } from "@clerk/nextjs/server"

// Check if Clerk is enabled
export function isClerkEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
}

// Get the authenticated user ID
export async function getAuthUserId(): Promise<string | null> {
  const { userId } = await auth()
  return userId
}

// Get the full authenticated user
export async function getAuthUser() {
  const user = await currentUser()
  if (!user) return null

  return {
    id: user.id,
    email: user.emailAddresses[0]?.emailAddress || "",
    displayName: user.firstName
      ? `${user.firstName} ${user.lastName || ""}`.trim()
      : user.username || null,
    profileImage: user.imageUrl || null,
  }
}

// Require authentication - throws if not authenticated
export async function requireAuth() {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Unauthorized")
  }
  return userId
}
