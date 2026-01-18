"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Connection, ConnectionTool } from "@/lib/connections/types"
import {
  ArrowSquareOut,
  CaretDown,
  CaretUp,
  CircleNotch,
  Key,
} from "@phosphor-icons/react"
import Image from "next/image"
import { useCallback, useEffect, useState } from "react"

type ConnectionPreviewPanelProps = {
  connection: Connection | null
  onHover?: (isHovering: boolean) => void
  onConnect?: (connection: Connection) => void
  onDisconnect?: (connection: Connection) => void
}

function DefaultState() {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="text-muted-foreground space-y-2 text-center">
        <p className="text-sm opacity-60">Hover over a connection to preview</p>
      </div>
    </div>
  )
}

function AuthBadge({ scheme }: { scheme: string }) {
  const labels: Record<string, string> = {
    OAUTH2: "OAuth 2.0",
    API_KEY: "API Key",
    BASIC: "Basic Auth",
    NO_AUTH: "No Auth Required",
    JWT: "JWT",
  }

  return (
    <Badge variant="secondary" className="text-xs">
      <Key className="mr-1 size-3" />
      {labels[scheme] || scheme}
    </Badge>
  )
}

function ToolItem({ tool }: { tool: ConnectionTool }) {
  return (
    <div className="bg-muted/30 hover:bg-muted/50 min-w-0 rounded-lg p-3 transition-colors">
      <p className="truncate text-sm font-medium">{tool.name}</p>
      <p className="text-muted-foreground mt-0.5 line-clamp-2 break-words text-xs">
        {tool.description}
      </p>
    </div>
  )
}

export function ConnectionPreviewPanel({
  connection,
  onHover,
  onConnect,
  onDisconnect,
}: ConnectionPreviewPanelProps) {
  const [tools, setTools] = useState<ConnectionTool[]>([])
  const [isLoadingTools, setIsLoadingTools] = useState(false)
  const [toolsError, setToolsError] = useState<string | null>(null)
  const [lastFetchedSlug, setLastFetchedSlug] = useState<string | null>(null)
  const [isToolsExpanded, setIsToolsExpanded] = useState(false)

  const fetchTools = useCallback(async (slug: string) => {
    setIsLoadingTools(true)
    setToolsError(null)

    try {
      const response = await fetch(`/api/connections/${slug}/tools?limit=50`)
      if (!response.ok) {
        throw new Error("Failed to fetch tools")
      }
      const data = await response.json()
      setTools(data.tools)
    } catch (err) {
      setToolsError(err instanceof Error ? err.message : "Unknown error")
      setTools([])
    } finally {
      setIsLoadingTools(false)
    }
  }, [])

  useEffect(() => {
    if (connection && connection.slug !== lastFetchedSlug) {
      setLastFetchedSlug(connection.slug)
      setIsToolsExpanded(false) // Reset expansion when connection changes
      fetchTools(connection.slug)
    }
  }, [connection, lastFetchedSlug, fetchTools])

  // Reset when connection changes to null
  useEffect(() => {
    if (!connection) {
      setTools([])
      setLastFetchedSlug(null)
      setToolsError(null)
      setIsToolsExpanded(false)
    }
  }, [connection])

  if (!connection) {
    return (
      <div
        className="bg-background col-span-3 border-l"
        onMouseEnter={() => onHover?.(true)}
        onMouseLeave={() => onHover?.(false)}
      >
        <div className="h-[480px]">
          <DefaultState />
        </div>
      </div>
    )
  }

  return (
    <div
      className="bg-background col-span-3 border-l"
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      <ScrollArea className="h-[480px]">
        <div className="flex min-w-0 flex-col gap-4 overflow-hidden p-5">
          {/* Header with logo, name, and action buttons */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="relative size-12 flex-shrink-0 overflow-hidden rounded-xl border bg-white p-1.5">
                <Image
                  src={connection.logo}
                  alt={connection.name}
                  fill
                  className="object-contain p-0.5"
                  unoptimized
                />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold">{connection.name}</h3>
                <Badge variant="outline" className="w-fit text-xs">
                  {connection.category}
                </Badge>
              </div>
            </div>

            {/* Action buttons - always visible */}
            <div className="flex items-center gap-2">
              {connection.appUrl && (
                <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
                  <a
                    href={connection.appUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ArrowSquareOut className="mr-1 size-3" />
                    Visit
                  </a>
                </Button>
              )}
              {connection.connected ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDisconnect?.(connection)}
                >
                  Disconnect
                </Button>
              ) : (
                <Button size="sm" onClick={() => onConnect?.(connection)}>
                  Connect
                </Button>
              )}
            </div>
          </div>

          {/* Description */}
          <p className="text-muted-foreground text-sm leading-relaxed">
            {connection.description}
          </p>

          {/* Auth methods */}
          <div>
            <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
              Authentication
            </p>
            <div className="flex flex-wrap gap-1.5">
              {connection.authSchemes.map((scheme) => (
                <AuthBadge key={scheme} scheme={scheme} />
              ))}
            </div>
          </div>

          {/* Tools section - Collapsible */}
          <Collapsible open={isToolsExpanded} onOpenChange={setIsToolsExpanded}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="hover:bg-muted/50 flex w-full items-center justify-between rounded-lg p-2 transition-colors"
              >
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Available Tools ({connection.toolsCount})
                </p>
                {isToolsExpanded ? (
                  <CaretUp className="text-muted-foreground size-4" />
                ) : (
                  <CaretDown className="text-muted-foreground size-4" />
                )}
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="min-w-0 overflow-hidden pt-2">
                {isLoadingTools ? (
                  <div className="flex items-center justify-center py-6">
                    <CircleNotch className="text-muted-foreground size-5 animate-spin" />
                  </div>
                ) : toolsError ? (
                  <p className="text-muted-foreground text-xs">{toolsError}</p>
                ) : tools.length > 0 ? (
                  <div className="flex min-w-0 flex-col gap-2">
                    {tools.map((tool) => (
                      <ToolItem key={tool.slug} tool={tool} />
                    ))}
                    {connection.toolsCount > tools.length && (
                      <p className="text-muted-foreground text-center text-xs">
                        +{connection.toolsCount - tools.length} more tools
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    No tools available
                  </p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  )
}
