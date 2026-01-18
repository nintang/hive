/**
 * E2B Sandbox Wrapper
 *
 * Provides a consistent interface for creating and managing E2B sandboxes.
 * Handles template selection, package installation, and file operations.
 */

import { Sandbox } from "@e2b/code-interpreter"
import type { ExecuteCodeResult, GeneratedFile, SandboxFile } from "./types"
import { getPackagesForSkills } from "./registry"

// Re-export Sandbox type for convenience
export type { Sandbox }

/**
 * Create a new E2B sandbox with the specified configuration
 */
export async function createSandbox(options: {
  skillIds?: string[]
  template?: string
  timeout?: number
}): Promise<Sandbox> {
  const { skillIds = [], timeout = 120_000 } = options

  // Use E2B's default code interpreter template
  // It comes with pandas, numpy, matplotlib, etc pre-installed
  console.log(`[E2B] Creating sandbox with default template...`)

  const sandbox = await Sandbox.create({ timeoutMs: timeout })

  // Wait for sandbox to fully initialize (Jupyter kernel startup)
  console.log(`[E2B] Waiting for sandbox to initialize...`)
  await new Promise((resolve) => setTimeout(resolve, 3000))

  // Install additional packages for the skills that aren't pre-installed
  const packages = getPackagesForSkills(skillIds)
  // Filter out packages that come pre-installed in the default template
  const preInstalled = ["pandas", "numpy", "matplotlib", "seaborn", "scipy", "openpyxl"]
  const packagesToInstall = packages.filter((p) => !preInstalled.includes(p))

  if (packagesToInstall.length > 0) {
    console.log(`[E2B] Installing additional packages: ${packagesToInstall.join(", ")}`)
    await sandbox.commands.run(`pip install -q ${packagesToInstall.join(" ")}`, { timeoutMs: 60_000 })
  }

  return sandbox
}

/**
 * Execute code in a sandbox and return structured results
 */
export async function executeInSandbox(
  sandbox: Sandbox,
  code: string,
  language: "python" | "javascript" = "python"
): Promise<ExecuteCodeResult> {
  const startTime = Date.now()

  try {
    console.log(`[E2B] Executing ${language} code (${code.length} chars)`)

    const execution = await sandbox.runCode(code, { language, timeoutMs: 60_000 })

    const executionTimeMs = Date.now() - startTime

    // Collect output from logs
    const output = execution.logs.stdout.join("\n")
    const errorOutput = execution.logs.stderr.join("\n")

    // Check for execution errors
    if (execution.error) {
      console.error(`[E2B] Execution error:`, execution.error)
      return {
        success: false,
        output,
        error: execution.error.value || execution.error.name || "Unknown error",
        files: [],
        executionTimeMs,
      }
    }

    // List files created in the sandbox
    const files = await listSandboxFiles(sandbox, "/home/user")

    console.log(`[E2B] Execution complete in ${executionTimeMs}ms, ${files.length} files created`)

    return {
      success: true,
      output: output + (errorOutput ? `\n\nStderr:\n${errorOutput}` : ""),
      files,
      executionTimeMs,
    }
  } catch (error) {
    const executionTimeMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[E2B] Sandbox error:`, errorMessage)

    return {
      success: false,
      output: "",
      error: errorMessage,
      files: [],
      executionTimeMs,
    }
  }
}

/**
 * List files in a sandbox directory (non-recursively)
 */
async function listSandboxFiles(sandbox: Sandbox, directory: string): Promise<GeneratedFile[]> {
  try {
    // List files in the directory
    const result = await sandbox.commands.run(
      `find ${directory} -maxdepth 2 -type f -name "*.xlsx" -o -name "*.pptx" -o -name "*.pdf" -o -name "*.png" -o -name "*.jpg" -o -name "*.csv" -o -name "*.json" -o -name "*.html" 2>/dev/null | head -20`
    )

    if (result.exitCode !== 0 || !result.stdout) {
      return []
    }

    const filePaths = result.stdout.split("\n").filter(Boolean)

    const files: GeneratedFile[] = []
    for (const filePath of filePaths) {
      // Get file info
      const statResult = await sandbox.commands.run(`stat -c '%s' "${filePath}" 2>/dev/null`)
      const size = parseInt(statResult.stdout?.trim() || "0", 10)

      const name = filePath.split("/").pop() || filePath
      const mimeType = getMimeType(name)

      files.push({
        name,
        path: filePath,
        size,
        mimeType,
      })
    }

    return files
  } catch (error) {
    console.error("[E2B] Error listing files:", error)
    return []
  }
}

/**
 * Download a file from the sandbox
 * Uses base64 encoding via Python to preserve binary data integrity
 * (E2B's files.read() corrupts binary files)
 */
export async function downloadSandboxFile(
  sandbox: Sandbox,
  filePath: string
): Promise<SandboxFile | null> {
  try {
    const name = filePath.split("/").pop() || filePath

    // Read file as base64 to preserve binary data
    // E2B's files.read() corrupts binary files, so we use Python to encode
    const result = await sandbox.runCode(`
import base64
with open('${filePath}', 'rb') as f:
    content = f.read()
    encoded = base64.b64encode(content).decode('ascii')
    print(encoded)
`, { language: "python", timeoutMs: 30_000 })

    if (result.error) {
      console.error(`[E2B] Error reading file ${filePath}:`, result.error)
      return null
    }

    const base64Content = result.logs.stdout.join("")
    if (!base64Content) {
      console.error(`[E2B] Empty base64 content for ${filePath}`)
      return null
    }

    // Decode base64 to buffer
    const content = Buffer.from(base64Content, "base64")

    return {
      name,
      content,
    }
  } catch (error) {
    console.error(`[E2B] Error downloading file ${filePath}:`, error)
    return null
  }
}

/**
 * Get MIME type for a file based on extension
 */
function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase()

  const mimeTypes: Record<string, string> = {
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    csv: "text/csv",
    json: "application/json",
    html: "text/html",
    txt: "text/plain",
  }

  return mimeTypes[ext || ""] || "application/octet-stream"
}
