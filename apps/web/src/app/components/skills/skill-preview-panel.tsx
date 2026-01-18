"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Skill } from "@/lib/skills"
import {
  ArrowSquareOut,
  Package,
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

type SkillPreviewPanelProps = {
  skill: Skill | null
  onHover?: (isHovering: boolean) => void
}

function DefaultState() {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="text-muted-foreground space-y-2 text-center">
        <p className="text-sm opacity-60">Hover over a skill to preview</p>
      </div>
    </div>
  )
}

function PackageBadge({ name }: { name: string }) {
  return (
    <Badge variant="secondary" className="text-xs">
      <Package className="mr-1 size-3" />
      {name}
    </Badge>
  )
}

export function SkillPreviewPanel({ skill, onHover }: SkillPreviewPanelProps) {
  if (!skill) {
    return (
      <div
        className="bg-background col-span-3 border-l"
        onMouseEnter={() => onHover?.(true)}
        onMouseLeave={() => onHover?.(false)}
      >
        <div className="h-[480px]">
          <DefaultState />
        </div>
      </div>
    )
  }

  const IconComponent = iconMap[skill.icon] || Code

  const categoryLabels: Record<string, string> = {
    document: "Documents",
    development: "Development",
    analysis: "Analysis",
    creative: "Creative",
    communication: "Communication",
  }

  return (
    <div
      className="bg-background col-span-3 border-l"
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      <ScrollArea className="h-[480px]">
        <div className="flex min-w-0 flex-col gap-4 overflow-hidden p-5">
          {/* Header with icon, name, and action buttons */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="bg-muted relative flex size-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border p-1.5">
                <IconComponent
                  className="text-muted-foreground size-6"
                  weight="duotone"
                />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold">{skill.name}</h3>
                <Badge variant="outline" className="w-fit text-xs">
                  {categoryLabels[skill.category] || skill.category}
                </Badge>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {skill.source && (
                <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
                  <a href={skill.source} target="_blank" rel="noopener noreferrer">
                    <ArrowSquareOut className="mr-1 size-3" />
                    Source
                  </a>
                </Button>
              )}
            </div>
          </div>

          {/* Description */}
          <p className="text-muted-foreground text-sm leading-relaxed">
            {skill.description}
          </p>

          {/* Packages */}
          {skill.packages && skill.packages.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Python Packages
              </p>
              <div className="flex flex-wrap gap-1.5">
                {skill.packages.map((pkg) => (
                  <PackageBadge key={pkg} name={pkg} />
                ))}
              </div>
            </div>
          )}

          {/* Template info */}
          {skill.template && (
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Sandbox Template
              </p>
              <Badge variant="outline" className="text-xs">
                {skill.template}
              </Badge>
            </div>
          )}

          {/* E2B Info */}
          <div className="bg-muted/30 mt-2 rounded-lg p-3">
            <p className="text-muted-foreground text-xs leading-relaxed">
              Skills run Python code in secure sandboxes powered by E2B. Code execution
              is isolated and safe, with no access to your local machine.
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
