import { createServerClient, type CookieMethodsServer } from "@supabase/ssr"
import { cookies } from "next/headers"
import { isSupabaseEnabled } from "./config"

export const createClient = async () => {
  if (!isSupabaseEnabled) {
    return null
  }

  const cookieStore = await cookies()

  const cookieMethods: CookieMethodsServer = {
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options)
        })
      } catch {
        // ignore for middleware
      }
    },
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: cookieMethods,
    }
  )
}
