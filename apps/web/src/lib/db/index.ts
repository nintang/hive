import { drizzle } from "drizzle-orm/sqlite-proxy"
import * as schema from "./schema"

// D1 HTTP API response types
interface D1QueryResult {
  results: Record<string, unknown>[]
  success: boolean
  meta: {
    changes: number
    duration: number
    last_row_id: number
    rows_read: number
    rows_written: number
  }
}

interface D1Response {
  success: boolean
  errors: Array<{ message: string }>
  messages: string[]
  result: D1QueryResult[]
}

// Check if D1 is configured
export function isD1Enabled(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
      process.env.CLOUDFLARE_D1_DATABASE_ID &&
      process.env.CLOUDFLARE_D1_TOKEN
  )
}

// Execute a query against D1 via HTTP API
async function executeD1Query(
  sql: string,
  params: unknown[],
  method: "all" | "run" | "get" | "values"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ rows: any[] }> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID
  const token = process.env.CLOUDFLARE_D1_TOKEN

  if (!accountId || !databaseId || !token) {
    throw new Error(
      "D1 is not configured. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, and CLOUDFLARE_D1_TOKEN."
    )
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sql,
      params,
    }),
  })

  const text = await response.text()

  if (!response.ok) {
    throw new Error(`D1 HTTP error: ${response.status} ${text}`)
  }

  let data: D1Response
  try {
    data = JSON.parse(text) as D1Response
  } catch {
    throw new Error(`D1 returned invalid JSON (status ${response.status}): ${text.slice(0, 500)}`)
  }

  if (!data.success) {
    throw new Error(`D1 query error: ${data.errors[0]?.message || "Unknown error"}`)
  }

  const results = data.result?.[0]?.results || []

  // Handle different methods
  // sqlite-proxy expects rows as arrays of values, not objects
  // The column order must match the SELECT order in the SQL
  if (method === "run") {
    return { rows: [] }
  }

  if (method === "values") {
    // Return array of arrays (values only)
    return {
      rows: results.map((row) => Object.values(row)),
    }
  }

  // Convert results to arrays of values
  const rowArrays = results.map((row) => Object.values(row))

  // For "get", return a single row as flat array, or undefined if no rows
  // Drizzle expects { rows: array } where array is the single row's values,
  // or { rows: undefined } when no row is found
  if (method === "get") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { rows: rowArrays[0] as any }
  }

  return { rows: rowArrays }
}

// Create the Drizzle database instance using sqlite-proxy
// Note: We don't pass { schema } to avoid relational query issues with our custom proxy
const db = drizzle(
  async (sql, params, method) => {
    try {
      const result = await executeD1Query(sql, params, method)
      return result
    } catch (error) {
      console.error("D1 query error:", error)
      throw error
    }
  }
)

// Export the database instance
export function getDb() {
  if (!isD1Enabled()) {
    throw new Error(
      "D1 is not configured. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, and CLOUDFLARE_D1_TOKEN."
    )
  }
  return db
}

// Re-export schema, types, and config
export * from "./schema"
export * from "./config"
