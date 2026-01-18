"use client"

import { ArrowSquareOut } from "@phosphor-icons/react"

export function SkillsFooter() {
  return (
    <div className="border-border text-muted-foreground flex items-center justify-between border-t px-4 py-3 text-xs">
      <div className="flex items-center gap-4">
        <span>
          <kbd className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px]">
            ↑↓
          </kbd>{" "}
          Navigate
        </span>
        <span>
          <kbd className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px]">
            Esc
          </kbd>{" "}
          Close
        </span>
      </div>
      <a
        href="https://github.com/anthropics/skills"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-foreground inline-flex items-center gap-1 transition-colors"
      >
        <ArrowSquareOut className="size-3" />
        Browse more skills
      </a>
    </div>
  )
}
