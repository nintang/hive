/**
 * Project Skills API
 *
 * GET /api/projects/[projectId]/skills - Get enabled skills for a project
 * POST /api/projects/[projectId]/skills - Enable a skill for a project
 * DELETE /api/projects/[projectId]/skills - Disable a skill for a project
 */

import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { eq, and } from "drizzle-orm"
import { getDb, isD1Enabled, projects, projectSkills } from "@/lib/db"
import { getSkill, SKILLS } from "@/lib/skills"

type RouteContext = {
  params: Promise<{ projectId: string }>
}

/**
 * GET - List enabled skills for a project
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params

    if (!isD1Enabled()) {
      // Return empty skills list if D1 not enabled
      return NextResponse.json({ skills: [] })
    }

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = getDb()

    // Verify user owns the project
    const project = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .get()

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Get enabled skills for this project
    const enabledSkills = await db
      .select()
      .from(projectSkills)
      .where(and(eq(projectSkills.projectId, projectId), eq(projectSkills.enabled, true)))
      .all()

    // Enrich with skill details from registry
    const skillsWithDetails = enabledSkills
      .map((ps) => {
        const skill = getSkill(ps.skillId)
        if (!skill) return null
        return {
          ...skill,
          projectSkillId: ps.id,
          enabled: ps.enabled,
        }
      })
      .filter(Boolean)

    return NextResponse.json({ skills: skillsWithDetails })
  } catch (error) {
    console.error("[Project Skills API] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch project skills" }, { status: 500 })
  }
}

/**
 * POST - Enable a skill for a project
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params
    const { skillId } = await request.json()

    if (!skillId) {
      return NextResponse.json({ error: "skillId is required" }, { status: 400 })
    }

    // Verify skill exists in registry
    if (!SKILLS[skillId]) {
      return NextResponse.json({ error: "Invalid skill ID" }, { status: 400 })
    }

    if (!isD1Enabled()) {
      return NextResponse.json({ error: "Database not available" }, { status: 503 })
    }

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = getDb()

    // Verify user owns the project
    const project = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .get()

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Check if skill already exists for this project
    const existing = await db
      .select()
      .from(projectSkills)
      .where(and(eq(projectSkills.projectId, projectId), eq(projectSkills.skillId, skillId)))
      .get()

    if (existing) {
      // Update existing to enabled
      await db
        .update(projectSkills)
        .set({ enabled: true })
        .where(eq(projectSkills.id, existing.id))
        .run()

      return NextResponse.json({
        id: existing.id,
        skillId,
        enabled: true,
        message: "Skill enabled",
      })
    }

    // Create new project skill entry
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await db
      .insert(projectSkills)
      .values({
        id,
        projectId,
        skillId,
        enabled: true,
        createdAt: now,
      })
      .run()

    const skill = getSkill(skillId)

    return NextResponse.json({
      id,
      skillId,
      enabled: true,
      ...skill,
      message: "Skill added to project",
    })
  } catch (error) {
    console.error("[Project Skills API] POST error:", error)
    return NextResponse.json({ error: "Failed to enable skill" }, { status: 500 })
  }
}

/**
 * DELETE - Disable a skill for a project
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params
    const { searchParams } = new URL(request.url)
    const skillId = searchParams.get("skillId")

    if (!skillId) {
      return NextResponse.json({ error: "skillId is required" }, { status: 400 })
    }

    if (!isD1Enabled()) {
      return NextResponse.json({ error: "Database not available" }, { status: 503 })
    }

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = getDb()

    // Verify user owns the project
    const project = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .get()

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Disable the skill (don't delete, just set enabled = false)
    await db
      .update(projectSkills)
      .set({ enabled: false })
      .where(and(eq(projectSkills.projectId, projectId), eq(projectSkills.skillId, skillId)))
      .run()

    return NextResponse.json({
      skillId,
      enabled: false,
      message: "Skill disabled",
    })
  } catch (error) {
    console.error("[Project Skills API] DELETE error:", error)
    return NextResponse.json({ error: "Failed to disable skill" }, { status: 500 })
  }
}
