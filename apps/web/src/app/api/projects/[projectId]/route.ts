import {
  deleteProject,
  getMockUserId,
  getProject,
  updateProject,
} from "@/lib/mock/projects-store"
import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const supabase = await createClient()

    // If Supabase is not available, use mock store
    if (!supabase) {
      const userId = getMockUserId()
      const project = getProject(projectId, userId)
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
      }
      return NextResponse.json(project)
    }

    const { data: authData } = await supabase.auth.getUser()

    if (!authData?.user?.id) {
      // Fall back to mock if not authenticated
      const userId = getMockUserId()
      const project = getProject(projectId, userId)
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
      }
      return NextResponse.json(project)
    }

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", authData.user.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    return NextResponse.json(data)
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
    const { name } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // If Supabase is not available, use mock store
    if (!supabase) {
      const userId = getMockUserId()
      const project = updateProject(projectId, name.trim(), userId)
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
      }
      return NextResponse.json(project)
    }

    const { data: authData } = await supabase.auth.getUser()

    if (!authData?.user?.id) {
      // Fall back to mock if not authenticated
      const userId = getMockUserId()
      const project = updateProject(projectId, name.trim(), userId)
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
      }
      return NextResponse.json(project)
    }

    const { data, error } = await supabase
      .from("projects")
      .update({ name: name.trim() })
      .eq("id", projectId)
      .eq("user_id", authData.user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    return NextResponse.json(data)
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
    const supabase = await createClient()

    // If Supabase is not available, use mock store
    if (!supabase) {
      const userId = getMockUserId()
      const deleted = deleteProject(projectId, userId)
      if (!deleted) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
      }
      return NextResponse.json({ success: true })
    }

    const { data: authData } = await supabase.auth.getUser()

    if (!authData?.user?.id) {
      // Fall back to mock if not authenticated
      const userId = getMockUserId()
      const deleted = deleteProject(projectId, userId)
      if (!deleted) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
      }
      return NextResponse.json({ success: true })
    }

    // First verify the project exists and belongs to the user
    const { data: project, error: fetchError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", authData.user.id)
      .single()

    if (fetchError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Delete the project (this will cascade delete related chats due to FK constraint)
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId)
      .eq("user_id", authData.user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

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
