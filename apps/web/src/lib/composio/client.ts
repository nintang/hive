import { Composio } from "@composio/core"

let composioInstance: Composio | null = null

export function getComposioClient(): Composio {
  if (!composioInstance) {
    const apiKey = process.env.COMPOSIO_API_KEY

    if (!apiKey) {
      throw new Error("COMPOSIO_API_KEY is not configured")
    }

    composioInstance = new Composio({
      apiKey,
    })
  }

  return composioInstance
}

// Check if a toolkit requires authentication
export async function doesToolkitRequireAuth(
  toolkitSlug: string
): Promise<boolean> {
  const composio = getComposioClient()

  try {
    const toolkit = await composio.toolkits.get(toolkitSlug)
    // Cast to access auth_schemes property from the raw API response
    const rawToolkit = toolkit as unknown as { auth_schemes?: string[] }
    const authSchemes = rawToolkit.auth_schemes || []
    // If authSchemes is empty or only contains "no_auth", it doesn't require auth
    return (
      authSchemes.length > 0 &&
      !authSchemes.every((scheme: string) => scheme.toLowerCase() === "no_auth")
    )
  } catch {
    // If we can't determine, assume it requires auth
    return true
  }
}

// Helper to get or create a Composio-managed auth config for a toolkit
export async function getAuthConfigForToolkit(
  toolkitSlug: string
): Promise<string | null> {
  const composio = getComposioClient()

  // Check if toolkit requires auth first
  const requiresAuth = await doesToolkitRequireAuth(toolkitSlug)
  if (!requiresAuth) {
    return null // No auth config needed
  }

  // List existing auth configs for this toolkit
  const existingConfigs = await composio.authConfigs.list({
    toolkit: toolkitSlug,
  })

  // Find a Composio-managed config that's enabled
  const managedConfig = existingConfigs.items.find(
    (config) => config.isComposioManaged && config.status === "ENABLED"
  )

  if (managedConfig) {
    return managedConfig.id
  }

  // Create a new Composio-managed auth config
  const newConfig = await composio.authConfigs.create(toolkitSlug, {
    name: `HiveChat ${toolkitSlug}`,
    type: "use_composio_managed_auth",
  })

  return newConfig.id
}

// Create a "connection" for a no-auth toolkit
// No-auth toolkits don't require auth configs or connected accounts -
// they just work without any authentication setup
export async function createNoAuthConnection(
  _userId: string,
  toolkitSlug: string
): Promise<{ id: string; status: string }> {
  // For no-auth toolkits, we don't need to create any auth config or
  // connected account. The Composio API will reject attempts to create
  // auth configs for no-auth toolkits with error code 303.
  // Instead, we return a virtual connection ID indicating the toolkit is ready.
  return {
    id: `no-auth-${toolkitSlug}`,
    status: "ACTIVE",
  }
}
