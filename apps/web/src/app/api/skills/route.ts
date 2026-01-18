/**
 * Skills API
 *
 * GET /api/skills - List all available skills from the registry
 */

import { NextResponse } from "next/server"
import { getAllSkills, getSkillsByCategory } from "@/lib/skills"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")

    const skills = category
      ? getSkillsByCategory(category as "document" | "development" | "analysis" | "communication")
      : getAllSkills()

    return NextResponse.json({
      skills: skills.map((skill) => ({
        id: skill.id,
        name: skill.name,
        icon: skill.icon,
        description: skill.description,
        category: skill.category,
        template: skill.template,
        packages: skill.packages,
        source: skill.source,
      })),
    })
  } catch (error) {
    console.error("[Skills API] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch skills" },
      { status: 500 }
    )
  }
}
