"use client"

import { useCallback, useEffect, useState } from "react"
import type { Connection } from "./types"
import { useConnectedAccounts } from "./use-connected-accounts"

interface UseConnectionsResult {
  connections: Connection[]
  isLoading: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => Promise<void>
  initiateConnection: (connection: Connection) => Promise<void>
  disconnectConnection: (connection: Connection) => Promise<void>
  refetch: () => Promise<void>
  isConnecting: string | null
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
  const [isLoadingConnections, setIsLoadingConnections] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)

  // Get real connected accounts from the database
  const {
    connectedAccounts,
    isLoading: isLoadingAccounts,
    initiateConnection: initiateOAuth,
    disconnectAccount,
    isConnecting,
    refetch: refetchAccounts,
  } = useConnectedAccounts()

  // Create a set of connected toolkit slugs for quick lookup
  const connectedSlugs = new Set(connectedAccounts.map((a) => a.toolkitSlug))

  const fetchConnections = useCallback(
    async (cursor?: string, append = false) => {
      try {
        setIsLoadingConnections(true)
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
        setIsLoadingConnections(false)
      }
    },
    []
  )

  const loadMore = useCallback(async () => {
    if (nextCursor && !isLoadingConnections) {
      await fetchConnections(nextCursor, true)
    }
  }, [nextCursor, isLoadingConnections, fetchConnections])

  // Initiate OAuth connection for a toolkit
  const initiateConnection = useCallback(
    async (connection: Connection) => {
      const redirectUrl = await initiateOAuth(connection.slug)
      if (redirectUrl) {
        // Redirect to OAuth consent screen
        window.location.href = redirectUrl
      }
    },
    [initiateOAuth]
  )

  // Disconnect a connected account
  const disconnectConnection = useCallback(
    async (connection: Connection) => {
      await disconnectAccount(connection.slug)
    },
    [disconnectAccount]
  )

  const refetch = useCallback(async () => {
    await Promise.all([fetchConnections(), refetchAccounts()])
  }, [fetchConnections, refetchAccounts])

  useEffect(() => {
    fetchConnections()
  }, [fetchConnections])

  // Merge connected status into connections
  const connectionsWithStatus = connections.map((c) => ({
    ...c,
    connected: connectedSlugs.has(c.slug),
  }))

  return {
    connections: connectionsWithStatus,
    isLoading: isLoadingConnections || isLoadingAccounts,
    error,
    hasMore,
    loadMore,
    initiateConnection,
    disconnectConnection,
    refetch,
    isConnecting,
  }
}
