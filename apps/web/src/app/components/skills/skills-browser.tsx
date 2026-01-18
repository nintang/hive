"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Skill, SkillCategory } from "@/lib/skills"
import { cn } from "@/lib/utils"
import { MagnifyingGlass, CircleNotch, ArrowSquareOut } from "@phosphor-icons/react"
import { useMemo, useState } from "react"
import { SkillCard } from "./skill-card"

type SkillsBrowserProps = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  allSkills: Skill[]
  enabledSkillIds: string[]
  onToggleSkill: (skillId: string) => Promise<void>
  isLoading?: boolean
}

const CATEGORIES: { id: SkillCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "document", label: "Documents" },
  { id: "development", label: "Development" },
  { id: "analysis", label: "Analysis" },
  { id: "creative", label: "Creative" },
]

export function SkillsBrowser({
  isOpen,
  onOpenChange,
  allSkills,
  enabledSkillIds,
  onToggleSkill,
  isLoading = false,
}: SkillsBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory | "all">("all")
  const [togglingSkillId, setTogglingSkillId] = useState<string | null>(null)

  const filteredSkills = useMemo(() => {
    let skills = allSkills

    // Filter by category
    if (selectedCategory !== "all") {
      skills = skills.filter((s) => s.category === selectedCategory)
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      skills = skills.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query)
      )
    }

    return skills
  }, [allSkills, selectedCategory, searchQuery])

  const handleToggleSkill = async (skillId: string) => {
    setTogglingSkillId(skillId)
    try {
      await onToggleSkill(skillId)
    } finally {
      setTogglingSkillId(null)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Skills Browser</DialogTitle>
          <DialogDescription>
            Add code execution skills to your project. Skills run Python code in secure
            sandboxes powered by E2B.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlass className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              placeholder="Search skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Category tabs */}
          <Tabs
            value={selectedCategory}
            onValueChange={(v) => setSelectedCategory(v as SkillCategory | "all")}
          >
            <TabsList className="w-full justify-start">
              {CATEGORIES.map((cat) => (
                <TabsTrigger key={cat.id} value={cat.id} className="text-xs">
                  {cat.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={selectedCategory} className="mt-4">
              {isLoading ? (
                <div className="flex h-[300px] items-center justify-center">
                  <CircleNotch className="text-muted-foreground size-6 animate-spin" />
                </div>
              ) : filteredSkills.length === 0 ? (
                <div className="flex h-[300px] flex-col items-center justify-center gap-2">
                  <p className="text-muted-foreground text-sm">No skills found</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {filteredSkills.map((skill) => (
                      <SkillCard
                        key={skill.id}
                        skill={skill}
                        enabled={enabledSkillIds.includes(skill.id)}
                        onToggle={handleToggleSkill}
                        isToggling={togglingSkillId === skill.id}
                        showSource
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="border-border flex items-center justify-between border-t pt-4">
            <p className="text-muted-foreground text-xs">
              {enabledSkillIds.length} skill{enabledSkillIds.length !== 1 ? "s" : ""}{" "}
              enabled
            </p>
            <a
              href="https://github.com/anthropics/skills"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
              )}
            >
              <ArrowSquareOut className="size-3" />
              Browse more skills
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
