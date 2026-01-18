"use client"

import { Badge } from "@/components/ui/badge"
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Skill } from "@/lib/skills"
import {
  CircleNotch,
  MagnifyingGlass,
  FileXls,
  Presentation,
  FileText,
  FileDoc,
  FilePdf,
  Code,
  ChartBar,
  Table,
  TestTube,
  Sparkle,
  Globe,
} from "@phosphor-icons/react"
import { useCallback, useMemo, useState } from "react"

const iconMap: Record<string, React.ElementType> = {
  FileXls,
  FileSpreadsheet: FileXls,
  Presentation,
  FileText,
  FileDoc,
  FilePdf,
  Code,
  BarChart: ChartBar,
  ChartBar,
  Table,
  TestTube,
  Sparkle,
  Globe,
}

type DrawerSkillsProps = {
  skills: Skill[]
  trigger?: React.ReactNode
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  isLoading?: boolean
  error?: string | null
  isFullPage?: boolean
}

export function DrawerSkills({
  skills,
  trigger,
  isOpen,
  setIsOpen,
  isLoading = false,
  error = null,
  isFullPage = false,
}: DrawerSkillsProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open)
      if (!open) {
        setSearchQuery("")
      }
    },
    [setIsOpen]
  )

  const filteredSkills = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return query
      ? skills.filter(
          (skill) =>
            skill.name.toLowerCase().includes(query) ||
            skill.description.toLowerCase().includes(query) ||
            skill.category.toLowerCase().includes(query)
        )
      : skills
  }, [skills, searchQuery])

  const groupedSkills = useMemo(() => {
    const grouped: Record<string, Skill[]> = {}

    filteredSkills.forEach((skill) => {
      const category = skill.category || "Other"
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(skill)
    })

    const categoryLabels: Record<string, string> = {
      document: "Documents",
      development: "Development",
      analysis: "Analysis",
      creative: "Creative",
      communication: "Communication",
    }

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, categorySkills]) => ({
        category,
        name: categoryLabels[category] || category,
        skills: categorySkills,
      }))
  }, [filteredSkills])

  const renderSkillItem = useCallback((skill: Skill) => {
    const IconComponent = iconMap[skill.icon] || Code

    return (
      <div
        key={skill.id}
        className="active:bg-accent flex items-center justify-between rounded-lg px-2 py-2.5"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="bg-muted relative flex size-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-md">
            <IconComponent className="text-muted-foreground size-4" weight="duotone" />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="line-clamp-1 text-sm font-medium">{skill.name}</span>
            </div>
            <span className="text-muted-foreground line-clamp-1 text-xs">
              {skill.description}
            </span>
          </div>
        </div>

        <Badge variant="outline" className="text-muted-foreground flex-shrink-0 text-xs">
          {skill.category}
        </Badge>
      </div>
    )
  }, [])

  const content = (
    <div className="flex h-dvh max-h-[80vh] flex-col">
      <div className="border-b p-4 pb-3">
        <div className="relative">
          <Input
            placeholder="Search skills..."
            className="rounded-lg py-1.5 pl-8 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <MagnifyingGlass className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 transform text-gray-400" />
        </div>
      </div>

      <ScrollArea className="flex-1 overflow-auto">
        <div className="flex flex-col space-y-6 px-4 pb-8 pt-4">
          {isLoading && skills.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center">
              <CircleNotch className="text-muted-foreground size-6 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex h-[200px] flex-col items-center justify-center gap-2">
              <p className="text-muted-foreground text-sm">Failed to load skills</p>
              <p className="text-muted-foreground text-xs">{error}</p>
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="text-muted-foreground py-4 text-center text-sm">
              No skills found.
            </div>
          ) : searchQuery ? (
            <div className="space-y-2">
              {filteredSkills.map((skill) => renderSkillItem(skill))}
            </div>
          ) : (
            <>
              {groupedSkills.map((group) => (
                <div key={group.category} className="space-y-0.5">
                  <h3 className="text-muted-foreground pl-2 text-sm font-medium">
                    {group.name}
                  </h3>
                  <div className="space-y-2">
                    {group.skills.map((skill) => renderSkillItem(skill))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )

  if (isFullPage) {
    return (
      <div className="bg-background flex h-full w-full flex-col">
        {content}
      </div>
    )
  }

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      {trigger && (
        <Tooltip>
          <TooltipTrigger asChild>
            <DrawerTrigger asChild>{trigger}</DrawerTrigger>
          </TooltipTrigger>
          <TooltipContent>Skills</TooltipContent>
        </Tooltip>
      )}
      <DrawerContent>{content}</DrawerContent>
    </Drawer>
  )
}
