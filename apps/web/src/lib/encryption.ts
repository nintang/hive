import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
const ALGORITHM = "aes-256-gcm"

// Only validate and create key if ENCRYPTION_KEY is provided
const key = ENCRYPTION_KEY ? Buffer.from(ENCRYPTION_KEY, "base64") : null

if (key && key.length !== 32) {
  throw new Error("ENCRYPTION_KEY must be 32 bytes long")
}

export function encryptKey(plaintext: string): {
  encrypted: string
  iv: string
} {
  if (!key) {
    // Return a mock encryption when no key is configured (for UI-only mode)
    return {
      encrypted: Buffer.from(plaintext).toString("base64") + ":mock",
      iv: randomBytes(16).toString("hex"),
    }
  }

  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, "utf8", "hex")
  encrypted += cipher.final("hex")

  const authTag = cipher.getAuthTag()
  const encryptedWithTag = encrypted + ":" + authTag.toString("hex")

  return {
    encrypted: encryptedWithTag,
    iv: iv.toString("hex"),
  }
}

export function decryptKey(encryptedData: string, ivHex: string): string {
  if (!key) {
    // Return mock decryption when no key is configured (for UI-only mode)
    const [data] = encryptedData.split(":mock")
    if (data) {
      return Buffer.from(data, "base64").toString("utf8")
    }
    return ""
  }

  const [encrypted, authTagHex] = encryptedData.split(":")
  const iv = Buffer.from(ivHex, "hex")
  const authTag = Buffer.from(authTagHex, "hex")

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, "hex", "utf8")
  decrypted += decipher.final("utf8")

  return decrypted
}

export function maskKey(key: string): string {
  if (key.length <= 8) {
    return "*".repeat(key.length)
  }
  return key.slice(0, 4) + "*".repeat(key.length - 8) + key.slice(-4)
}
