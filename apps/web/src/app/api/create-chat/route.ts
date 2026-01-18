import { createChatInDb } from "./api"

export async function POST(request: Request) {
  console.log("[create-chat API] POST request received")
  try {
    const { userId, title, model, isAuthenticated, projectId } =
      await request.json()

    console.log("[create-chat API] Parsed body:", { userId, title, model, isAuthenticated, projectId })

    if (!userId) {
      console.log("[create-chat API] Missing userId")
      return new Response(JSON.stringify({ error: "Missing userId" }), {
        status: 400,
      })
    }

    console.log("[create-chat API] Calling createChatInDb...")
    const chat = await createChatInDb({
      userId,
      title,
      model,
      isAuthenticated,
      projectId,
    })

    console.log("[create-chat API] createChatInDb result:", chat)

    if (!chat) {
      console.log("[create-chat API] chat is null, returning fallback response")
      return new Response(
        JSON.stringify({ error: "Supabase not available in this deployment." }),
        { status: 200 }
      )
    }

    console.log("[create-chat API] Returning success with chat:", chat)
    return new Response(JSON.stringify({ chat }), { status: 200 })
  } catch (err: unknown) {
    console.error("Error in create-chat endpoint:", err)

    if (err instanceof Error && err.message === "DAILY_LIMIT_REACHED") {
      return new Response(
        JSON.stringify({ error: err.message, code: "DAILY_LIMIT_REACHED" }),
        { status: 403 }
      )
    }

    return new Response(
      JSON.stringify({
        error: (err as Error).message || "Internal server error",
      }),
      { status: 500 }
    )
  }
}
