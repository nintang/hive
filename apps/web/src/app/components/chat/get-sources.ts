import type { UIMessage } from "ai"

// Generic part type that covers both legacy and v6 formats
type AnyPart = {
  type: string
  state?: string
  output?: unknown
  source?: unknown
  toolInvocation?: {
    state?: string
    toolName?: string
    result?: unknown
  }
}

// Helper to check if a part is a tool part (legacy or v6 format)
function isToolPart(part: AnyPart): boolean {
  return (
    part.type === "tool-invocation" ||
    (part.type.startsWith("tool-") && part.type !== "tool-result")
  )
}

// Helper to check if part is a source part
function isSourcePart(part: AnyPart): boolean {
  return part.type === "source" || part.type === "source-url" || part.type === "source-document"
}

// Helper to check if tool is in completed state
function isToolCompleted(part: AnyPart): boolean {
  const state = part.state || part.toolInvocation?.state
  return state === "output-available" || state === "result"
}

// Helper to get tool name from part
function getToolName(part: AnyPart): string {
  if (part.type === "tool-invocation" && part.toolInvocation?.toolName) {
    return part.toolInvocation.toolName
  }
  return part.type.replace(/^tool-/, "")
}

// Helper to get result from tool part (handles both v6 and legacy formats)
function getToolResult(part: AnyPart): unknown {
  // V6 format uses 'output', legacy uses 'toolInvocation.result'
  return part.output || part.toolInvocation?.result
}

export function getSources(parts: UIMessage["parts"]) {
  const sources = parts
    ?.filter((part) => isSourcePart(part as AnyPart) || isToolPart(part as AnyPart))
    .map((part) => {
      const anyPart = part as AnyPart

      // Handle source parts
      if (isSourcePart(anyPart)) {
        return anyPart.source
      }

      // Handle tool parts (both v6 and legacy formats)
      if (isToolPart(anyPart) && isToolCompleted(anyPart)) {
        const toolName = getToolName(anyPart)
        const result = getToolResult(anyPart)

        if (toolName === "summarizeSources") {
          const resultData = result as { result?: Array<{ citations?: unknown[] }> }
          if (resultData?.result?.[0]?.citations) {
            return resultData.result.flatMap((item) => item.citations || [])
          }
        }

        return Array.isArray(result) ? result.flat() : result
      }

      return null
    })
    .filter(Boolean)
    .flat()

  const validSources =
    sources?.filter(
      (source): source is { url: string; title?: string } =>
        source != null && typeof source === "object" && "url" in source && (source as { url: string }).url !== ""
    ) || []

  return validSources
}
