"use client"

import { useCallback, useEffect, useState } from "react"
import type { Connection } from "./types"

const CONNECTED_IDS_STORAGE_KEY = "hivechat:connected-connection-ids"

function getStoredConnectedIds(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const stored = localStorage.getItem(CONNECTED_IDS_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        return new Set(parsed)
      }
    }
  } catch {
    // Ignore parsing errors
  }
  return new Set()
}

function saveConnectedIds(ids: Set<string>): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(CONNECTED_IDS_STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    // Ignore storage errors
  }
}

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
        const storedConnectedIds = getStoredConnectedIds()

        // Apply stored connected status to fetched connections
        const connectionsWithStoredStatus = data.connections.map((c) => ({
          ...c,
          connected: storedConnectedIds.has(c.id),
        }))

        setConnections((prev) => {
          if (append) {
            // Merge and dedupe by id
            const existingIds = new Set(prev.map((c) => c.id))
            const newConnections = connectionsWithStoredStatus.filter(
              (c) => !existingIds.has(c.id)
            )
            return [...prev, ...newConnections]
          }
          return connectionsWithStoredStatus
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
    setConnections((prev) => {
      const updated = prev.map((c) =>
        c.id === connection.id ? { ...c, connected: !c.connected } : c
      )
      // Save the new connected IDs to localStorage
      const connectedIds = new Set(
        updated.filter((c) => c.connected).map((c) => c.id)
      )
      saveConnectedIds(connectedIds)
      return updated
    })
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
