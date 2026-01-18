import {
  type ComposioToolkitsResponse,
  transformToolkitToConnection,
} from "@/lib/connections/types"
import { NextResponse } from "next/server"

const COMPOSIO_API_URL = "https://backend.composio.dev/api/v3/toolkits"
const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") || ""
  const cursor = searchParams.get("cursor") || ""
  const limit = searchParams.get("limit") || "50"

  if (!COMPOSIO_API_KEY) {
    return NextResponse.json(
      { error: "COMPOSIO_API_KEY is not configured" },
      { status: 500 }
    )
  }

  try {
    const params = new URLSearchParams({
      limit,
      sort_by: "usage",
    })

    if (cursor) {
      params.set("cursor", cursor)
    }

    const response = await fetch(`${COMPOSIO_API_URL}?${params.toString()}`, {
      headers: {
        "x-api-key": COMPOSIO_API_KEY,
        "Content-Type": "application/json",
      },
      next: {
        revalidate: 3600, // Cache for 1 hour
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Composio API error:", errorText)
      return NextResponse.json(
        { error: "Failed to fetch toolkits from Composio" },
        { status: response.status }
      )
    }

    const data: ComposioToolkitsResponse = await response.json()

    // Transform and filter toolkits
    let connections = data.items
      .filter((toolkit) => toolkit.status === "active")
      .map(transformToolkitToConnection)

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase()
      connections = connections.filter(
        (conn) =>
          conn.name.toLowerCase().includes(searchLower) ||
          conn.description.toLowerCase().includes(searchLower) ||
          conn.category.toLowerCase().includes(searchLower)
      )
    }

    return NextResponse.json({
      connections,
      nextCursor: data.next_cursor,
      totalItems: data.total_items,
      currentPage: data.current_page,
      totalPages: data.total_pages,
    })
  } catch (error) {
    console.error("Error fetching Composio toolkits:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
