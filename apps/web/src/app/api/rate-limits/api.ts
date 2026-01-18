import {
  AUTH_DAILY_MESSAGE_LIMIT,
  DAILY_LIMIT_PRO_MODELS,
  NON_AUTH_DAILY_MESSAGE_LIMIT,
} from "@/lib/config"
import { users } from "@/lib/db"
import { validateUserIdentity } from "@/lib/server/api"
import { eq } from "drizzle-orm"

export async function getMessageUsage(
  userId: string,
  isAuthenticated: boolean
) {
  const db = await validateUserIdentity(userId, isAuthenticated)
  if (!db) return null

  const data = await db
    .select({
      dailyMessageCount: users.dailyMessageCount,
      dailyProMessageCount: users.dailyProMessageCount,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get()

  if (!data) {
    throw new Error("Failed to fetch message usage")
  }

  const dailyLimit = isAuthenticated
    ? AUTH_DAILY_MESSAGE_LIMIT
    : NON_AUTH_DAILY_MESSAGE_LIMIT

  const dailyCount = data.dailyMessageCount || 0
  const dailyProCount = data.dailyProMessageCount || 0

  return {
    dailyCount,
    dailyProCount,
    dailyLimit,
    remaining: dailyLimit - dailyCount,
    remainingPro: DAILY_LIMIT_PRO_MODELS - dailyProCount,
  }
}
