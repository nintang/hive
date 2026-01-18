"use client"

import { Badge } from "@/components/ui/badge"
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Connection } from "@/lib/connections/types"
import { CircleNotch, MagnifyingGlass } from "@phosphor-icons/react"
import Image from "next/image"
import { useCallback, useMemo, useState } from "react"

type DrawerConnectionsProps = {
  connections: Connection[]
  onConnect: (connection: Connection) => void
  onDisconnect: (connection: Connection) => void
  trigger: React.ReactNode
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  isLoading?: boolean
  error?: string | null
  hasMore?: boolean
  onLoadMore?: () => Promise<void>
}

export function DrawerConnections({
  connections,
  onConnect,
  onDisconnect,
  trigger,
  isOpen,
  setIsOpen,
  isLoading = false,
  error = null,
}: DrawerConnectionsProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open)
      if (!open) {
        setSearchQuery("")
      }
    },
    [setIsOpen]
  )

  const filteredConnections = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return query
      ? connections.filter(
          (conn) =>
            conn.name.toLowerCase().includes(query) ||
            conn.description.toLowerCase().includes(query) ||
            conn.category.toLowerCase().includes(query)
        )
      : connections
  }, [connections, searchQuery])

  const connectedConnections = useMemo(
    () => filteredConnections.filter((c) => c.connected),
    [filteredConnections]
  )

  const groupedConnections = useMemo(() => {
    const available = filteredConnections.filter((c) => !c.connected)
    const grouped: Record<string, Connection[]> = {}

    available.forEach((conn) => {
      const category = conn.category || "Other"
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(conn)
    })

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, conns]) => ({
        category,
        name: category,
        connections: conns,
      }))
  }, [filteredConnections])

  const handleSelect = useCallback(
    (connection: Connection) => {
      if (connection.connected) {
        onDisconnect(connection)
      } else {
        onConnect(connection)
      }
    },
    [onConnect, onDisconnect]
  )

  const renderConnectionItem = useCallback(
    (connection: Connection) => (
      <div
        key={connection.id}
        className="active:bg-accent flex items-center justify-between rounded-lg px-2 py-2.5"
        onClick={() => handleSelect(connection)}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative size-8 flex-shrink-0 overflow-hidden rounded-md">
            <Image
              src={connection.logo}
              alt={connection.name}
              fill
              className="object-contain"
              unoptimized
            />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="line-clamp-1 text-sm font-medium">
                {connection.name}
              </span>
              <span className="text-muted-foreground text-xs">
                {connection.toolsCount} tools
              </span>
            </div>
            <span className="text-muted-foreground line-clamp-1 text-xs">
              {connection.description}
            </span>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {connection.connected ? (
            <Badge
              variant="outline"
              className="border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
            >
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Connect
            </Badge>
          )}
        </div>
      </div>
    ),
    [handleSelect]
  )

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        </TooltipTrigger>
        <TooltipContent>Connections</TooltipContent>
      </Tooltip>
      <DrawerContent>
        <div className="flex h-dvh max-h-[80vh] flex-col">
          <div className="border-b p-4 pb-3">
            <div className="relative">
              <Input
                placeholder="Search connections..."
                className="rounded-lg py-1.5 pl-8 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <MagnifyingGlass className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 transform text-gray-400" />
            </div>
          </div>

          <ScrollArea className="flex-1 overflow-auto">
            <div className="flex flex-col space-y-6 px-4 pb-8 pt-4">
              {isLoading && connections.length === 0 ? (
                <div className="flex h-[200px] items-center justify-center">
                  <CircleNotch className="text-muted-foreground size-6 animate-spin" />
                </div>
              ) : error ? (
                <div className="flex h-[200px] flex-col items-center justify-center gap-2">
                  <p className="text-muted-foreground text-sm">
                    Failed to load connections
                  </p>
                  <p className="text-muted-foreground text-xs">{error}</p>
                </div>
              ) : filteredConnections.length === 0 ? (
                <div className="text-muted-foreground py-4 text-center text-sm">
                  No connections found.
                </div>
              ) : searchQuery ? (
                <div className="space-y-2">
                  {filteredConnections.map((conn) => renderConnectionItem(conn))}
                </div>
              ) : (
                <>
                  {connectedConnections.length > 0 && (
                    <div className="space-y-0.5">
                      <h3 className="text-muted-foreground flex items-center gap-2 pl-2 text-sm font-medium">
                        <span className="size-2 rounded-full bg-green-500" />
                        Connected ({connectedConnections.length})
                      </h3>
                      <div className="space-y-2">
                        {connectedConnections.map((conn) =>
                          renderConnectionItem(conn)
                        )}
                      </div>
                    </div>
                  )}
                  {groupedConnections.map((group) => (
                    <div key={group.category} className="space-y-0.5">
                      <h3 className="text-muted-foreground pl-2 text-sm font-medium">
                        {group.name}
                      </h3>
                      <div className="space-y-2">
                        {group.connections.map((conn) =>
                          renderConnectionItem(conn)
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
