import { useEffect } from "react"

export function useKeyShortcut(
  keyCombo: (e: KeyboardEvent) => boolean,
  action: () => void
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if typing in an input, textarea, or contenteditable element
      const target = e.target as HTMLElement
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.closest('[contenteditable="true"]')

      if (isTyping) {
        return
      }

      if (keyCombo(e)) {
        e.preventDefault()
        action()
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [keyCombo, action])
}
