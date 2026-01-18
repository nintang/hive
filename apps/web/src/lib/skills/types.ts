/**
 * Skills type definitions
 *
 * Skills are code execution capabilities that can be enabled per-project.
 * They work with any LLM provider (model-agnostic) via E2B sandboxes.
 */

export type SkillCategory = "document" | "development" | "analysis" | "communication" | "creative"

export interface Skill {
  id: string
  name: string
  icon: string
  description: string
  category: SkillCategory
  template: string // E2B sandbox template (e.g., "base", "data-analysis")
  packages: string[] // Python packages to install
  source?: string // Source URL (e.g., link to Anthropic skills repo)
}

export interface ProjectSkillConfig {
  id: string
  projectId: string
  skillId: string
  enabled: boolean
  createdAt: string
}

export interface ExecuteCodeParams {
  code: string
  language: "python" | "javascript"
  skillId?: string // Optional - determines which sandbox template to use
}

export interface ExecuteCodeResult {
  success: boolean
  output: string
  error?: string
  files: GeneratedFile[]
  executionTimeMs: number
}

export interface GeneratedFile {
  name: string
  path: string // Path in sandbox
  size: number
  mimeType: string
  downloadUrl?: string // S3 URL after upload
}

export interface SandboxFile {
  name: string
  content: Uint8Array | string
}
