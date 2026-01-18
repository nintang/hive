"use client"

import { useKeyShortcut } from "@/app/hooks/use-key-shortcut"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Connection } from "@/lib/connections/types"
import { cn } from "@/lib/utils"
import { CircleNotch } from "@phosphor-icons/react"
import Image from "next/image"
import { useCallback, useMemo, useState } from "react"
import { ConnectionPreviewPanel } from "./connection-preview-panel"
import { ConnectionsFooter } from "./connections-footer"

type CommandConnectionsProps = {
  connections: Connection[]
  onConnect: (connection: Connection) => void
  onDisconnect: (connection: Connection) => void
  trigger: React.ReactNode
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  onOpenChange?: (open: boolean) => void
  hasPopover?: boolean
  isLoading?: boolean
  error?: string | null
  hasMore?: boolean
  onLoadMore?: () => Promise<void>
}

type ConnectionItemRowProps = {
  connection: Connection
}

function ConnectionItemRow({ connection }: ConnectionItemRowProps) {
  return (
    <>
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

{connection.connected && (
        <div className="flex flex-shrink-0 items-center gap-2">
          <Badge
            variant="outline"
            className="border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
          >
            Connected
          </Badge>
        </div>
      )}
    </>
  )
}

type CustomCommandDialogProps = React.ComponentProps<typeof Dialog> & {
  title?: string
  description?: string
  className?: string
  onOpenChange?: (open: boolean) => void
}

function CustomCommandDialog({
  title = "Connections",
  description = "Connect your apps and services",
  children,
  className,
  onOpenChange,
  open,
  ...props
}: CustomCommandDialogProps) {
  return (
    <Dialog {...props} onOpenChange={onOpenChange} open={open}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className={cn("overflow-hidden border-none p-0", className)}
      >
        <Command className="[&_[cmdk-group-heading]]:text-muted-foreground border-none **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5 [&_[cmdk-item]_svg]:border-none">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

export function CommandConnections({
  connections,
  onConnect,
  onDisconnect,
  trigger,
  isOpen,
  setIsOpen,
  onOpenChange,
  hasPopover = true,
  isLoading = false,
  error = null,
}: CommandConnectionsProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [hoveredConnection, setHoveredConnection] = useState<Connection | null>(
    null
  )

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    onOpenChange?.(open)

    if (!open) {
      setSearchQuery("")
      setHoveredConnection(null)
    }
  }

  useKeyShortcut(
    (e: KeyboardEvent) => e.key === "j" && (e.metaKey || e.ctrlKey),
    () => handleOpenChange(!isOpen)
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

    // Sort categories alphabetically
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

  const handleConnectionHover = useCallback((connection: Connection | null) => {
    setHoveredConnection(connection)
  }, [])

  const handlePreviewHover = useCallback(() => {
    // No-op: kept for API compatibility with ConnectionPreviewPanel
  }, [])

  // The active preview is the hovered one, or the first connection as default
  const activePreviewConnection =
    hoveredConnection || connections[0] || null

  const renderConnectionItem = useCallback(
    (connection: Connection) => {
      return (
        <CommandItem
          key={connection.id}
          onSelect={() => handleSelect(connection)}
          className={cn(
            "group data-[selected=true]:bg-accent flex w-full items-center justify-between rounded-md py-2"
          )}
          value={`${connection.id}-${connection.name}`}
          onMouseEnter={() => handleConnectionHover(connection)}
        >
          <ConnectionItemRow connection={connection} />
        </CommandItem>
      )
    },
    [handleSelect, handleConnectionHover]
  )

  return (
    <>
      {hasPopover ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent>Connections ⌘+J</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}

      <CustomCommandDialog
        onOpenChange={handleOpenChange}
        open={isOpen}
        title="Connections"
        description="Connect your apps and services"
        className="sm:max-w-[900px]"
      >
        <CommandInput
          placeholder="Search connections..."
          value={searchQuery}
          onValueChange={(value) => setSearchQuery(value)}
        />

        <div className="grid grid-cols-5">
          <div className="col-span-2">
            <CommandList
              className={cn(
                "max-h-[480px] min-h-[480px] flex-1 [&>[cmdk-list-sizer]]:space-y-6 [&>[cmdk-list-sizer]]:py-2"
              )}
            >
              {isLoading && connections.length === 0 ? (
                <div className="flex h-[400px] items-center justify-center">
                  <CircleNotch className="text-muted-foreground size-6 animate-spin" />
                </div>
              ) : error ? (
                <div className="flex h-[400px] flex-col items-center justify-center gap-2">
                  <p className="text-muted-foreground text-sm">
                    Failed to load connections
                  </p>
                  <p className="text-muted-foreground text-xs">{error}</p>
                </div>
              ) : filteredConnections.length === 0 ? (
                <CommandEmpty>No connections found.</CommandEmpty>
              ) : (
                <>
                  {connectedConnections.length > 0 && (
                    <CommandGroup
                      heading={
                        <div className="flex items-center gap-2 font-semibold">
                          <span className="size-2 rounded-full bg-green-500" />
                          Connected ({connectedConnections.length})
                        </div>
                      }
                    >
                      {connectedConnections.map((conn) =>
                        renderConnectionItem(conn)
                      )}
                    </CommandGroup>
                  )}

                  {groupedConnections.map((group) => (
                    <CommandGroup
                      key={group.category}
                      heading={group.name}
                      className="space-y-0 px-1.5"
                    >
                      {group.connections.map((conn) =>
                        renderConnectionItem(conn)
                      )}
                    </CommandGroup>
                  ))}
                </>
              )}
            </CommandList>
          </div>

          <ConnectionPreviewPanel
            connection={activePreviewConnection}
            onHover={handlePreviewHover}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
          />
        </div>

        <ConnectionsFooter />
      </CustomCommandDialog>
    </>
  )
}
