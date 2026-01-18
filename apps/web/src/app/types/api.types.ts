import type { Attachment } from "@ai-sdk/ui-utils"
import type { getDb } from "@/lib/db"

// Json type for compatibility
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Database client type
export type DbClient = ReturnType<typeof getDb>

export interface ContentPart {
  type: string
  text?: string
  toolCallId?: string
  toolName?: string
  args?: Json
  result?: Json
  toolInvocation?: {
    state: string
    step: number
    toolCallId: string
    toolName: string
    args?: Json
    result?: Json
  }
  reasoning?: string
  details?: Json[]
}

export interface Message {
  role: "user" | "assistant" | "system" | "data" | "tool" | "tool-call"
  content: string | null | ContentPart[]
  reasoning?: string
}

export interface ChatApiParams {
  userId: string
  model: string
  isAuthenticated: boolean
}

export interface LogUserMessageParams {
  db: DbClient
  userId: string
  chatId: string
  content: string
  attachments?: Attachment[]
  model: string
  isAuthenticated: boolean
  message_group_id?: string
}

export interface StoreAssistantMessageParams {
  db: DbClient
  chatId: string
  messages: Message[]
  message_group_id?: string
  model?: string
}

export interface ApiErrorResponse {
  error: string
  details?: string
}

export interface ApiSuccessResponse<T = unknown> {
  success: true
  data?: T
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse
