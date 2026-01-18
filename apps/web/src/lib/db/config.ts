// Database configuration
// Replaces the old Supabase config

export const isD1Enabled = Boolean(
  process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.CLOUDFLARE_D1_DATABASE_ID &&
    process.env.CLOUDFLARE_D1_TOKEN
)

// Alias for backwards compatibility with isSupabaseEnabled checks
export const isDatabaseEnabled = isD1Enabled
