"use client"

import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import { useProjectSkills } from "@/lib/skills/use-project-skills"
import { cn } from "@/lib/utils"
import { Cpu } from "@phosphor-icons/react"
import { useState, useCallback } from "react"
import { SkillsBrowser } from "./skills-browser"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type SkillsTriggerProps = {
  projectId: string | null
  className?: string
}

export function SkillsTrigger({ projectId, className }: SkillsTriggerProps) {
  const isMobile = useBreakpoint(768)
  const [isOpen, setIsOpen] = useState(false)

  const {
    allSkills,
    enabledSkillIds,
    enableSkill,
    disableSkill,
    isSkillEnabled,
    isLoading,
  } = useProjectSkills(projectId)

  const handleToggleSkill = useCallback(
    async (skillId: string) => {
      if (isSkillEnabled(skillId)) {
        await disableSkill(skillId)
      } else {
        await enableSkill(skillId)
      }
    },
    [isSkillEnabled, enableSkill, disableSkill]
  )

  // Don't render if no projectId
  if (!projectId) {
    return null
  }

  const hasEnabledSkills = enabledSkillIds.length > 0

  const trigger = (
    <button
      className={cn(
        "text-muted-foreground hover:text-foreground hover:bg-muted bg-background pointer-events-auto relative rounded-full p-1.5 transition-colors",
        hasEnabledSkills && "text-primary",
        className
      )}
      type="button"
      onClick={() => setIsOpen(true)}
      aria-label="Skills"
      tabIndex={isMobile ? -1 : 0}
    >
      <Cpu size={24} weight={hasEnabledSkills ? "duotone" : "regular"} />
      {hasEnabledSkills && (
        <span className="bg-primary absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-medium text-white">
          {enabledSkillIds.length}
        </span>
      )}
    </button>
  )

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent>
          {hasEnabledSkills
            ? `${enabledSkillIds.length} skill${enabledSkillIds.length !== 1 ? "s" : ""} enabled`
            : "Add skills"}
        </TooltipContent>
      </Tooltip>

      <SkillsBrowser
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        allSkills={allSkills}
        enabledSkillIds={enabledSkillIds}
        onToggleSkill={handleToggleSkill}
        isLoading={isLoading}
      />
    </>
  )
}
