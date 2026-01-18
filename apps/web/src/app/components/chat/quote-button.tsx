import useClickOutside from "@/components/motion-primitives/useClickOutside"
import { Button } from "@/components/ui/button"
import { Quote } from "lucide-react"
import { RefObject, useMemo, useRef } from "react"

type QuoteButtonProps = {
  mousePosition: { x: number; y: number }
  onQuote: () => void
  containerRect: DOMRect | null
  onDismiss: () => void
}

export function QuoteButton({
  mousePosition,
  onQuote,
  containerRect,
  onDismiss,
}: QuoteButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null)
  useClickOutside(buttonRef as RefObject<HTMLElement>, onDismiss)

  const buttonHeight = 60
  const position = useMemo(() => {
    if (!containerRect) return { top: 0, left: 0 }
    return {
      top: mousePosition.y - containerRect.top - buttonHeight,
      left: mousePosition.x - containerRect.left,
    }
  }, [mousePosition.x, mousePosition.y, containerRect])

  return (
    <div
      ref={buttonRef}
      className="absolute z-50 flex gap-2 rounded-full"
      style={{
        top: position.top,
        left: position.left,
        transform: "translateX(-50%)",
      }}
    >
      <Button
        onClick={onQuote}
        className="flex size-10 items-center gap-1 rounded-full px-3 py-1 text-base"
        aria-label="Ask follow up"
      >
        <Quote className="size-4" />
      </Button>
    </div>
  )
}
