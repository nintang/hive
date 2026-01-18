import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
} from "@/components/prompt-kit/message"
import { useUserPreferences } from "@/lib/user-preference-store/provider"
import { cn } from "@/lib/utils"
import type { UIMessage } from "ai"
import { ArrowClockwise, Check, Copy } from "@phosphor-icons/react"
import { useCallback, useRef } from "react"
import { getSources } from "./get-sources"
import { QuoteButton } from "./quote-button"
import { Reasoning } from "./reasoning"
import { SearchImages } from "./search-images"
import { SourcesList } from "./sources-list"
import { ToolInvocation } from "./tool-invocation"
import { useAssistantMessageSelection } from "./useAssistantMessageSelection"

// Generic part type for type-safe access to properties that may vary between SDK versions
type AnyPart = {
  type: string
  state?: string
  output?: unknown
  text?: string // V6 reasoning uses text
  reasoning?: string // Legacy reasoning
  toolInvocation?: {
    state?: string
    toolName?: string
    result?: unknown
  }
}

type ImageResult = {
  title: string
  imageUrl: string
  sourceUrl: string
}

// AI SDK v6 uses typed tool parts with format "tool-{toolName}" instead of generic "tool-invocation"
// This helper detects both formats for backwards compatibility
function isToolPart(part: AnyPart): boolean {
  return (
    part.type === "tool-invocation" || // Legacy format
    (part.type.startsWith("tool-") && part.type !== "tool-result") // AI SDK v6 format
  )
}

// Extract tool name from part type (handles both formats)
function getToolName(part: AnyPart): string {
  if (part.type === "tool-invocation" && part.toolInvocation?.toolName) {
    return part.toolInvocation.toolName
  }
  // AI SDK v6: type is "tool-{toolName}"
  return part.type.replace(/^tool-/, "")
}

// Get reasoning text from part (handles both v6 and legacy formats)
function getReasoningText(part: AnyPart): string | undefined {
  // V6 uses 'text', legacy uses 'reasoning'
  return part.text || part.reasoning
}

type MessageAssistantProps = {
  children: string
  isLast?: boolean
  hasScrollAnchor?: boolean
  copied?: boolean
  copyToClipboard?: () => void
  onReload?: () => void
  parts?: UIMessage["parts"]
  status?: "streaming" | "ready" | "submitted" | "error"
  className?: string
  messageId: string
  onQuote?: (text: string, messageId: string) => void
}

export function MessageAssistant({
  children,
  isLast,
  hasScrollAnchor,
  copied,
  copyToClipboard,
  onReload,
  parts,
  status,
  className,
  messageId,
  onQuote,
}: MessageAssistantProps) {
  const { preferences } = useUserPreferences()
  const sources = getSources(parts ?? [])
  // Filter for tool parts using helper that handles both legacy and v6 formats
  const toolInvocationParts = (parts?.filter((p) => isToolPart(p as AnyPart)) ?? []) as AnyPart[]
  const reasoningParts = parts?.find((part) => part.type === "reasoning") as AnyPart | undefined
  const reasoningText = reasoningParts ? getReasoningText(reasoningParts) : undefined
  const contentNullOrEmpty = children === null || children === ""
  const isLastStreaming = status === "streaming" && isLast
  // Handle image search results - supports both legacy and v6 format
  const searchImageResults: ImageResult[] =
    (parts
      ?.filter((part) => {
        const anyPart = part as AnyPart
        const toolName = getToolName(anyPart)
        if (toolName !== "imageSearch") return false
        // Check for completed state (v6: output-available, legacy: result)
        const state = anyPart.state || anyPart.toolInvocation?.state
        return state === "output-available" || state === "result"
      })
      .flatMap((part) => {
        const anyPart = part as AnyPart
        // Get result from v6 format (output) or legacy format (toolInvocation.result)
        const result = anyPart.output || anyPart.toolInvocation?.result
        const resultObj = result as { content?: Array<{ type: string; results?: ImageResult[] }> } | undefined
        if (resultObj?.content?.[0]?.type === "images") {
          return resultObj.content[0].results ?? []
        }
        return []
      }) ?? []) as ImageResult[]

  const isQuoteEnabled = !preferences.multiModelEnabled
  const messageRef = useRef<HTMLDivElement>(null)
  const { selectionInfo, clearSelection } = useAssistantMessageSelection(
    messageRef,
    isQuoteEnabled
  )
  const handleQuoteBtnClick = useCallback(() => {
    if (selectionInfo && onQuote) {
      onQuote(selectionInfo.text, selectionInfo.messageId)
      clearSelection()
    }
  }, [selectionInfo, onQuote, clearSelection])

  return (
    <Message
      className={cn(
        "group flex w-full max-w-3xl flex-1 items-start gap-4 px-6 pb-2",
        hasScrollAnchor && "min-h-scroll-anchor",
        className
      )}
    >
      <div
        ref={messageRef}
        className={cn(
          "relative flex min-w-full flex-col gap-2",
          isLast && "pb-8"
        )}
        {...(isQuoteEnabled && { "data-message-id": messageId })}
      >
        {reasoningText && (
          <Reasoning
            reasoning={reasoningText}
            isStreaming={status === "streaming"}
          />
        )}

        {toolInvocationParts.length > 0 && preferences.showToolInvocations && (
          <ToolInvocation toolInvocations={toolInvocationParts} />
        )}

        {searchImageResults.length > 0 && (
          <SearchImages results={searchImageResults} />
        )}

        {contentNullOrEmpty ? null : (
          <MessageContent
            className={cn(
              "prose dark:prose-invert relative min-w-full bg-transparent p-0",
              "prose-h1:scroll-m-20 prose-h1:text-2xl prose-h1:font-semibold prose-h2:mt-8 prose-h2:scroll-m-20 prose-h2:text-xl prose-h2:mb-3 prose-h2:font-medium prose-h3:scroll-m-20 prose-h3:text-base prose-h3:font-medium prose-h4:scroll-m-20 prose-h5:scroll-m-20 prose-h6:scroll-m-20 prose-strong:font-medium prose-table:block prose-table:overflow-y-auto"
            )}
            markdown={true}
          >
            {children}
          </MessageContent>
        )}

        {sources && sources.length > 0 && <SourcesList sources={sources} />}

        {Boolean(isLastStreaming || contentNullOrEmpty) ? null : (
          <MessageActions
            className={cn(
              "-ml-2 flex gap-0 opacity-0 transition-opacity group-hover:opacity-100"
            )}
          >
            <MessageAction
              tooltip={copied ? "Copied!" : "Copy text"}
              side="bottom"
            >
              <button
                className="hover:bg-accent/60 text-muted-foreground hover:text-foreground flex size-7.5 items-center justify-center rounded-full bg-transparent transition"
                aria-label="Copy text"
                onClick={copyToClipboard}
                type="button"
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </button>
            </MessageAction>
            {isLast ? (
              <MessageAction
                tooltip="Regenerate"
                side="bottom"
                delayDuration={0}
              >
                <button
                  className="hover:bg-accent/60 text-muted-foreground hover:text-foreground flex size-7.5 items-center justify-center rounded-full bg-transparent transition"
                  aria-label="Regenerate"
                  onClick={onReload}
                  type="button"
                >
                  <ArrowClockwise className="size-4" />
                </button>
              </MessageAction>
            ) : null}
          </MessageActions>
        )}

        {isQuoteEnabled && selectionInfo && selectionInfo.messageId && (
          <QuoteButton
            mousePosition={selectionInfo.position}
            onQuote={handleQuoteBtnClick}
            containerRect={selectionInfo.containerRect}
            onDismiss={clearSelection}
          />
        )}
      </div>
    </Message>
  )
}
