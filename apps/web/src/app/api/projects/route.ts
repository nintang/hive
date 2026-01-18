import {
  createProject,
  getAllProjects,
  getMockUserId,
} from "@/lib/mock/projects-store"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { name } = await request.json()

    // If Supabase is not available, use mock store
    if (!supabase) {
      const userId = getMockUserId()
      const project = createProject(name, userId)
      return NextResponse.json(project)
    }

    const { data: authData } = await supabase.auth.getUser()

    if (!authData?.user?.id) {
      // Fall back to mock if not authenticated
      const userId = getMockUserId()
      const project = createProject(name, userId)
      return NextResponse.json(project)
    }

    const userId = authData.user.id

    const { data, error } = await supabase
      .from("projects")
      .insert({ name, user_id: userId })
      .select()
      .single()

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
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
  const supabase = await createClient()

  // If Supabase is not available, use mock store
  if (!supabase) {
    const userId = getMockUserId()
    const projects = getAllProjects(userId)
    return NextResponse.json(projects)
  }

  const { data: authData } = await supabase.auth.getUser()

  const userId = authData?.user?.id
  if (!userId) {
    // Fall back to mock if not authenticated
    const mockUserId = getMockUserId()
    const projects = getAllProjects(mockUserId)
    return NextResponse.json(projects)
  }

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
