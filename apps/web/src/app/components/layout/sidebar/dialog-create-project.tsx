"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "@/components/ui/toast"
import { fetchClient } from "@/lib/fetch"
import type { Connection } from "@/lib/connections/types"
import { useConnections } from "@/lib/connections/use-connections"
import { getAllSkills, type Skill } from "@/lib/skills/client"
import { cn } from "@/lib/utils"
import {
  CheckIcon,
  MagnifyingGlassIcon,
  PlugsConnectedIcon,
  CodeIcon,
  FileXls,
  Presentation,
  FilePdf,
  FileDoc,
  ChartBar,
  Table,
  TestTube,
  Sparkle,
  Code,
} from "@phosphor-icons/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

// Icon mapping for skills
const skillIconMap: Record<string, React.ElementType> = {
  FileXls,
  Presentation,
  FilePdf,
  FileDoc,
  Code,
  BarChart: ChartBar,
  ChartBar,
  Table,
  TestTube,
  Sparkle,
}

type DialogCreateProjectProps = {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}

type CreateProjectData = {
  id: string
  name: string
  user_id: string
  created_at: string
}

export function DialogCreateProject({
  isOpen,
  setIsOpen,
}: DialogCreateProjectProps) {
  const [projectName, setProjectName] = useState("")
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>([])
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const queryClient = useQueryClient()
  const router = useRouter()

  const { connections, isLoading: isLoadingConnections } = useConnections()
  const allSkills = useMemo(() => getAllSkills(), [])

  // Only show connected connections as available members
  const connectedConnections = useMemo(() => {
    return connections.filter((c) => c.connected)
  }, [connections])

  // Filter by search query
  const filteredConnections = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return connectedConnections

    return connectedConnections.filter(
      (conn) =>
        conn.name.toLowerCase().includes(query) ||
        conn.description.toLowerCase().includes(query)
    )
  }, [connectedConnections, searchQuery])

  // Get selected connection objects
  const selectedConnections = useMemo(() => {
    return connectedConnections.filter((c) => selectedConnectionIds.includes(c.id))
  }, [connectedConnections, selectedConnectionIds])

  const handleConnectionToggle = (connectionId: string) => {
    setSelectedConnectionIds((prev) =>
      prev.includes(connectionId)
        ? prev.filter((id) => id !== connectionId)
        : [...prev, connectionId]
    )
  }

  const handleSkillToggle = (skillId: string) => {
    setSelectedSkillIds((prev) =>
      prev.includes(skillId)
        ? prev.filter((id) => id !== skillId)
        : [...prev, skillId]
    )
  }

  // Get selected skill objects
  const selectedSkills = useMemo(() => {
    return allSkills.filter((s) => selectedSkillIds.includes(s.id))
  }, [allSkills, selectedSkillIds])

  const createProjectMutation = useMutation({
    mutationFn: async ({ name, skillIds, connectionIds }: { name: string; skillIds: string[]; connectionIds: string[] }): Promise<CreateProjectData> => {
      const response = await fetchClient("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, skillIds, connectionIds }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to create project")
      }

      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
      router.push(`/p/${data.id}`)
      resetForm()
      setIsOpen(false)
    },
    onError: (error: Error) => {
      toast({
        title: error.message || "Failed to create project",
        status: "error",
      })
    },
  })

  const resetForm = () => {
    setProjectName("")
    setSelectedConnectionIds([])
    setSelectedSkillIds([])
    setSearchQuery("")
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      resetForm()
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (projectName.trim()) {
      createProjectMutation.mutate({
        name: projectName.trim(),
        skillIds: selectedSkillIds,
        connectionIds: selectedConnectionIds,
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Create a chat with your connected tools.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Project Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Project Name</label>
              <Input
                placeholder="e.g., Work Team, Personal Tasks"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                autoFocus
              />
            </div>

            {/* Selected Connections Preview */}
            {selectedConnections.length > 0 && (
              <div className="space-y-2">
                <label className="text-muted-foreground text-sm">
                  Connections ({selectedConnections.length})
                </label>
                <div className="flex flex-wrap gap-2">
                  <AnimatePresence mode="popLayout">
                    {selectedConnections.map((connection) => (
                      <motion.div
                        key={connection.id}
                        layout
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.15 }}
                        className="bg-accent flex items-center gap-1.5 rounded-full py-1 pr-2 pl-1"
                      >
                        <div className="relative size-5 overflow-hidden rounded-full">
                          <Image
                            src={connection.logo}
                            alt={connection.name}
                            fill
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                        <span className="text-xs font-medium">
                          {connection.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleConnectionToggle(connection.id)}
                          className="hover:bg-accent-foreground/10 ml-0.5 rounded-full p-0.5"
                        >
                          <span className="text-muted-foreground text-xs">
                            ×
                          </span>
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Add Connections Section */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Connections</label>
              <div className="border-input rounded-lg border">
                {/* Search */}
                <div className="relative border-b">
                  <MagnifyingGlassIcon className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
                  <Input
                    placeholder="Search connections..."
                    className="rounded-b-none border-none pl-8 shadow-none focus-visible:ring-0"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Connection List */}
                <ScrollArea className="h-[140px]">
                  <div className="p-1">
                    {isLoadingConnections ? (
                      <div className="text-muted-foreground flex items-center justify-center py-8 text-sm">
                        Loading connections...
                      </div>
                    ) : filteredConnections.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <PlugsConnectedIcon className="text-muted-foreground mb-2 size-8" />
                        <p className="text-muted-foreground text-sm">
                          {searchQuery
                            ? "No matching connections"
                            : "No connections available"}
                        </p>
                        {!searchQuery && (
                          <p className="text-muted-foreground mt-1 text-xs">
                            Connect tools in the sidebar first
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        {filteredConnections.map((conn) => (
                          <ConnectionItem
                            key={conn.id}
                            connection={conn}
                            isSelected={selectedConnectionIds.includes(conn.id)}
                            onToggle={() => handleConnectionToggle(conn.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>

            {/* Selected Skills Preview */}
            {selectedSkills.length > 0 && (
              <div className="space-y-2">
                <label className="text-muted-foreground text-sm">
                  Skills ({selectedSkills.length})
                </label>
                <div className="flex flex-wrap gap-2">
                  <AnimatePresence mode="popLayout">
                    {selectedSkills.map((skill) => {
                      const IconComponent = skillIconMap[skill.icon] || Code
                      return (
                        <motion.div
                          key={skill.id}
                          layout
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.15 }}
                          className="bg-accent flex items-center gap-1.5 rounded-full py-1 pr-2 pl-1.5"
                        >
                          <IconComponent className="size-4" weight="duotone" />
                          <span className="text-xs font-medium">
                            {skill.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSkillToggle(skill.id)}
                            className="hover:bg-accent-foreground/10 ml-0.5 rounded-full p-0.5"
                          >
                            <span className="text-muted-foreground text-xs">
                              ×
                            </span>
                          </button>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Add Skills Section */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Skills</label>
              <p className="text-muted-foreground text-xs">
                Enable code execution capabilities for this project
              </p>
              <div className="border-input rounded-lg border">
                <ScrollArea className="h-[140px]">
                  <div className="p-1 space-y-0.5">
                    {allSkills.map((skill) => (
                      <SkillItem
                        key={skill.id}
                        skill={skill}
                        isSelected={selectedSkillIds.includes(skill.id)}
                        onToggle={() => handleSkillToggle(skill.id)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!projectName.trim() || createProjectMutation.isPending}
            >
              {createProjectMutation.isPending
                ? "Creating..."
                : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ConnectionItem({
  connection,
  isSelected,
  onToggle,
}: {
  connection: Connection
  isSelected: boolean
  onToggle: () => void
}) {
  return (
    <div
      className={cn(
        "hover:bg-accent/50 flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2",
        isSelected && "bg-accent"
      )}
      onClick={onToggle}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="relative size-6 flex-shrink-0 overflow-hidden rounded">
          <Image
            src={connection.logo}
            alt={connection.name}
            fill
            className="object-contain"
            unoptimized
          />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{connection.name}</span>
          <span className="text-muted-foreground truncate text-xs">
            {connection.toolsCount} tools
          </span>
        </div>
      </div>
      <div className="flex-shrink-0">
        {isSelected && <CheckIcon className="text-primary size-4" />}
      </div>
    </div>
  )
}

function SkillItem({
  skill,
  isSelected,
  onToggle,
}: {
  skill: Skill
  isSelected: boolean
  onToggle: () => void
}) {
  const IconComponent = skillIconMap[skill.icon] || Code
  return (
    <div
      className={cn(
        "hover:bg-accent/50 flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2",
        isSelected && "bg-accent"
      )}
      onClick={onToggle}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="bg-muted flex size-6 flex-shrink-0 items-center justify-center rounded">
          <IconComponent className="size-4" weight="duotone" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{skill.name}</span>
          <span className="text-muted-foreground truncate text-xs">
            {skill.category}
          </span>
        </div>
      </div>
      <div className="flex-shrink-0">
        {isSelected && <CheckIcon className="text-primary size-4" />}
      </div>
    </div>
  )
}
