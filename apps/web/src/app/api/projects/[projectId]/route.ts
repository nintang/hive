import {
  deleteProject as deleteMockProject,
  getMockUserId,
  getProject as getMockProject,
  updateProject as updateMockProject,
} from "@/lib/mock/projects-store"
import { getDb, isD1Enabled, projects } from "@/lib/db"
import { auth } from "@clerk/nextjs/server"
import { eq, and } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params

    // If D1 is not available, use mock store
    if (!isD1Enabled()) {
      const userId = getMockUserId()
      const project = getMockProject(projectId, userId)
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
      }
      return NextResponse.json(project)
    }

    const { userId } = await auth()

    if (!userId) {
      // Fall back to mock if not authenticated
      const mockId = getMockUserId()
      const project = getMockProject(projectId, mockId)
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
      }
      return NextResponse.json(project)
    }

    const db = getDb()
    const data = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .get()

    if (!data) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Return in snake_case format for backwards compatibility
    return NextResponse.json({
      id: data.id,
      name: data.name,
      user_id: data.userId,
      last_model_id: data.lastModelId,
      last_connection_ids: data.lastConnectionIds
        ? JSON.parse(data.lastConnectionIds)
        : null,
      created_at: data.createdAt,
    })
  } catch (err: unknown) {
    console.error("Error in project endpoint:", err)
    return new Response(
      JSON.stringify({
        error: (err as Error).message || "Internal server error",
      }),
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const body = await request.json()
    const { name, lastModelId, lastConnectionIds } = body

    // At least one field must be provided
    if (name === undefined && lastModelId === undefined && lastConnectionIds === undefined) {
      return NextResponse.json(
        { error: "At least one field (name, lastModelId, lastConnectionIds) is required" },
        { status: 400 }
      )
    }

    // If name is provided, it must not be empty
    if (name !== undefined && !name?.trim()) {
      return NextResponse.json(
        { error: "Project name cannot be empty" },
        { status: 400 }
      )
    }

    // If D1 is not available, use mock store
    if (!isD1Enabled()) {
      const userId = getMockUserId()
      if (name !== undefined) {
        const project = updateMockProject(projectId, name.trim(), userId)
        if (!project) {
          return NextResponse.json({ error: "Project not found" }, { status: 404 })
        }
        return NextResponse.json(project)
      }
      // Mock store doesn't support model/connection updates, just return success
      return NextResponse.json({ success: true })
    }

    const { userId } = await auth()

    if (!userId) {
      // Fall back to mock if not authenticated
      const mockId = getMockUserId()
      if (name !== undefined) {
        const project = updateMockProject(projectId, name.trim(), mockId)
        if (!project) {
          return NextResponse.json({ error: "Project not found" }, { status: 404 })
        }
        return NextResponse.json(project)
      }
      return NextResponse.json({ success: true })
    }

    const db = getDb()

    // Build the update object dynamically
    const updateData: {
      name?: string
      lastModelId?: string | null
      lastConnectionIds?: string | null
    } = {}

    if (name !== undefined) {
      updateData.name = name.trim()
    }
    if (lastModelId !== undefined) {
      updateData.lastModelId = lastModelId
    }
    if (lastConnectionIds !== undefined) {
      updateData.lastConnectionIds = lastConnectionIds
        ? JSON.stringify(lastConnectionIds)
        : null
    }

    await db
      .update(projects)
      .set(updateData)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .run()

    const data = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .get()

    if (!data) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Return in snake_case format for backwards compatibility
    return NextResponse.json({
      id: data.id,
      name: data.name,
      user_id: data.userId,
      last_model_id: data.lastModelId,
      last_connection_ids: data.lastConnectionIds
        ? JSON.parse(data.lastConnectionIds)
        : null,
      created_at: data.createdAt,
    })
  } catch (err: unknown) {
    console.error("Error updating project:", err)
    return new Response(
      JSON.stringify({
        error: (err as Error).message || "Internal server error",
      }),
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params

    // If D1 is not available, use mock store
    if (!isD1Enabled()) {
      const userId = getMockUserId()
      const deleted = deleteMockProject(projectId, userId)
      if (!deleted) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
      }
      return NextResponse.json({ success: true })
    }

    const { userId } = await auth()

    if (!userId) {
      // Fall back to mock if not authenticated
      const mockId = getMockUserId()
      const deleted = deleteMockProject(projectId, mockId)
      if (!deleted) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
      }
      return NextResponse.json({ success: true })
    }

    const db = getDb()

    // First verify the project exists and belongs to the user
    const project = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .get()

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Delete the project
    await db
      .delete(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .run()

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error("Error deleting project:", err)
    return new Response(
      JSON.stringify({
        error: (err as Error).message || "Internal server error",
      }),
      { status: 500 }
    )
  }
}
