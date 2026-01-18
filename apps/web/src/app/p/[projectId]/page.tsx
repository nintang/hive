import { LayoutApp } from "@/app/components/layout/layout-app"
import { ProjectView } from "@/app/p/[projectId]/project-view"
import { MessagesProvider } from "@/lib/chat-store/messages/provider"
import { getMockUserId, getProject } from "@/lib/mock/projects-store"
import { getDb, isD1Enabled, projects } from "@/lib/db"
import { auth } from "@clerk/nextjs/server"
import { eq, and } from "drizzle-orm"
import { redirect } from "next/navigation"

type Props = {
  params: Promise<{ projectId: string }>
}

export default async function Page({ params }: Props) {
  const { projectId } = await params

  if (isD1Enabled()) {
    const { userId } = await auth()

    if (!userId) {
      redirect("/")
    }

    const db = getDb()
    // Verify the project belongs to the user
    const project = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .get()

    if (!project) {
      redirect("/")
    }
  } else {
    // Mock mode: verify project exists in mock store
    const mockUserId = getMockUserId()
    const project = getProject(projectId, mockUserId)
    if (!project) {
      redirect("/")
    }
  }

  return (
    <MessagesProvider>
      <LayoutApp>
        <ProjectView projectId={projectId} key={projectId} />
      </LayoutApp>
    </MessagesProvider>
  )
}
