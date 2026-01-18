"use client"

import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import { useSkills } from "@/lib/skills/use-skills"
import { CommandSkills } from "@/app/components/skills/command-skills"
import { DrawerSkills } from "@/app/components/skills/drawer-skills"

export function SkillsPageView() {
  const isMobile = useBreakpoint(768)
  const { skills, isLoading, error } = useSkills()

  // Return nothing during SSR to avoid hydration mismatch
  if (isMobile === null) {
    return null
  }

  if (isMobile) {
    return (
      <DrawerSkills
        skills={skills}
        isLoading={isLoading}
        error={error}
        isOpen={true}
        setIsOpen={() => {}}
        isFullPage
      />
    )
  }

  return (
    <CommandSkills
      skills={skills}
      isLoading={isLoading}
      error={error}
      isOpen={true}
      setIsOpen={() => {}}
      isFullPage
    />
  )
}
