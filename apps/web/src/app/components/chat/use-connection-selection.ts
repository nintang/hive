import { useState, useCallback } from "react"

export function useConnectionSelection() {
  // Single-select mode state
  const [selectedConnectionId, setSelectedConnectionIdState] = useState<
    string | undefined
  >(undefined)

  // Multi-select mode state
  const [selectedConnectionIds, setSelectedConnectionIdsState] = useState<
    string[]
  >([])

  const setSelectedConnectionId = useCallback(
    (connectionId: string | undefined) => {
      setSelectedConnectionIdState(connectionId)
    },
    []
  )

  const setSelectedConnectionIds = useCallback((connectionIds: string[]) => {
    setSelectedConnectionIdsState(connectionIds)
  }, [])

  return {
    selectedConnectionId,
    setSelectedConnectionId,
    selectedConnectionIds,
    setSelectedConnectionIds,
  }
}
