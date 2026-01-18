import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse, type NextRequest } from "next/server"

// Define protected routes that require authentication
const isProtectedRoute = createRouteMatcher([
  "/api/user-keys(.*)",
  "/api/user-preferences(.*)",
  "/api/projects(.*)",
])

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/api/health",
  "/api/models",
  "/api/providers",
  "/api/csrf",
  "/share/(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
])

export default clerkMiddleware(async (auth, req) => {
  // Check if this is a protected route
  if (isProtectedRoute(req)) {
    await auth.protect()
  }

  const response = NextResponse.next()

  // CSP for development and production
  const isDev = process.env.NODE_ENV === "development"

  // Add Clerk domains to CSP
  response.headers.set(
    "Content-Security-Policy",
    isDev
      ? `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://assets.onedollarstats.com https://*.clerk.accounts.dev; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; connect-src 'self' wss: https://api.openai.com https://api.mistral.ai https://api.cloudflare.com https://api.github.com https://collector.onedollarstats.com https://*.clerk.accounts.dev; frame-src 'self' https://*.clerk.accounts.dev;`
      : `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://analytics.umami.is https://vercel.live https://assets.onedollarstats.com https://*.clerk.com; frame-src 'self' https://vercel.live https://*.clerk.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; connect-src 'self' wss: https://api.openai.com https://api.mistral.ai https://api.cloudflare.com https://api-gateway.umami.dev https://api.github.com https://collector.onedollarstats.com https://*.clerk.com;`
  )

  return response
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}
