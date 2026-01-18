"use client"

import { PopoverContentAuth } from "@/app/components/chat-input/popover-content-auth"
import { CommandConnections } from "@/app/components/connections/command-connections"
import { DrawerConnections } from "@/app/components/connections/drawer-connections"
import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import { useKeyShortcut } from "@/app/hooks/use-key-shortcut"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Popover, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Connection } from "@/lib/connections/types"
import { useConnections } from "@/lib/connections/use-connections"
import { cn } from "@/lib/utils"
import {
  CaretDownIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  PlugsConnectedIcon,
} from "@phosphor-icons/react"
import { AnimatePresence, motion } from "motion/react"
import Image from "next/image"
import { useMemo, useRef, useState } from "react"
import { ConnectionSubMenu } from "./sub-menu"

type ConnectionSelectorProps = {
  // Single-select mode
  selectedConnectionId?: string
  setSelectedConnectionId?: (connectionId: string | undefined) => void
  // Multi-select mode
  selectedConnectionIds?: string[]
  setSelectedConnectionIds?: (connectionIds: string[]) => void
  // Common props
  multiSelect?: boolean
  maxConnections?: number
  className?: string
  isUserAuthenticated?: boolean
}

export function ConnectionSelector({
  selectedConnectionId,
  setSelectedConnectionId,
  selectedConnectionIds = [],
  setSelectedConnectionIds,
  multiSelect = false,
  maxConnections = 5,
  className,
  isUserAuthenticated = true,
}: ConnectionSelectorProps) {
  const {
    connections,
    isLoading,
    error,
    toggleConnection,
    hasMore,
    loadMore,
  } = useConnections()
  const isMobile = useBreakpoint(768)

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isAddConnectionsOpen, setIsAddConnectionsOpen] = useState(false)
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(
    null
  )
  const [searchQuery, setSearchQuery] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Only show connected connections
  const connectedConnections = useMemo(() => {
    return connections.filter((c) => c.connected)
  }, [connections])

  // Filter connected connections by search query
  const filteredConnections = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return connectedConnections

    return connectedConnections.filter(
      (conn) =>
        conn.name.toLowerCase().includes(query) ||
        conn.description.toLowerCase().includes(query) ||
        conn.category.toLowerCase().includes(query)
    )
  }, [connectedConnections, searchQuery])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    setSearchQuery(e.target.value)
  }

  // Get the hovered connection data
  const hoveredConnection = useMemo(() => {
    if (!hoveredConnectionId) return null
    return (
      connectedConnections.find((c) => c.id === hoveredConnectionId) || null
    )
  }, [connectedConnections, hoveredConnectionId])

  // Get selected connections based on mode (from the connected ones)
  const selectedConnections = useMemo(() => {
    if (multiSelect) {
      return connectedConnections.filter((c) =>
        selectedConnectionIds.includes(c.id)
      )
    }
    return selectedConnectionId
      ? connectedConnections.filter((c) => c.id === selectedConnectionId)
      : []
  }, [
    connectedConnections,
    multiSelect,
    selectedConnectionId,
    selectedConnectionIds,
  ])

  // Keyboard shortcut: Cmd+Shift+K for connections
  useKeyShortcut(
    (e) => (e.key === "k" || e.key === "K") && e.metaKey && e.shiftKey,
    () => {
      if (isMobile) {
        setIsDrawerOpen((prev) => !prev)
      } else {
        setIsDropdownOpen((prev) => !prev)
      }
    }
  )

  const handleConnectionToggle = (connectionId: string) => {
    if (multiSelect && setSelectedConnectionIds) {
      const isSelected = selectedConnectionIds.includes(connectionId)

      if (isSelected) {
        setSelectedConnectionIds(
          selectedConnectionIds.filter((id) => id !== connectionId)
        )
      } else {
        if (selectedConnectionIds.length < maxConnections) {
          setSelectedConnectionIds([...selectedConnectionIds, connectionId])
        }
      }
    } else if (setSelectedConnectionId) {
      // Single select: toggle off if already selected, otherwise select
      if (selectedConnectionId === connectionId) {
        setSelectedConnectionId(undefined)
      } else {
        setSelectedConnectionId(connectionId)
      }
      // Close dropdown/drawer after selection in single-select mode
      if (isMobile) {
        setIsDrawerOpen(false)
      } else {
        setIsDropdownOpen(false)
      }
    }
  }

  const handleOpenAddConnections = () => {
    setIsDropdownOpen(false)
    setIsDrawerOpen(false)
    setIsAddConnectionsOpen(true)
  }

  // Render trigger button
  const trigger = (
    <Button
      variant="outline"
      className={cn(
        "dark:bg-secondary justify-between rounded-full",
        className
      )}
      disabled={isLoading}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <AnimatePresence mode="popLayout">
          {selectedConnections.length === 0 ? (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="flex items-center gap-2"
            >
              <PlugsConnectedIcon className="size-5" />
              <span className="text-muted-foreground hidden sm:inline">
                Connections
              </span>
            </motion.div>
          ) : selectedConnections.length === 1 ? (
            <motion.div
              key="single-connection"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="flex items-center gap-2"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                }}
                className="relative size-5 flex-shrink-0 overflow-hidden rounded"
              >
                <Image
                  src={selectedConnections[0].logo}
                  alt={selectedConnections[0].name}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </motion.div>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="hidden truncate sm:inline"
              >
                {selectedConnections[0].name}
              </motion.span>
            </motion.div>
          ) : (
            <motion.div
              key="multiple-connections"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="flex min-w-0 flex-1 items-center gap-1"
            >
              <div className="flex flex-shrink-0 -space-x-1">
                <AnimatePresence mode="popLayout">
                  {selectedConnections.slice(0, 3).map((conn, index) => (
                    <motion.div
                      key={conn.id}
                      layout="position"
                      layoutId={conn.id}
                      initial={{
                        scale: 0,
                        rotate: -180,
                        x: -20,
                        opacity: 0,
                      }}
                      animate={{
                        scale: 1,
                        rotate: 0,
                        x: 0,
                        opacity: 1,
                      }}
                      exit={{
                        scale: 0,
                        rotate: 180,
                        x: 20,
                        opacity: 0,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 25,
                        delay: index * 0.05,
                      }}
                      className="bg-background border-border relative flex size-5 items-center justify-center overflow-hidden rounded-full border"
                      style={{ zIndex: 3 - index }}
                    >
                      <Image
                        src={conn.logo}
                        alt={conn.name}
                        fill
                        className="object-contain p-0.5"
                        unoptimized
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              <span className="hidden text-sm font-medium sm:inline">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={selectedConnections.length}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{
                      duration: 0.15,
                      ease: "easeOut",
                    }}
                    className="inline-block"
                  >
                    {selectedConnections.length}
                  </motion.span>
                </AnimatePresence>{" "}
                tools
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <CaretDownIcon className="ml-1 size-4 flex-shrink-0 opacity-50" />
    </Button>
  )

  // Render the "Add Connections" modal/drawer
  const addConnectionsModal = isMobile ? (
    <DrawerConnections
      connections={connections}
      onConnect={toggleConnection}
      onDisconnect={toggleConnection}
      trigger={<span />}
      isOpen={isAddConnectionsOpen}
      setIsOpen={setIsAddConnectionsOpen}
      isLoading={isLoading}
      error={error}
      hasMore={hasMore}
      onLoadMore={loadMore}
    />
  ) : (
    <CommandConnections
      connections={connections}
      onConnect={toggleConnection}
      onDisconnect={toggleConnection}
      trigger={<span />}
      isOpen={isAddConnectionsOpen}
      setIsOpen={setIsAddConnectionsOpen}
      onOpenChange={setIsAddConnectionsOpen}
      hasPopover={false}
      isLoading={isLoading}
      error={error}
      hasMore={hasMore}
      onLoadMore={loadMore}
    />
  )

  // If user is not authenticated, show the auth popover
  if (!isUserAuthenticated) {
    return (
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="secondary"
                className={cn(
                  "border-border dark:bg-secondary text-accent-foreground h-9 w-auto border bg-transparent",
                  className
                )}
                type="button"
              >
                <PlugsConnectedIcon className="size-5" />
                <span className="hidden sm:inline">Tools</span>
                <CaretDownIcon className="size-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Select tools</TooltipContent>
        </Tooltip>
        <PopoverContentAuth />
      </Popover>
    )
  }

  // Mobile: Use Drawer
  if (isMobile) {
    return (
      <>
        {addConnectionsModal}
        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerTrigger asChild>{trigger}</DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>
                {multiSelect
                  ? `Select Tools (${selectedConnectionIds.length}/${maxConnections})`
                  : "Select Tool"}
              </DrawerTitle>
            </DrawerHeader>
            <ScrollArea className="h-[50vh] px-4 pb-6">
              {isLoading ? (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                  <p className="text-muted-foreground mb-2 text-sm">
                    Loading...
                  </p>
                </div>
              ) : connectedConnections.length > 0 ? (
                <div className="space-y-1">
                  {connectedConnections.map((conn) => {
                    const isSelected = multiSelect
                      ? selectedConnectionIds.includes(conn.id)
                      : selectedConnectionId === conn.id
                    const isAtLimit =
                      multiSelect &&
                      selectedConnectionIds.length >= maxConnections

                    return (
                      <div
                        key={conn.id}
                        className={cn(
                          "hover:bg-accent/50 flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5",
                          isSelected && "bg-accent"
                        )}
                        onClick={() => handleConnectionToggle(conn.id)}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="relative size-6 flex-shrink-0 overflow-hidden rounded">
                            <Image
                              src={conn.logo}
                              alt={conn.name}
                              fill
                              className="object-contain"
                              unoptimized
                            />
                          </div>
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-medium">
                              {conn.name}
                            </span>
                            <span className="text-muted-foreground truncate text-xs">
                              {conn.toolsCount} tools
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          {isSelected && <CheckIcon className="size-4" />}
                          {multiSelect && !isSelected && isAtLimit && (
                            <div className="border-input bg-muted text-muted-foreground flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium">
                              <span>Limit</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex h-32 flex-col items-center justify-center p-6 text-center">
                  <p className="text-muted-foreground mb-3 text-sm">
                    No tools connected yet.
                  </p>
                </div>
              )}
            </ScrollArea>
            <div className="border-t p-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleOpenAddConnections}
              >
                <PlusIcon className="mr-2 size-4" />
                Add Connections
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  // Desktop: Use DropdownMenu
  return (
    <>
      {addConnectionsModal}
      <Tooltip>
        <DropdownMenu
          open={isDropdownOpen}
          onOpenChange={(open) => {
            setIsDropdownOpen(open)
            if (!open) {
              setHoveredConnectionId(null)
              setSearchQuery("")
            }
          }}
        >
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {multiSelect
              ? `Select tools ⌘⇧K (${selectedConnectionIds.length}/${maxConnections})`
              : "Select tool ⌘⇧K"}
          </TooltipContent>
          <DropdownMenuContent
            className="flex h-[320px] w-[280px] flex-col overflow-visible p-0"
            align="start"
            sideOffset={4}
            side="top"
            forceMount
          >
            <div className="bg-background sticky top-0 z-10 rounded-t-md border-b">
              <div className="relative">
                <MagnifyingGlassIcon className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search connections..."
                  className="dark:bg-popover rounded-b-none border-none pl-8 shadow-none focus-visible:ring-0"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-1">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center p-6 text-center">
                    <p className="text-muted-foreground mb-2 text-sm">
                      Loading...
                    </p>
                  </div>
                ) : filteredConnections.length > 0 ? (
                  <div className="space-y-0.5">
                    {filteredConnections.map((conn) => {
                      const isSelected = multiSelect
                        ? selectedConnectionIds.includes(conn.id)
                        : selectedConnectionId === conn.id

                      return (
                        <DropdownMenuItem
                          key={conn.id}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 px-3 py-2",
                            isSelected && "bg-accent"
                          )}
                          onSelect={(e) => {
                            if (multiSelect) {
                              e.preventDefault()
                            }
                            handleConnectionToggle(conn.id)
                          }}
                          onFocus={() => {
                            if (isDropdownOpen) {
                              setHoveredConnectionId(conn.id)
                            }
                          }}
                          onMouseEnter={() => {
                            if (isDropdownOpen) {
                              setHoveredConnectionId(conn.id)
                            }
                          }}
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="relative size-5 flex-shrink-0 overflow-hidden rounded">
                              <Image
                                src={conn.logo}
                                alt={conn.name}
                                fill
                                className="object-contain"
                                unoptimized
                              />
                            </div>
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate text-sm">
                                {conn.name}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-2">
                            {isSelected && <CheckIcon className="size-4" />}
                            {multiSelect &&
                              !isSelected &&
                              selectedConnectionIds.length >=
                                maxConnections && (
                                <div className="border-input bg-muted text-muted-foreground flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium">
                                  <span>Limit</span>
                                </div>
                              )}
                          </div>
                        </DropdownMenuItem>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 text-center">
                    <p className="text-muted-foreground mb-1 text-sm">
                      {searchQuery
                        ? "No matching connections."
                        : "No tools connected."}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
            <DropdownMenuSeparator className="my-0" />
            <div className="p-1">
              <DropdownMenuItem
                className="flex items-center gap-2 px-3 py-2"
                onSelect={handleOpenAddConnections}
                onMouseEnter={() => setHoveredConnectionId(null)}
              >
                <PlusIcon className="size-4" />
                <span>Add Connections</span>
              </DropdownMenuItem>
            </div>

            {/* Submenu positioned absolutely */}
            {hoveredConnection && (
              <div className="absolute top-0 left-[calc(100%+8px)]">
                <ConnectionSubMenu connection={hoveredConnection} />
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </Tooltip>
    </>
  )
}
