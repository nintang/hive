import {
  createProject as createMockProject,
  getAllProjects as getAllMockProjects,
  getMockUserId,
} from "@/lib/mock/projects-store"
import { getDb, isD1Enabled, projects, projectSkills } from "@/lib/db"
import { auth } from "@clerk/nextjs/server"
import { eq, asc } from "drizzle-orm"
import { NextResponse } from "next/server"
import { SKILLS } from "@/lib/skills"

export async function POST(request: Request) {
  try {
    const { name, skillIds = [] } = await request.json()

    // If D1 is not available, use mock store
    if (!isD1Enabled()) {
      const userId = getMockUserId()
      const project = createMockProject(name, userId)
      return NextResponse.json(project)
    }

    const { userId } = await auth()

    if (!userId) {
      // Fall back to mock if not authenticated
      const mockId = getMockUserId()
      const project = createMockProject(name, mockId)
      return NextResponse.json(project)
    }

    const db = getDb()
    const projectId = crypto.randomUUID()
    const now = new Date().toISOString()

    await db
      .insert(projects)
      .values({
        id: projectId,
        name,
        userId,
        createdAt: now,
      })
      .run()

    // Enable selected skills for the project
    if (skillIds.length > 0) {
      const validSkillIds = skillIds.filter((id: string) => SKILLS[id])
      for (const skillId of validSkillIds) {
        await db
          .insert(projectSkills)
          .values({
            id: crypto.randomUUID(),
            projectId,
            skillId,
            enabled: true,
            createdAt: now,
          })
          .run()
      }
    }

    const data = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .get()

    if (!data) {
      return NextResponse.json({ error: "Failed to create project" }, { status: 500 })
    }

    // Return in snake_case format for backwards compatibility
    return NextResponse.json({
      id: data.id,
      name: data.name,
      user_id: data.userId,
      created_at: data.createdAt,
      skill_ids: skillIds,
    })
  } catch (err: unknown) {
    console.error("Error in projects endpoint:", err)

    return new Response(
      JSON.stringify({
        error: (err as Error).message || "Internal server error",
      }),
      { status: 500 }
    )
  }
}

export async function GET() {
  // If D1 is not available, use mock store
  if (!isD1Enabled()) {
    const userId = getMockUserId()
    const projectsList = getAllMockProjects(userId)
    return NextResponse.json(projectsList)
  }

  const { userId } = await auth()

  if (!userId) {
    // Fall back to mock if not authenticated
    const mockUserId = getMockUserId()
    const projectsList = getAllMockProjects(mockUserId)
    return NextResponse.json(projectsList)
  }

  const db = getDb()
  const data = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(asc(projects.createdAt))
    .all()

  // Return in snake_case format for backwards compatibility
  return NextResponse.json(
    data.map((p) => ({
      id: p.id,
      name: p.name,
      user_id: p.userId,
      created_at: p.createdAt,
    }))
  )
}
