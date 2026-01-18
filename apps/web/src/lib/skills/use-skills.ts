"use client"

/**
 * Hook to fetch all available skills (page-level, not project-specific)
 */

import { useCallback, useEffect, useState } from "react"
import type { Skill } from "./types"

export function useSkills() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSkills = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/skills")
      if (!res.ok) throw new Error("Failed to fetch skills")
      const data = await res.json()
      setSkills(data.skills)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

  return {
    skills,
    isLoading,
    error,
    refetch: fetchSkills,
  }
}
