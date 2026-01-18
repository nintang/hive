"use client"

import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import { useConnections } from "@/lib/connections/use-connections"
import { cn } from "@/lib/utils"
import { PlugsConnected } from "@phosphor-icons/react"
import { useState } from "react"
import { CommandConnections } from "./command-connections"
import { DrawerConnections } from "./drawer-connections"

type ConnectionsTriggerProps = {
  hasSidebar: boolean
  classNameTrigger?: string
  icon?: React.ReactNode
  label?: React.ReactNode | string
  hasPopover?: boolean
}

export function ConnectionsTrigger({
  hasSidebar,
  classNameTrigger,
  icon,
  label,
  hasPopover = true,
}: ConnectionsTriggerProps) {
  const isMobile = useBreakpoint(768)
  const [isOpen, setIsOpen] = useState(false)
  const { connections, isLoading, error, toggleConnection, hasMore, loadMore } =
    useConnections()

  const handleConnect = toggleConnection
  const handleDisconnect = toggleConnection

  const defaultTrigger = (
    <button
      className={cn(
        "text-muted-foreground hover:text-foreground hover:bg-muted bg-background pointer-events-auto rounded-full p-1.5 transition-colors",
        hasSidebar ? "hidden" : "block",
        classNameTrigger
      )}
      type="button"
      onClick={() => setIsOpen(true)}
      aria-label="Connections"
      tabIndex={isMobile ? -1 : 0}
    >
      {icon || <PlugsConnected size={24} />}
      {label}
    </button>
  )

  if (isMobile) {
    return (
      <DrawerConnections
        connections={connections}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        trigger={defaultTrigger}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        isLoading={isLoading}
        error={error}
        hasMore={hasMore}
        onLoadMore={loadMore}
      />
    )
  }

  return (
    <CommandConnections
      connections={connections}
      onConnect={handleConnect}
      onDisconnect={handleDisconnect}
      trigger={defaultTrigger}
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      onOpenChange={setIsOpen}
      hasPopover={hasPopover}
      isLoading={isLoading}
      error={error}
      hasMore={hasMore}
      onLoadMore={loadMore}
    />
  )
}
