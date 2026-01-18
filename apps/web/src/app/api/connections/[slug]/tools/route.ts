import { NextResponse } from "next/server"

const COMPOSIO_API_URL = "https://backend.composio.dev/api/v3/tools"
const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY

export interface ComposioTool {
  slug: string
  name: string
  description: string
  toolkit: {
    slug: string
    name: string
    logo: string
  }
}

export interface ComposioToolsResponse {
  items: ComposioTool[]
  next_cursor: string | null
  total_items: number
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const { searchParams } = new URL(request.url)
  const limit = searchParams.get("limit") || "20"

  if (!COMPOSIO_API_KEY) {
    return NextResponse.json(
      { error: "COMPOSIO_API_KEY is not configured" },
      { status: 500 }
    )
  }

  try {
    const queryParams = new URLSearchParams({
      toolkit_slug: slug,
      limit,
    })

    const response = await fetch(
      `${COMPOSIO_API_URL}?${queryParams.toString()}`,
      {
        headers: {
          "x-api-key": COMPOSIO_API_KEY,
          "Content-Type": "application/json",
        },
        next: {
          revalidate: 3600, // Cache for 1 hour
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Composio Tools API error:", errorText)
      return NextResponse.json(
        { error: "Failed to fetch tools from Composio" },
        { status: response.status }
      )
    }

    const data: ComposioToolsResponse = await response.json()

    const tools = data.items.map((tool) => ({
      slug: tool.slug,
      name: tool.name,
      description: tool.description,
    }))

    return NextResponse.json({
      tools,
      totalItems: data.total_items,
    })
  } catch (error) {
    console.error("Error fetching Composio tools:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
