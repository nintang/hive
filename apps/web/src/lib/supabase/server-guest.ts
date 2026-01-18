import { createServerClient } from "@supabase/ssr"
import { isSupabaseEnabled } from "./config"

export async function createGuestServerClient() {
  if (!isSupabaseEnabled) {
    return null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  )
}
