import { useState, useCallback, useEffect } from "react"

interface UseConnectionSelectionProps {
  initialConnectionIds?: string[]
  onConnectionIdsChange?: (connectionIds: string[]) => void
}

export function useConnectionSelection(props?: UseConnectionSelectionProps) {
  const { initialConnectionIds, onConnectionIdsChange } = props || {}

  // Single-select mode state
  const [selectedConnectionId, setSelectedConnectionIdState] = useState<
    string | undefined
  >(initialConnectionIds?.[0])

  // Multi-select mode state
  const [selectedConnectionIds, setSelectedConnectionIdsState] = useState<
    string[]
  >(initialConnectionIds || [])

  // Initialize from props when they change (e.g., preferences loaded)
  useEffect(() => {
    if (initialConnectionIds && initialConnectionIds.length > 0) {
      setSelectedConnectionIdsState(initialConnectionIds)
      setSelectedConnectionIdState(initialConnectionIds[0])
    }
  }, [initialConnectionIds])

  // When single-select changes, also update the array so both are in sync
  const setSelectedConnectionId = useCallback(
    (connectionId: string | undefined) => {
      setSelectedConnectionIdState(connectionId)
      // Sync to the array so the API receives the connection ID
      const newIds = connectionId ? [connectionId] : []
      setSelectedConnectionIdsState(newIds)
      // Persist to preferences
      onConnectionIdsChange?.(newIds)
    },
    [onConnectionIdsChange]
  )

  const setSelectedConnectionIds = useCallback(
    (connectionIds: string[]) => {
      setSelectedConnectionIdsState(connectionIds)
      // Sync to single-select (use first item or undefined)
      setSelectedConnectionIdState(connectionIds[0])
      // Persist to preferences
      onConnectionIdsChange?.(connectionIds)
    },
    [onConnectionIdsChange]
  )

  return {
    selectedConnectionId,
    setSelectedConnectionId,
    selectedConnectionIds,
    setSelectedConnectionIds,
  }
}
