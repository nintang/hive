// Composio API response types
export interface ComposioToolkit {
  name: string
  slug: string
  auth_schemes: string[]
  composio_managed_auth_schemes: string[]
  is_local_toolkit: boolean
  status: string
  meta: {
    triggers_count: number
    tools_count: number
    description: string
    logo: string
    app_url: string
    categories: Array<{
      id: string
      name: string
    }>
    created_at: string
    updated_at: string
    version: string
  }
  no_auth: boolean
}

export interface ComposioToolkitsResponse {
  items: ComposioToolkit[]
  next_cursor: string | null
  total_pages: number
  current_page: number
  total_items: number
}

// Internal connection type used by the app
export interface Connection {
  id: string
  name: string
  slug: string
  logo: string
  description: string
  category: string
  categoryId: string
  authSchemes: string[]
  toolsCount: number
  appUrl: string
  connected: boolean
}

// Tool type for individual tools within a connection
export interface ConnectionTool {
  slug: string
  name: string
  description: string
}

// Category mapping from Composio's category IDs to display names
export const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  "collaboration-&-communication": "Communication",
  "developer-tools-&-devops": "Development",
  "productivity-&-project-management": "Productivity",
  "scheduling-&-booking": "Scheduling",
  "ai-&-machine-learning": "AI & ML",
  "crm-&-sales": "CRM & Sales",
  "marketing-&-seo": "Marketing",
  "finance-&-accounting": "Finance",
  "storage-&-file-management": "Storage",
  "e-commerce": "E-commerce",
  "customer-support": "Support",
  "hr-&-recruiting": "HR",
  "analytics-&-data": "Analytics",
  "social-media": "Social Media",
  "design-&-creative": "Design",
  "education": "Education",
  "other": "Other",
}

// Transform Composio toolkit to our Connection type
export function transformToolkitToConnection(
  toolkit: ComposioToolkit
): Connection {
  const category = toolkit.meta.categories[0] || { id: "other", name: "Other" }

  return {
    id: toolkit.slug,
    name: toolkit.name,
    slug: toolkit.slug,
    logo: toolkit.meta.logo,
    description: toolkit.meta.description,
    category: CATEGORY_DISPLAY_NAMES[category.id] || category.name,
    categoryId: category.id,
    authSchemes: toolkit.auth_schemes,
    toolsCount: toolkit.meta.tools_count,
    appUrl: toolkit.meta.app_url,
    connected: false,
  }
}
