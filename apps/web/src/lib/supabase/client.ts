import { createBrowserClient } from "@supabase/ssr"
import { isSupabaseEnabled } from "./config"

export function createClient() {
  if (!isSupabaseEnabled) {
    return null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createBrowserClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
