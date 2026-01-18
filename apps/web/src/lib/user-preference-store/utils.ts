export type LayoutType = "sidebar" | "fullscreen"
export type ToolModeType = "single" | "multi"

export type UserPreferences = {
  layout: LayoutType
  promptSuggestions: boolean
  showToolInvocations: boolean
  showConversationPreviews: boolean
  multiModelEnabled: boolean
  hiddenModels: string[]
  // Persisted chat settings
  lastModelId: string | null
  lastConnectionIds: string[]
  toolMode: ToolModeType
}

export const defaultPreferences: UserPreferences = {
  layout: "fullscreen",
  promptSuggestions: true,
  showToolInvocations: true,
  showConversationPreviews: true,
  multiModelEnabled: false,
  hiddenModels: [],
  // Persisted chat settings
  lastModelId: null,
  lastConnectionIds: [],
  toolMode: "single",
}

// API format type (snake_case)
type ApiUserPreferences = {
  layout?: LayoutType
  prompt_suggestions?: boolean
  show_tool_invocations?: boolean
  show_conversation_previews?: boolean
  multi_model_enabled?: boolean
  hidden_models?: string[]
  // Persisted chat settings
  last_model_id?: string | null
  last_connection_ids?: string[]
  tool_mode?: ToolModeType
}

// Helper functions to convert between API format (snake_case) and frontend format (camelCase)
export function convertFromApiFormat(
  apiData: ApiUserPreferences
): UserPreferences {
  return {
    layout: apiData.layout || "fullscreen",
    promptSuggestions: apiData.prompt_suggestions ?? true,
    showToolInvocations: apiData.show_tool_invocations ?? true,
    showConversationPreviews: apiData.show_conversation_previews ?? true,
    multiModelEnabled: apiData.multi_model_enabled ?? false,
    hiddenModels: apiData.hidden_models || [],
    // Persisted chat settings
    lastModelId: apiData.last_model_id ?? null,
    lastConnectionIds: apiData.last_connection_ids || [],
    toolMode: apiData.tool_mode || "single",
  }
}

export function convertToApiFormat(
  preferences: Partial<UserPreferences>
): ApiUserPreferences {
  const apiData: ApiUserPreferences = {}
  if (preferences.layout !== undefined) apiData.layout = preferences.layout
  if (preferences.promptSuggestions !== undefined)
    apiData.prompt_suggestions = preferences.promptSuggestions
  if (preferences.showToolInvocations !== undefined)
    apiData.show_tool_invocations = preferences.showToolInvocations
  if (preferences.showConversationPreviews !== undefined)
    apiData.show_conversation_previews = preferences.showConversationPreviews
  if (preferences.multiModelEnabled !== undefined)
    apiData.multi_model_enabled = preferences.multiModelEnabled
  if (preferences.hiddenModels !== undefined)
    apiData.hidden_models = preferences.hiddenModels
  // Persisted chat settings
  if (preferences.lastModelId !== undefined)
    apiData.last_model_id = preferences.lastModelId
  if (preferences.lastConnectionIds !== undefined)
    apiData.last_connection_ids = preferences.lastConnectionIds
  if (preferences.toolMode !== undefined)
    apiData.tool_mode = preferences.toolMode
  return apiData
}
