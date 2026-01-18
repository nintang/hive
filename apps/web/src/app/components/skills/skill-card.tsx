"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Skill } from "@/lib/skills"
import { cn } from "@/lib/utils"
import {
  FileXls,
  Presentation,
  FileText,
  FileDoc,
  Code,
  ChartBar,
  Table,
  TestTube,
  Sparkle,
  ArrowSquareOut,
  FilePdf,
  Globe,
} from "@phosphor-icons/react"

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

type SkillCardProps = {
  skill: Skill
  enabled?: boolean
  onToggle?: (skillId: string) => void
  isToggling?: boolean
  showSource?: boolean
}

export function SkillCard({
  skill,
  enabled = false,
  onToggle,
  isToggling = false,
  showSource = false,
}: SkillCardProps) {
  const IconComponent = iconMap[skill.icon] || Code

  return (
    <div
      className={cn(
        "border-border bg-card hover:bg-accent/50 flex items-start gap-3 rounded-lg border p-3 transition-colors",
        enabled && "border-primary/30 bg-primary/5"
      )}
    >
      <div
        className={cn(
          "bg-muted flex size-10 flex-shrink-0 items-center justify-center rounded-md",
          enabled && "bg-primary/10"
        )}
      >
        <IconComponent
          className={cn("size-5", enabled ? "text-primary" : "text-muted-foreground")}
          weight="duotone"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{skill.name}</span>
          {enabled && (
            <Badge
              variant="outline"
              className="border-primary/30 bg-primary/10 text-primary text-xs"
            >
              Enabled
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
          {skill.description}
        </p>
        {showSource && skill.source && (
          <a
            href={skill.source}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground mt-1 inline-flex items-center gap-1 text-xs"
          >
            <ArrowSquareOut className="size-3" />
            View source
          </a>
        )}
      </div>

      {onToggle && (
        <Button
          size="sm"
          variant={enabled ? "outline" : "default"}
          onClick={() => onToggle(skill.id)}
          disabled={isToggling}
          className="flex-shrink-0"
        >
          {isToggling ? "..." : enabled ? "Disable" : "Enable"}
        </Button>
      )}
    </div>
  )
}
