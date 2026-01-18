/**
 * Skills Module
 *
 * Model-agnostic code execution via E2B sandboxes.
 * Works with any LLM provider (Claude, GPT, Gemini, etc.)
 */

// Types
export * from "./types"

// Registry
export { SKILLS, getSkill, getAllSkills, getSkillsByCategory } from "./registry"

// Executor (creates Vercel AI SDK tools)
export { createExecuteCodeTool, buildSkillsTools } from "./executor"

// E2B sandbox utilities
export { createSandbox, executeInSandbox, downloadSandboxFile } from "./e2b"

// File handling
export { uploadFileToS3, getSignedDownloadUrl } from "./files"
