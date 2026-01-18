import { UsageLimitError } from "@/lib/api"
import {
  AUTH_DAILY_MESSAGE_LIMIT,
  DAILY_LIMIT_PRO_MODELS,
  FREE_MODELS_IDS,
  NON_AUTH_DAILY_MESSAGE_LIMIT,
} from "@/lib/config"
import { getDb, users } from "@/lib/db"
import { eq } from "drizzle-orm"

type DbClient = ReturnType<typeof getDb>

const isFreeModel = (modelId: string) => FREE_MODELS_IDS.includes(modelId)
const isProModel = (modelId: string) => !isFreeModel(modelId)

/**
 * Checks the user's daily usage to see if they've reached their limit.
 * Uses the `anonymous` flag from the user record to decide which daily limit applies.
 */
export async function checkUsage(db: DbClient, userId: string) {
  const userData = await db
    .select({
      messageCount: users.messageCount,
      dailyMessageCount: users.dailyMessageCount,
      dailyReset: users.dailyReset,
      anonymous: users.anonymous,
      premium: users.premium,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get()

  if (!userData) {
    throw new Error("User record not found for id: " + userId)
  }

  // Decide which daily limit to use.
  const isAnonymous = userData.anonymous
  const dailyLimit = isAnonymous
    ? NON_AUTH_DAILY_MESSAGE_LIMIT
    : AUTH_DAILY_MESSAGE_LIMIT

  // Reset the daily counter if the day has changed (using UTC).
  const now = new Date()
  let dailyCount = userData.dailyMessageCount || 0
  const lastReset = userData.dailyReset ? new Date(userData.dailyReset) : null

  const isNewDay =
    !lastReset ||
    now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
    now.getUTCMonth() !== lastReset.getUTCMonth() ||
    now.getUTCDate() !== lastReset.getUTCDate()

  if (isNewDay) {
    dailyCount = 0
    await db
      .update(users)
      .set({ dailyMessageCount: 0, dailyReset: now.toISOString() })
      .where(eq(users.id, userId))
      .run()
  }

  // Check if the daily limit is reached.
  if (dailyCount >= dailyLimit) {
    throw new UsageLimitError("Daily message limit reached.")
  }

  return {
    userData,
    dailyCount,
    dailyLimit,
  }
}

/**
 * Increments both overall and daily message counters for a user.
 */
export async function incrementUsage(
  db: DbClient,
  userId: string
): Promise<void> {
  const userData = await db
    .select({
      messageCount: users.messageCount,
      dailyMessageCount: users.dailyMessageCount,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get()

  if (!userData) {
    throw new Error("User not found")
  }

  const messageCount = userData.messageCount || 0
  const dailyCount = userData.dailyMessageCount || 0

  // Increment both overall and daily message counts.
  const newOverallCount = messageCount + 1
  const newDailyCount = dailyCount + 1

  await db
    .update(users)
    .set({
      messageCount: newOverallCount,
      dailyMessageCount: newDailyCount,
      lastActiveAt: new Date().toISOString(),
    })
    .where(eq(users.id, userId))
    .run()
}

export async function checkProUsage(db: DbClient, userId: string) {
  const userData = await db
    .select({
      dailyProMessageCount: users.dailyProMessageCount,
      dailyProReset: users.dailyProReset,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get()

  if (!userData) {
    throw new Error("User not found for ID: " + userId)
  }

  let dailyProCount = userData.dailyProMessageCount || 0
  const now = new Date()
  const lastReset = userData.dailyProReset
    ? new Date(userData.dailyProReset)
    : null

  const isNewDay =
    !lastReset ||
    now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
    now.getUTCMonth() !== lastReset.getUTCMonth() ||
    now.getUTCDate() !== lastReset.getUTCDate()

  if (isNewDay) {
    dailyProCount = 0
    await db
      .update(users)
      .set({
        dailyProMessageCount: 0,
        dailyProReset: now.toISOString(),
      })
      .where(eq(users.id, userId))
      .run()
  }

  if (dailyProCount >= DAILY_LIMIT_PRO_MODELS) {
    throw new UsageLimitError("Daily Pro model limit reached.")
  }

  return {
    dailyProCount,
    limit: DAILY_LIMIT_PRO_MODELS,
  }
}

export async function incrementProUsage(db: DbClient, userId: string) {
  const userData = await db
    .select({
      dailyProMessageCount: users.dailyProMessageCount,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get()

  if (!userData) {
    throw new Error("Failed to fetch user usage for increment")
  }

  const count = userData.dailyProMessageCount || 0

  await db
    .update(users)
    .set({
      dailyProMessageCount: count + 1,
      lastActiveAt: new Date().toISOString(),
    })
    .where(eq(users.id, userId))
    .run()
}

export async function checkUsageByModel(
  db: DbClient,
  userId: string,
  modelId: string,
  isAuthenticated: boolean
) {
  if (isProModel(modelId)) {
    if (!isAuthenticated) {
      throw new UsageLimitError("You must log in to use this model.")
    }
    return await checkProUsage(db, userId)
  }

  return await checkUsage(db, userId)
}

export async function incrementUsageByModel(
  db: DbClient,
  userId: string,
  modelId: string,
  isAuthenticated: boolean
) {
  if (isProModel(modelId)) {
    if (!isAuthenticated) return
    return await incrementProUsage(db, userId)
  }

  return await incrementUsage(db, userId)
}
