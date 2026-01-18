"use client"

import { useCallback, useEffect, useState } from "react"

export interface ConnectedAccount {
  id: string
  toolkitSlug: string
  toolkitName: string
  toolkitLogo: string | null
  status: string
  createdAt: string
}

interface UseConnectedAccountsResult {
  connectedAccounts: ConnectedAccount[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  initiateConnection: (toolkitSlug: string) => Promise<string | null>
  disconnectAccount: (connectionId: string) => Promise<boolean>
  isConnecting: string | null
  isConnected: (toolkitSlug: string) => boolean
  getConnectionId: (toolkitSlug: string) => string | undefined
}

export function useConnectedAccounts(): UseConnectedAccountsResult {
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState<string | null>(null)

  const fetchAccounts = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch("/api/connections/connected")
      if (!response.ok) {
        if (response.status === 401) {
          // User not authenticated, that's fine
          setConnectedAccounts([])
          return
        }
        throw new Error("Failed to fetch connected accounts")
      }

      const data = await response.json()
      setConnectedAccounts(data.accounts)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const initiateConnection = useCallback(
    async (toolkitSlug: string): Promise<string | null> => {
      try {
        setIsConnecting(toolkitSlug)
        setError(null)

        const response = await fetch(`/api/connections/${toolkitSlug}/connect`, {
          method: "POST",
        })

        if (!response.ok) {
          throw new Error("Failed to initiate connection")
        }

        const data = await response.json()

        // Handle no-auth toolkits that connect directly without OAuth
        if (data.connected) {
          // Connection was created directly, refresh the list
          await fetchAccounts()
          return null // No redirect needed
        }

        return data.redirectUrl
      } catch (err) {
        setError(err instanceof Error ? err.message : "Connection failed")
        return null
      } finally {
        setIsConnecting(null)
      }
    },
    [fetchAccounts]
  )

  const disconnectAccount = useCallback(
    async (toolkitSlug: string): Promise<boolean> => {
      try {
        setError(null)

        const response = await fetch(
          `/api/connections/${toolkitSlug}/disconnect`,
          {
            method: "DELETE",
          }
        )

        if (!response.ok) {
          throw new Error("Failed to disconnect account")
        }

        // Remove from local state
        setConnectedAccounts((prev) =>
          prev.filter((acc) => acc.toolkitSlug !== toolkitSlug)
        )

        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : "Disconnect failed")
        return false
      }
    },
    []
  )

  const isConnected = useCallback(
    (toolkitSlug: string): boolean => {
      return connectedAccounts.some(
        (acc) => acc.toolkitSlug === toolkitSlug && acc.status === "ACTIVE"
      )
    },
    [connectedAccounts]
  )

  const getConnectionId = useCallback(
    (toolkitSlug: string): string | undefined => {
      const account = connectedAccounts.find(
        (acc) => acc.toolkitSlug === toolkitSlug && acc.status === "ACTIVE"
      )
      return account?.id
    },
    [connectedAccounts]
  )

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  return {
    connectedAccounts,
    isLoading,
    error,
    refetch: fetchAccounts,
    initiateConnection,
    disconnectAccount,
    isConnecting,
    isConnected,
    getConnectionId,
  }
}
