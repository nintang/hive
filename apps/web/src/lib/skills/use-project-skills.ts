"use client"

/**
 * Hook to manage project skills
 */

import { useCallback, useEffect, useState } from "react"
import type { Skill } from "./types"

export type ProjectSkill = Skill & {
  projectSkillId: string
  enabled: boolean
}

export function useProjectSkills(projectId: string | null) {
  const [skills, setSkills] = useState<ProjectSkill[]>([])
  const [allSkills, setAllSkills] = useState<Skill[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch all available skills
  const fetchAllSkills = useCallback(async () => {
    try {
      const res = await fetch("/api/skills")
      if (!res.ok) throw new Error("Failed to fetch skills")
      const data = await res.json()
      setAllSkills(data.skills)
    } catch (err) {
      console.error("Error fetching all skills:", err)
    }
  }, [])

  // Fetch project skills
  const fetchProjectSkills = useCallback(async () => {
    if (!projectId) {
      setSkills([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/projects/${projectId}/skills`)
      if (!res.ok) throw new Error("Failed to fetch project skills")
      const data = await res.json()
      setSkills(
        data.skills.map((s: ProjectSkill & { id: string }) => ({
          ...s,
          projectSkillId: s.id,
        }))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  // Enable a skill for the project
  const enableSkill = useCallback(
    async (skillId: string) => {
      if (!projectId) return

      try {
        const res = await fetch(`/api/projects/${projectId}/skills`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skillId }),
        })

        if (!res.ok) throw new Error("Failed to enable skill")

        // Refresh the list
        await fetchProjectSkills()
      } catch (err) {
        console.error("Error enabling skill:", err)
        throw err
      }
    },
    [projectId, fetchProjectSkills]
  )

  // Disable a skill for the project
  const disableSkill = useCallback(
    async (skillId: string) => {
      if (!projectId) return

      try {
        const res = await fetch(
          `/api/projects/${projectId}/skills?skillId=${skillId}`,
          { method: "DELETE" }
        )

        if (!res.ok) throw new Error("Failed to disable skill")

        // Refresh the list
        await fetchProjectSkills()
      } catch (err) {
        console.error("Error disabling skill:", err)
        throw err
      }
    },
    [projectId, fetchProjectSkills]
  )

  // Get enabled skill IDs
  const enabledSkillIds = skills.filter((s) => s.enabled).map((s) => s.id)

  // Check if a skill is enabled
  const isSkillEnabled = useCallback(
    (skillId: string) => enabledSkillIds.includes(skillId),
    [enabledSkillIds]
  )

  // Initial fetch
  useEffect(() => {
    fetchAllSkills()
  }, [fetchAllSkills])

  useEffect(() => {
    fetchProjectSkills()
  }, [fetchProjectSkills])

  return {
    skills,
    allSkills,
    isLoading,
    error,
    enableSkill,
    disableSkill,
    isSkillEnabled,
    enabledSkillIds,
    refetch: fetchProjectSkills,
  }
}
