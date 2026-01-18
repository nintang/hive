import { getDb, isD1Enabled, users } from "@/lib/db"
import { eq } from "drizzle-orm"

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), {
        status: 400,
      })
    }

    if (!isD1Enabled()) {
      console.log("D1 not enabled, skipping guest creation.")
      return new Response(
        JSON.stringify({ user: { id: userId, anonymous: true } }),
        {
          status: 200,
        }
      )
    }

    const db = getDb()

    // Check if the user record already exists.
    let userData = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .get()

    if (!userData) {
      try {
        await db
          .insert(users)
          .values({
            id: userId,
            email: `${userId}@anonymous.example`,
            anonymous: true,
            messageCount: 0,
            premium: false,
            createdAt: new Date().toISOString(),
          })
          .run()

        userData = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .get()

        if (!userData) {
          console.error("Error creating guest user: failed to retrieve")
          return new Response(
            JSON.stringify({
              error: "Failed to create guest user",
            }),
            { status: 500 }
          )
        }
      } catch (error) {
        console.error("Error creating guest user:", error)
        return new Response(
          JSON.stringify({
            error: "Failed to create guest user",
            details: (error as Error).message,
          }),
          { status: 500 }
        )
      }
    }

    // Return in snake_case format for backwards compatibility
    return new Response(
      JSON.stringify({
        user: {
          id: userData.id,
          email: userData.email,
          display_name: userData.displayName,
          profile_image: userData.profileImage,
          anonymous: userData.anonymous,
          premium: userData.premium,
          message_count: userData.messageCount,
          created_at: userData.createdAt,
        },
      }),
      { status: 200 }
    )
  } catch (err: unknown) {
    console.error("Error in create-guest endpoint:", err)

    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal server error" }),
      { status: 500 }
    )
  }
}
