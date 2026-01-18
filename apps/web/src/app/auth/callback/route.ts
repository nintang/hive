import { NextResponse } from "next/server"

// With Clerk, OAuth callbacks are handled automatically by Clerk's middleware.
// This route is kept for backwards compatibility but just redirects to home.
export async function GET(request: Request) {
  const host = request.headers.get("host")
  const protocol = host?.includes("localhost") ? "http" : "https"

  // Redirect to home - Clerk handles the actual auth callback
  return NextResponse.redirect(`${protocol}://${host}/`)
}
