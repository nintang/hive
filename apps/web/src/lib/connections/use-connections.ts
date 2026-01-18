"use client"

import { useCallback, useEffect, useState } from "react"
import type { Connection } from "./types"

interface UseConnectionsResult {
  connections: Connection[]
  isLoading: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => Promise<void>
  toggleConnection: (connection: Connection) => void
  refetch: () => Promise<void>
}

interface ConnectionsResponse {
  connections: Connection[]
  nextCursor: string | null
  totalItems: number
  currentPage: number
  totalPages: number
}

export function useConnections(): UseConnectionsResult {
  const [connections, setConnections] = useState<Connection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)

  const fetchConnections = useCallback(
    async (cursor?: string, append = false) => {
      try {
        setIsLoading(true)
        setError(null)

        const params = new URLSearchParams({ limit: "100" })
        if (cursor) {
          params.set("cursor", cursor)
        }

        const response = await fetch(`/api/connections?${params.toString()}`)

        if (!response.ok) {
          throw new Error("Failed to fetch connections")
        }

        const data: ConnectionsResponse = await response.json()

        setConnections((prev) => {
          if (append) {
            // Merge and dedupe by id
            const existingIds = new Set(prev.map((c) => c.id))
            const newConnections = data.connections.filter(
              (c) => !existingIds.has(c.id)
            )
            return [...prev, ...newConnections]
          }
          return data.connections
        })

        setNextCursor(data.nextCursor)
        setHasMore(!!data.nextCursor)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const loadMore = useCallback(async () => {
    if (nextCursor && !isLoading) {
      await fetchConnections(nextCursor, true)
    }
  }, [nextCursor, isLoading, fetchConnections])

  const toggleConnection = useCallback((connection: Connection) => {
    setConnections((prev) =>
      prev.map((c) =>
        c.id === connection.id ? { ...c, connected: !c.connected } : c
      )
    )
  }, [])

  const refetch = useCallback(async () => {
    await fetchConnections()
  }, [fetchConnections])

  useEffect(() => {
    fetchConnections()
  }, [fetchConnections])

  return {
    connections,
    isLoading,
    error,
    hasMore,
    loadMore,
    toggleConnection,
    refetch,
  }
}
