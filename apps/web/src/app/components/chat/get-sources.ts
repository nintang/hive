import type { UIMessage } from "ai"

export function getSources(parts: UIMessage["parts"]) {
  const sources = parts
    ?.filter(
      (part): part is Extract<UIMessage["parts"][number], { type: "source" | "tool-invocation" }> =>
        part.type === "source" || part.type === "tool-invocation"
    )
    .map((part) => {
      if (part.type === "source") {
        return part.source
      }

      if (
        part.type === "tool-invocation" &&
        part.toolInvocation.state === "result"
      ) {
        const result = part.toolInvocation.result

        if (
          part.toolInvocation.toolName === "summarizeSources" &&
          result?.result?.[0]?.citations
        ) {
          return result.result.flatMap((item: { citations?: unknown[] }) => item.citations || [])
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
        source && typeof source === "object" && "url" in source && source.url !== ""
    ) || []

  return validSources
}
