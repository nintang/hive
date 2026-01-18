"use client"

import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import { useSkills } from "@/lib/skills/use-skills"
import { cn } from "@/lib/utils"
import { Cpu } from "@phosphor-icons/react"
import { useState } from "react"
import { CommandSkills } from "./command-skills"
import { DrawerSkills } from "./drawer-skills"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type SkillsPageTriggerProps = {
  hasSidebar?: boolean
  classNameTrigger?: string
  icon?: React.ReactNode
  label?: React.ReactNode | string
  hasPopover?: boolean
}

export function SkillsPageTrigger({
  hasSidebar = false,
  classNameTrigger,
  icon,
  label,
  hasPopover = true,
}: SkillsPageTriggerProps) {
  const isMobile = useBreakpoint(768)
  const [isOpen, setIsOpen] = useState(false)
  const { skills, isLoading, error } = useSkills()

  const hasLabel = label != null && label !== ""

  const defaultTrigger = (
    <button
      className={cn(
        "text-muted-foreground hover:text-foreground hover:bg-muted bg-background pointer-events-auto rounded-full p-1.5 transition-colors",
        hasLabel && "inline-flex items-center gap-2",
        hasSidebar ? "hidden" : "block",
        classNameTrigger
      )}
      type="button"
      onClick={() => setIsOpen(true)}
      aria-label="Skills"
      tabIndex={isMobile ? -1 : 0}
    >
      {icon || <Cpu size={24} />}
      {label}
    </button>
  )

  // Return trigger only during SSR to avoid hydration mismatch
  if (isMobile === null) {
    return defaultTrigger
  }

  if (isMobile) {
    return (
      <DrawerSkills
        skills={skills}
        trigger={defaultTrigger}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        isLoading={isLoading}
        error={error}
      />
    )
  }

  return (
    <>
      {hasPopover ? (
        <Tooltip>
          <TooltipTrigger asChild>{defaultTrigger}</TooltipTrigger>
          <TooltipContent>Skills ⌘+Shift+K</TooltipContent>
        </Tooltip>
      ) : (
        defaultTrigger
      )}

      <CommandSkills
        skills={skills}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        onOpenChange={setIsOpen}
        hasPopover={false}
        isLoading={isLoading}
        error={error}
      />
    </>
  )
}
