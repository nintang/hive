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

// Helper to get or create a Composio-managed auth config for a toolkit
export async function getAuthConfigForToolkit(toolkitSlug: string): Promise<string> {
  const composio = getComposioClient()

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
