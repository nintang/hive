/**
 * File Handling for Skills
 *
 * Handles uploading generated files from E2B sandboxes to Cloudflare R2
 * and generating signed download URLs.
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

// R2 client singleton (S3-compatible)
let r2Client: S3Client | null = null

function getR2Client(): S3Client {
  if (!r2Client) {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
    if (!accountId) {
      throw new Error("CLOUDFLARE_ACCOUNT_ID not configured")
    }

    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "",
      },
    })
  }
  return r2Client
}

/**
 * Check if R2 is configured
 */
export function isR2Enabled(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
      process.env.CLOUDFLARE_R2_BUCKET
  )
}

/**
 * Upload a file to R2 and return the download URL
 */
export async function uploadFileToR2(options: {
  userId: string
  chatId: string
  fileName: string
  content: Uint8Array | string
  mimeType: string
}): Promise<string | null> {
  const { userId, chatId, fileName, content, mimeType } = options

  const bucket = process.env.CLOUDFLARE_R2_BUCKET
  if (!bucket) {
    console.error("[Skills/R2] CLOUDFLARE_R2_BUCKET not configured")
    return null
  }

  try {
    // Generate a unique key for the file
    const timestamp = Date.now()
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_")
    const key = `skills/${userId}/${chatId}/${timestamp}-${sanitizedFileName}`

    console.log(`[Skills/R2] Uploading ${fileName} to ${bucket}/${key}`)

    const client = getR2Client()

    // Upload the file
    // For string content (from E2B file read), use 'binary' encoding to preserve raw bytes
    // E2B returns binary file content as a string with each byte as a character
    const body = typeof content === "string"
      ? Buffer.from(content, "binary")
      : content

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: mimeType,
        ContentDisposition: `attachment; filename="${fileName}"`,
      })
    )

    // Generate a signed download URL (valid for 7 days)
    const downloadUrl = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
      { expiresIn: 7 * 24 * 60 * 60 } // 7 days
    )

    console.log(`[Skills/R2] Upload complete: ${key}`)
    return downloadUrl
  } catch (error) {
    console.error("[Skills/R2] Upload failed:", error)
    return null
  }
}

/**
 * Generate a signed URL for an existing R2 object
 */
export async function getSignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string | null> {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET
  if (!bucket) {
    return null
  }

  try {
    const client = getR2Client()
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
      { expiresIn }
    )
    return url
  } catch (error) {
    console.error("[Skills/R2] Failed to generate signed URL:", error)
    return null
  }
}

// Legacy export for backwards compatibility
export const uploadFileToS3 = uploadFileToR2
