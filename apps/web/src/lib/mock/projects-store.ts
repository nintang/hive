// Mock in-memory store for projects (for testing without a database)
// This data will be lost when the server restarts

type Project = {
  id: string
  name: string
  user_id: string
  created_at: string
}

// In-memory store
const projectsStore: Map<string, Project> = new Map()

// Mock user ID for testing
const MOCK_USER_ID = "mock-user-123"

export function getMockUserId(): string {
  return MOCK_USER_ID
}

export function getAllProjects(userId: string): Project[] {
  return Array.from(projectsStore.values())
    .filter((p) => p.user_id === userId)
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
}

export function getProject(projectId: string, userId: string): Project | null {
  const project = projectsStore.get(projectId)
  if (project && project.user_id === userId) {
    return project
  }
  return null
}

export function createProject(name: string, userId: string): Project {
  const id = `project-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const project: Project = {
    id,
    name,
    user_id: userId,
    created_at: new Date().toISOString(),
  }
  projectsStore.set(id, project)
  return project
}

export function updateProject(
  projectId: string,
  name: string,
  userId: string
): Project | null {
  const project = projectsStore.get(projectId)
  if (project && project.user_id === userId) {
    project.name = name
    projectsStore.set(projectId, project)
    return project
  }
  return null
}

export function deleteProject(projectId: string, userId: string): boolean {
  const project = projectsStore.get(projectId)
  if (project && project.user_id === userId) {
    projectsStore.delete(projectId)
    return true
  }
  return false
}
