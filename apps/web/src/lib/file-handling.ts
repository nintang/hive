import { toast } from "@/components/ui/toast"
import * as fileType from "file-type"
import { DAILY_FILE_UPLOAD_LIMIT } from "./config"
import { isD1Enabled, getDb, chatAttachments } from "./db"
import { eq, gte, and } from "drizzle-orm"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]

export type Attachment = {
  name: string
  contentType: string
  url: string
}

export async function validateFile(
  file: File
): Promise<{ isValid: boolean; error?: string }> {
  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
    }
  }

  const buffer = await file.arrayBuffer()
  const type = await fileType.fileTypeFromBuffer(
    Buffer.from(buffer.slice(0, 4100))
  )

  if (!type || !ALLOWED_FILE_TYPES.includes(type.mime)) {
    return {
      isValid: false,
      error: "File type not supported or doesn't match its extension",
    }
  }

  return { isValid: true }
}

export function createAttachment(file: File, url: string): Attachment {
  return {
    name: file.name,
    contentType: file.type,
    url,
  }
}

export async function processFiles(
  files: File[],
  chatId: string,
  userId: string
): Promise<Attachment[]> {
  const attachments: Attachment[] = []

  for (const file of files) {
    const validation = await validateFile(file)
    if (!validation.isValid) {
      console.warn(`File ${file.name} validation failed:`, validation.error)
      toast({
        title: "File validation failed",
        description: validation.error,
        status: "error",
      })
      continue
    }

    try {
      // For now, use object URLs (files are sent as base64 in the message)
      // R2 storage integration will be added later
      const url = URL.createObjectURL(file)

      // Track attachment in database if D1 is enabled
      if (isD1Enabled()) {
        const db = getDb()
        await db
          .insert(chatAttachments)
          .values({
            id: crypto.randomUUID(),
            chatId,
            userId,
            fileUrl: url,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            createdAt: new Date().toISOString(),
          })
          .run()
      }

      attachments.push(createAttachment(file, url))
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error)
    }
  }

  return attachments
}

export class FileUploadLimitError extends Error {
  code: string
  constructor(message: string) {
    super(message)
    this.code = "DAILY_FILE_LIMIT_REACHED"
  }
}

export async function checkFileUploadLimit(userId: string) {
  if (!isD1Enabled()) return 0

  const db = getDb()

  const now = new Date()
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )

  const result = await db
    .select({ id: chatAttachments.id })
    .from(chatAttachments)
    .where(
      and(
        eq(chatAttachments.userId, userId),
        gte(chatAttachments.createdAt, startOfToday.toISOString())
      )
    )
    .all()

  const count = result.length

  if (count >= DAILY_FILE_UPLOAD_LIMIT) {
    throw new FileUploadLimitError("Daily file upload limit reached.")
  }

  return count
}
