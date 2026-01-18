"use client"

import { cn } from "@/lib/utils"
import {
  CaretDown,
  CheckCircle,
  Code,
  Link,
  Nut,
  Spinner,
  Warning,
  Wrench,
  CircleNotch,
} from "@phosphor-icons/react"
import { AnimatePresence, motion } from "framer-motion"
import { useMemo, useState } from "react"

// Normalized tool data structure that works with both legacy and v6 formats
interface NormalizedToolData {
  toolCallId: string
  toolName: string
  state: string
  args?: Record<string, unknown>
  result?: unknown
  errorText?: string
}

// AI SDK v6 typed tool part format
interface V6ToolPart {
  type: string // "tool-{toolName}"
  toolCallId: string
  state: string
  input?: Record<string, unknown>
  output?: unknown
  error?: string
}

// Legacy tool-invocation format
interface LegacyToolPart {
  type: "tool-invocation"
  toolInvocation: {
    toolCallId: string
    toolName: string
    state: string
    args?: Record<string, unknown>
    result?: unknown
    errorText?: string
  }
}

type ToolPartInput = V6ToolPart | LegacyToolPart | { type: string; [key: string]: unknown }

// Normalize any tool part format to our standard structure
function normalizeToolPart(part: ToolPartInput): NormalizedToolData | null {
  // Legacy format: { type: "tool-invocation", toolInvocation: { ... } }
  if (part.type === "tool-invocation" && "toolInvocation" in part) {
    const legacy = part as LegacyToolPart
    return {
      toolCallId: legacy.toolInvocation.toolCallId,
      toolName: legacy.toolInvocation.toolName,
      state: legacy.toolInvocation.state,
      args: legacy.toolInvocation.args,
      result: legacy.toolInvocation.result,
      errorText: legacy.toolInvocation.errorText,
    }
  }

  // AI SDK v6 format: { type: "tool-{toolName}", toolCallId, state, input, output }
  if (part.type.startsWith("tool-") && part.type !== "tool-result" && part.type !== "tool-invocation") {
    const v6 = part as V6ToolPart
    return {
      toolCallId: v6.toolCallId || (part as { toolCallId?: string }).toolCallId || "",
      toolName: part.type.replace(/^tool-/, ""),
      state: v6.state || (part as { state?: string }).state || "input-available",
      args: v6.input || (part as { input?: Record<string, unknown> }).input,
      result: v6.output || (part as { output?: unknown }).output,
      errorText: v6.error || (part as { error?: string }).error,
    }
  }

  return null
}

interface ToolInvocationProps {
  toolInvocations: ToolPartInput[]
  className?: string
  defaultOpen?: boolean
}

const TRANSITION = {
  type: "spring" as const,
  duration: 0.2,
  bounce: 0,
}

// AI SDK v6 tool states (modern)
// - "input-streaming": Arguments being streamed in
// - "input-available": Arguments ready, tool executing
// - "output-available": Tool completed with result
// - "output-error": Tool failed with error
// Legacy states (for backwards compatibility)
// - "partial-call": Same as input-streaming
// - "call": Same as input-available
// - "result": Same as output-available
type ToolState =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error"
  | "partial-call"
  | "call"
  | "result"

// Normalize state to modern format
function normalizeState(state: string): ToolState {
  switch (state) {
    case "partial-call":
      return "input-streaming"
    case "call":
      return "input-available"
    case "result":
      return "output-available"
    default:
      return state as ToolState
  }
}

export function ToolInvocation({
  toolInvocations,
  defaultOpen = false,
}: ToolInvocationProps) {
  const [isExpanded, setIsExpanded] = useState(defaultOpen)

  const toolInvocationsData = Array.isArray(toolInvocations)
    ? toolInvocations
    : [toolInvocations]

  // Normalize all tool parts and filter out invalid ones
  const normalizedTools = toolInvocationsData
    .map(normalizeToolPart)
    .filter((t): t is NormalizedToolData => t !== null)

  // Group tool invocations by toolCallId
  const groupedTools = normalizedTools.reduce(
    (acc, item) => {
      const { toolCallId } = item
      if (!acc[toolCallId]) {
        acc[toolCallId] = []
      }
      acc[toolCallId].push(item)
      return acc
    },
    {} as Record<string, NormalizedToolData[]>
  )

  const uniqueToolIds = Object.keys(groupedTools)
  const isSingleTool = uniqueToolIds.length === 1

  if (isSingleTool) {
    return (
      <SingleToolView
        toolInvocations={normalizedTools}
        defaultOpen={defaultOpen}
        className="mb-10"
      />
    )
  }

  return (
    <div className="mb-10">
      <div className="border-border flex flex-col gap-0 overflow-hidden rounded-md border">
        <button
          onClick={(e) => {
            e.preventDefault()
            setIsExpanded(!isExpanded)
          }}
          type="button"
          className="hover:bg-accent flex w-full flex-row items-center rounded-t-md px-3 py-2 transition-colors"
        >
          <div className="flex flex-1 flex-row items-center gap-2 text-left text-base">
            <Nut className="text-muted-foreground size-4" />
            <span className="text-sm">Tools executed</span>
            <div className="bg-secondary text-secondary-foreground rounded-full px-1.5 py-0.5 font-mono text-xs">
              {uniqueToolIds.length}
            </div>
          </div>
          <CaretDown
            className={cn(
              "h-4 w-4 transition-transform",
              isExpanded ? "rotate-180 transform" : ""
            )}
          />
        </button>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={TRANSITION}
              className="overflow-hidden"
            >
              <div className="px-3 pt-3 pb-3">
                <div className="space-y-2">
                  {uniqueToolIds.map((toolId) => {
                    const toolsForId = groupedTools[toolId]

                    if (!toolsForId?.length) return null

                    return (
                      <div
                        key={toolId}
                        className="pb-2 last:border-0 last:pb-0"
                      >
                        <SingleToolView toolInvocations={toolsForId} />
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

type SingleToolViewProps = {
  toolInvocations: NormalizedToolData[]
  defaultOpen?: boolean
  className?: string
}

function SingleToolView({
  toolInvocations,
  defaultOpen = false,
  className,
}: SingleToolViewProps) {
  // Group by toolCallId and pick the most informative state
  const groupedTools = toolInvocations.reduce(
    (acc, item) => {
      const { toolCallId } = item
      if (!acc[toolCallId]) {
        acc[toolCallId] = []
      }
      acc[toolCallId].push(item)
      return acc
    },
    {} as Record<string, NormalizedToolData[]>
  )

  // For each toolCallId, get the most informative state
  // Priority: output-error > output-available > input-available > input-streaming
  // Also handle legacy states: result > call > partial-call
  const toolsToDisplay = Object.values(groupedTools)
    .map((group) => {
      // Modern states
      const errorTool = group.find((item) => item.state === "output-error")
      const outputTool = group.find((item) => item.state === "output-available")
      const inputAvailableTool = group.find((item) => item.state === "input-available")
      const inputStreamingTool = group.find((item) => item.state === "input-streaming")
      // Legacy states
      const resultTool = group.find((item) => item.state === "result")
      const callTool = group.find((item) => item.state === "call")
      const partialCallTool = group.find((item) => item.state === "partial-call")

      // Return the most informative one (prioritize errors, then results)
      return errorTool || outputTool || resultTool || inputAvailableTool || callTool || inputStreamingTool || partialCallTool
    })
    .filter(Boolean) as NormalizedToolData[]

  if (toolsToDisplay.length === 0) return null

  // If there's only one tool, display it directly
  if (toolsToDisplay.length === 1) {
    return (
      <SingleToolCard
        toolData={toolsToDisplay[0]}
        defaultOpen={defaultOpen}
        className={className}
      />
    )
  }

  // If there are multiple tools, show them in a list
  return (
    <div className={className}>
      <div className="space-y-4">
        {toolsToDisplay.map((tool) => (
          <SingleToolCard
            key={tool.toolCallId}
            toolData={tool}
            defaultOpen={defaultOpen}
          />
        ))}
      </div>
    </div>
  )
}

// Status badge component for tool states
function ToolStatusBadge({ state }: { state: ToolState }) {
  const normalizedState = normalizeState(state)

  switch (normalizedState) {
    case "input-streaming":
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, filter: "blur(2px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.9, filter: "blur(2px)" }}
          transition={{ duration: 0.15 }}
          key="streaming"
        >
          <div className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-xs text-purple-700 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-400">
            <CircleNotch className="mr-1 h-3 w-3 animate-spin" />
            Preparing
          </div>
        </motion.div>
      )
    case "input-available":
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, filter: "blur(2px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.9, filter: "blur(2px)" }}
          transition={{ duration: 0.15 }}
          key="running"
        >
          <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400">
            <Spinner className="mr-1 h-3 w-3 animate-spin" />
            Running
          </div>
        </motion.div>
      )
    case "output-available":
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, filter: "blur(2px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.9, filter: "blur(2px)" }}
          transition={{ duration: 0.15 }}
          key="completed"
        >
          <div className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-1.5 py-0.5 text-xs text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
            <CheckCircle className="mr-1 h-3 w-3" />
            Completed
          </div>
        </motion.div>
      )
    case "output-error":
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, filter: "blur(2px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.9, filter: "blur(2px)" }}
          transition={{ duration: 0.15 }}
          key="error"
        >
          <div className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
            <Warning className="mr-1 h-3 w-3" />
            Error
          </div>
        </motion.div>
      )
    default:
      return null
  }
}

// Component to handle individual tool cards
function SingleToolCard({
  toolData,
  defaultOpen = false,
  className,
}: {
  toolData: NormalizedToolData
  defaultOpen?: boolean
  className?: string
}) {
  const [isExpanded, setIsExpanded] = useState(defaultOpen)
  const { state, toolName, toolCallId, args, result, errorText } = toolData
  const normalizedState = normalizeState(state)

  // Determine loading/completed states (handle both modern and legacy)
  const isStreaming = normalizedState === "input-streaming"
  const isRunning = normalizedState === "input-available"
  const isCompleted = normalizedState === "output-available"
  const isError = normalizedState === "output-error"

  // Parse the result JSON if available
  const { parsedResult, parseError } = useMemo(() => {
    if (!isCompleted || !result) return { parsedResult: null, parseError: null }

    try {
      if (Array.isArray(result))
        return { parsedResult: result, parseError: null }

      if (
        typeof result === "object" &&
        result !== null &&
        "content" in result
      ) {
        const resultWithContent = result as { content?: Array<{ type: string; text?: string }> }
        const textContent = resultWithContent.content?.find(
          (item) => item.type === "text"
        )
        if (!textContent?.text) return { parsedResult: null, parseError: null }

        try {
          return {
            parsedResult: JSON.parse(textContent.text),
            parseError: null,
          }
        } catch {
          return { parsedResult: textContent.text, parseError: null }
        }
      }

      return { parsedResult: result, parseError: null }
    } catch {
      return { parsedResult: null, parseError: "Failed to parse result" }
    }
  }, [isCompleted, result])

  // Format the arguments for display
  const formattedArgs = args
    ? Object.entries(args).map(([key, value]) => (
        <div key={key} className="mb-1">
          <span className="text-muted-foreground font-medium">{key}:</span>{" "}
          <span className="font-mono">
            {typeof value === "object"
              ? value === null
                ? "null"
                : Array.isArray(value)
                  ? value.length === 0
                    ? "[]"
                    : JSON.stringify(value)
                  : JSON.stringify(value)
              : String(value)}
          </span>
        </div>
      ))
    : null

  // Render generic results based on their structure
  const renderResults = () => {
    if (!parsedResult) return "No result data available"

    // Handle array of items with url, title, and snippet (like search results)
    if (Array.isArray(parsedResult) && parsedResult.length > 0) {
      // Check if items look like search results
      if (
        parsedResult[0] &&
        typeof parsedResult[0] === "object" &&
        "url" in parsedResult[0] &&
        "title" in parsedResult[0]
      ) {
        return (
          <div className="space-y-3">
            {parsedResult.map(
              (
                item: { url: string; title: string; snippet?: string },
                index: number
              ) => (
                <div
                  key={index}
                  className="border-border border-b pb-3 last:border-0 last:pb-0"
                >
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary group flex items-center gap-1 font-medium hover:underline"
                  >
                    {item.title}
                    <Link className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
                  </a>
                  <div className="text-muted-foreground mt-1 font-mono text-xs">
                    {item.url}
                  </div>
                  {item.snippet && (
                    <div className="mt-1 line-clamp-2 text-sm">
                      {item.snippet}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )
      }

      // Generic array display
      return (
        <div className="font-mono text-xs">
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(parsedResult, null, 2)}
          </pre>
        </div>
      )
    }

    // Handle object results
    if (typeof parsedResult === "object" && parsedResult !== null) {
      const resultObj = parsedResult as Record<string, unknown>
      const title = typeof resultObj.title === "string" ? resultObj.title : null
      const htmlUrl =
        typeof resultObj.html_url === "string" ? resultObj.html_url : null

      return (
        <div>
          {title && <div className="mb-2 font-medium">{title}</div>}
          {htmlUrl && (
            <div className="mb-2">
              <a
                href={htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary flex items-center gap-1 hover:underline"
              >
                <span className="font-mono">{htmlUrl}</span>
                <Link className="h-3 w-3 opacity-70" />
              </a>
            </div>
          )}
          <div className="font-mono text-xs">
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(parsedResult, null, 2)}
            </pre>
          </div>
        </div>
      )
    }

    // Handle string results
    if (typeof parsedResult === "string") {
      return <div className="whitespace-pre-wrap">{parsedResult}</div>
    }

    // Fallback
    return "No result data available"
  }

  return (
    <div
      className={cn(
        "border-border flex flex-col gap-0 overflow-hidden rounded-md border",
        className
      )}
    >
      <button
        onClick={(e) => {
          e.preventDefault()
          setIsExpanded(!isExpanded)
        }}
        type="button"
        className="hover:bg-accent flex w-full flex-row items-center rounded-t-md px-3 py-2 transition-colors"
      >
        <div className="flex flex-1 flex-row items-center gap-2 text-left text-base">
          <Wrench className="text-muted-foreground size-4" />
          <span className="font-mono text-sm">{toolName}</span>
          <AnimatePresence mode="popLayout" initial={false}>
            <ToolStatusBadge state={normalizedState} />
          </AnimatePresence>
        </div>
        <CaretDown
          className={cn(
            "h-4 w-4 transition-transform",
            isExpanded ? "rotate-180 transform" : ""
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={TRANSITION}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-3 pt-3 pb-3">
              {/* Arguments section */}
              {args && Object.keys(args).length > 0 && (
                <div>
                  <div className="text-muted-foreground mb-1 text-xs font-medium">
                    Arguments
                  </div>
                  <div className="bg-background rounded border p-2 text-sm">
                    {formattedArgs}
                  </div>
                </div>
              )}

              {/* Result section */}
              {isCompleted && (
                <div>
                  <div className="text-muted-foreground mb-1 text-xs font-medium">
                    Result
                  </div>
                  <div className="bg-background max-h-60 overflow-auto rounded border p-2 text-sm">
                    {parseError ? (
                      <div className="text-red-500">{parseError}</div>
                    ) : (
                      renderResults()
                    )}
                  </div>
                </div>
              )}

              {/* Error section */}
              {isError && errorText && (
                <div>
                  <div className="text-muted-foreground mb-1 text-xs font-medium">
                    Error
                  </div>
                  <div className="bg-red-50 dark:bg-red-950/20 max-h-60 overflow-auto rounded border border-red-200 dark:border-red-800 p-2 text-sm text-red-700 dark:text-red-400">
                    {errorText}
                  </div>
                </div>
              )}

              {/* Tool call ID */}
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <div className="flex items-center">
                  <Code className="mr-1 inline size-3" />
                  Tool Call ID:{" "}
                  <span className="ml-1 font-mono">{toolCallId}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
