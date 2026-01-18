/**
 * Skills Executor
 *
 * Creates the execute_code tool that can be used with any LLM via Vercel AI SDK.
 * Handles sandbox lifecycle, code execution, and file uploads to Cloudflare R2.
 */

import { z } from "zod"
import { tool } from "ai"
import type { ExecuteCodeResult } from "./types"
import { createSandbox, executeInSandbox, downloadSandboxFile } from "./e2b"
import { uploadFileToS3 } from "./files"

/**
 * Create the execute_code tool for use with Vercel AI SDK streamText
 */
export function createExecuteCodeTool(options: {
  skillIds: string[]
  userId: string
  chatId: string
}) {
  const { skillIds, userId, chatId } = options

  return tool({
    description: `Execute Python code in a secure sandbox environment. Use this to:
- Create Excel spreadsheets, PowerPoint presentations, or PDFs
- Generate charts and data visualizations
- Analyze data from CSV or JSON
- Run calculations and data transformations
- Create files that can be downloaded by the user

The sandbox has pandas, numpy, matplotlib, seaborn, plotly, openpyxl, python-pptx, and other common libraries pre-installed.

IMPORTANT:
- Save output files to the current directory (e.g., 'output.xlsx', 'chart.png')
- Use print() statements to show results to the user
- Files you create will be automatically uploaded and made available for download`,

    inputSchema: z.object({
      code: z.string().describe("The Python code to execute"),
      language: z
        .enum(["python", "javascript"])
        .default("python")
        .describe("Programming language (default: python)"),
    }),

    execute: async ({ code, language }) => {
      console.log(`[Skills] Executing ${language} code for user ${userId}, chat ${chatId}`)
      console.log(`[Skills] Enabled skills: ${skillIds.join(", ")}`)

      let sandbox = null

      try {
        // Create sandbox with appropriate template based on enabled skills
        sandbox = await createSandbox({
          skillIds,
          timeout: 120_000, // 2 minute timeout for code execution
        })

        // Execute the code
        const result = await executeInSandbox(sandbox, code, language)

        // Upload any generated files to R2
        if (result.success && result.files.length > 0) {
          console.log(`[Skills] Uploading ${result.files.length} files to R2`)

          for (const file of result.files) {
            const fileContent = await downloadSandboxFile(sandbox, file.path)
            if (fileContent) {
              const downloadUrl = await uploadFileToS3({
                userId,
                chatId,
                fileName: file.name,
                content: fileContent.content,
                mimeType: file.mimeType,
              })

              if (downloadUrl) {
                file.downloadUrl = downloadUrl
              }
            }
          }
        }

        // Close the sandbox
        await sandbox.kill()

        // Format the result for the LLM
        return formatResultForLLM(result)
      } catch (error) {
        // Ensure sandbox is closed on error
        if (sandbox) {
          try {
            await sandbox.kill()
          } catch {
            // Ignore close errors
          }
        }

        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[Skills] Execution failed:`, errorMessage)

        return {
          success: false,
          output: "",
          error: errorMessage,
          files: [],
        }
      }
    },
  })
}

/**
 * Format execution result for the LLM response
 */
function formatResultForLLM(result: ExecuteCodeResult): {
  success: boolean
  output: string
  error?: string
  files: Array<{ name: string; downloadUrl?: string; size: number }>
} {
  const files = result.files.map((f) => ({
    name: f.name,
    downloadUrl: f.downloadUrl,
    size: f.size,
  }))

  if (!result.success) {
    return {
      success: false,
      output: result.output,
      error: result.error,
      files,
    }
  }

  // Build a summary message
  let output = result.output

  if (files.length > 0) {
    const fileList = files
      .map((f) => {
        const sizeKb = (f.size / 1024).toFixed(1)
        return `- ${f.name} (${sizeKb} KB)${f.downloadUrl ? " - Ready for download" : ""}`
      })
      .join("\n")

    output += `\n\n**Generated Files:**\n${fileList}`
  }

  return {
    success: true,
    output,
    files,
  }
}

/**
 * Build skills tools for a project
 * Returns a ToolSet compatible with Vercel AI SDK streamText
 */
export function buildSkillsTools(options: {
  skillIds: string[]
  userId: string
  chatId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Record<string, any> {
  const { skillIds, userId, chatId } = options

  // Only include execute_code tool if skills are enabled
  if (skillIds.length === 0) {
    return {}
  }

  return {
    execute_code: createExecuteCodeTool({ skillIds, userId, chatId }),
  }
}
