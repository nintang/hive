"use client"

import { useKeyShortcut } from "@/app/hooks/use-key-shortcut"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Skill } from "@/lib/skills"
import { cn } from "@/lib/utils"
import {
  CircleNotch,
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
import { SkillPreviewPanel } from "./skill-preview-panel"
import { SkillsFooter } from "./skills-footer"

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

type CommandSkillsProps = {
  skills: Skill[]
  trigger?: React.ReactNode
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  onOpenChange?: (open: boolean) => void
  hasPopover?: boolean
  isLoading?: boolean
  error?: string | null
  isFullPage?: boolean
}

type SkillItemRowProps = {
  skill: Skill
}

function SkillItemRow({ skill }: SkillItemRowProps) {
  const IconComponent = iconMap[skill.icon] || Code

  return (
    <>
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
    </>
  )
}

type CustomCommandDialogProps = React.ComponentProps<typeof Dialog> & {
  title?: string
  description?: string
  className?: string
  onOpenChange?: (open: boolean) => void
  isFullPage?: boolean
}

function CustomCommandDialog({
  title = "Skills",
  description = "Browse available code execution skills",
  children,
  className,
  onOpenChange,
  open,
  isFullPage = false,
  ...props
}: CustomCommandDialogProps) {
  if (isFullPage) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <div
          className={cn(
            "bg-background border-border w-full max-w-[900px] overflow-hidden rounded-xl border shadow-lg",
            className
          )}
        >
          <Command className="[&_[cmdk-group-heading]]:text-muted-foreground border-none **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5 [&_[cmdk-item]_svg]:border-none">
            {children}
          </Command>
        </div>
      </div>
    )
  }

  return (
    <Dialog {...props} onOpenChange={onOpenChange} open={open}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent className={cn("overflow-hidden border-none p-0", className)}>
        <Command className="[&_[cmdk-group-heading]]:text-muted-foreground border-none **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5 [&_[cmdk-item]_svg]:border-none">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

export function CommandSkills({
  skills,
  trigger,
  isOpen,
  setIsOpen,
  onOpenChange,
  hasPopover = true,
  isLoading = false,
  error = null,
  isFullPage = false,
}: CommandSkillsProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [hoveredSkill, setHoveredSkill] = useState<Skill | null>(null)

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    onOpenChange?.(open)

    if (!open) {
      setSearchQuery("")
      setHoveredSkill(null)
    }
  }

  useKeyShortcut(
    (e: KeyboardEvent) => e.key === "k" && (e.metaKey || e.ctrlKey) && e.shiftKey,
    () => handleOpenChange(!isOpen)
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

  const handleSkillHover = useCallback((skill: Skill | null) => {
    setHoveredSkill(skill)
  }, [])

  const handlePreviewHover = useCallback(() => {
    // No-op: kept for API compatibility
  }, [])

  // The active preview is the hovered one, or the first skill as default
  const activePreviewSkill = hoveredSkill || skills[0] || null

  const renderSkillItem = useCallback(
    (skill: Skill) => {
      return (
        <CommandItem
          key={skill.id}
          className={cn(
            "group data-[selected=true]:bg-accent flex w-full items-center justify-between rounded-md py-2"
          )}
          value={`${skill.id}-${skill.name}`}
          onMouseEnter={() => handleSkillHover(skill)}
        >
          <SkillItemRow skill={skill} />
        </CommandItem>
      )
    },
    [handleSkillHover]
  )

  const content = (
    <CustomCommandDialog
      onOpenChange={handleOpenChange}
      open={isOpen}
      title="Skills"
      description="Browse available code execution skills"
      className="sm:max-w-[900px]"
      isFullPage={isFullPage}
    >
      <CommandInput
        placeholder="Search skills..."
        value={searchQuery}
        onValueChange={(value) => setSearchQuery(value)}
      />

      <div className="grid grid-cols-5">
        <div className="col-span-2">
          <CommandList
            className={cn(
              "max-h-[480px] min-h-[480px] flex-1 [&>[cmdk-list-sizer]]:space-y-6 [&>[cmdk-list-sizer]]:py-2"
            )}
          >
            {isLoading && skills.length === 0 ? (
              <div className="flex h-[400px] items-center justify-center">
                <CircleNotch className="text-muted-foreground size-6 animate-spin" />
              </div>
            ) : error ? (
              <div className="flex h-[400px] flex-col items-center justify-center gap-2">
                <p className="text-muted-foreground text-sm">Failed to load skills</p>
                <p className="text-muted-foreground text-xs">{error}</p>
              </div>
            ) : filteredSkills.length === 0 ? (
              <CommandEmpty>No skills found.</CommandEmpty>
            ) : (
              <>
                {groupedSkills.map((group) => (
                  <CommandGroup
                    key={group.category}
                    heading={group.name}
                    className="space-y-0 px-1.5"
                  >
                    {group.skills.map((skill) => renderSkillItem(skill))}
                  </CommandGroup>
                ))}
              </>
            )}
          </CommandList>
        </div>

        <SkillPreviewPanel skill={activePreviewSkill} onHover={handlePreviewHover} />
      </div>

      <SkillsFooter />
    </CustomCommandDialog>
  )

  if (isFullPage) {
    return content
  }

  return (
    <>
      {trigger && hasPopover ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent>Skills ⌘+Shift+K</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}

      {content}
    </>
  )
}
