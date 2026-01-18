import { syncRecentMessages } from "@/app/components/chat/syncRecentMessages"
import { useChatDraft } from "@/app/hooks/use-chat-draft"
import { toast } from "@/components/ui/toast"
import { getOrCreateGuestUserId } from "@/lib/api"
import { useChats } from "@/lib/chat-store/chats/provider"
import { MESSAGE_MAX_LENGTH, SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import { Attachment } from "@/lib/file-handling"
import { API_ROUTE_CHAT } from "@/lib/routes"
import type { UserProfile } from "@/lib/user/types"
import type { Message as MessageAISDK } from "@ai-sdk/ui-utils"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

// Re-export Message type for backwards compatibility
// Using the Message type from @ai-sdk/ui-utils which includes content field
export type Message = MessageAISDK

// Helper to extract text content from message (handles both old content and new parts format)
export function getMessageContent(message: Message): string {
  // First check if message has content field (old format)
  if (message.content) return message.content
  // Then check for parts array (new UIMessage format)
  // Join with double newlines for multi-step tool responses
  if (message.parts) {
    return message.parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("\n\n")
  }
  return ""
}

// Helper to create a Message with content (compatible with both old and new formats)
function createUserMessage(
  id: string,
  content: string,
  attachments?: Array<{ name: string; contentType: string; url: string }>
): Message {
  return {
    id,
    role: "user",
    content,
    parts: [{ type: "text", text: content }],
    createdAt: new Date(),
    experimental_attachments: attachments,
  } as Message
}

type UseChatCoreProps = {
  initialMessages: Message[]
  draftValue: string
  cacheAndAddMessage: (message: Message) => void
  chatId: string | null
  user: UserProfile | null
  files: File[]
  createOptimisticAttachments: (
    files: File[]
  ) => Array<{ name: string; contentType: string; url: string }>
  setFiles: (files: File[]) => void
  checkLimitsAndNotify: (uid: string) => Promise<boolean>
  cleanupOptimisticAttachments: (attachments?: Array<{ url?: string }>) => void
  ensureChatExists: (uid: string, input: string) => Promise<string | null>
  handleFileUploads: (
    uid: string,
    chatId: string
  ) => Promise<Attachment[] | null>
  selectedModel: string
  clearDraft: () => void
  bumpChat: (chatId: string) => void
  selectedConnectionIds: string[]
}

export function useChatCore({
  initialMessages,
  draftValue,
  cacheAndAddMessage,
  chatId,
  user,
  files,
  createOptimisticAttachments,
  setFiles,
  checkLimitsAndNotify,
  cleanupOptimisticAttachments,
  ensureChatExists,
  handleFileUploads,
  selectedModel,
  clearDraft,
  bumpChat,
  selectedConnectionIds,
}: UseChatCoreProps) {
  // State management - AI SDK v6 requires manual input state management
  const [input, setInput] = useState(draftValue)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasDialogAuth, setHasDialogAuth] = useState(false)
  const [enableSearch, setEnableSearch] = useState(false)
  // Track whether we've sent a message in this session (used to prevent redirect)
  const [hasSentFirstMessage, setHasSentFirstMessage] = useState(false)

  // Refs and derived state
  const prevChatIdRef = useRef<string | null>(chatId)
  const isAuthenticated = useMemo(() => !!user?.id, [user?.id])
  const systemPrompt = useMemo(
    () => user?.system_prompt || SYSTEM_PROMPT_DEFAULT,
    [user?.system_prompt]
  )

  // Search params handling
  const searchParams = useSearchParams()
  const prompt = searchParams.get("prompt")

  // Chats operations
  const { updateTitle } = useChats()

  // Handle errors directly in onError callback
  const handleError = useCallback((error: Error) => {
    let errorMsg = error.message || "Something went wrong."

    if (errorMsg === "An error occurred" || errorMsg === "fetch failed") {
      errorMsg = "Something went wrong. Please try again."
    }

    toast({
      title: errorMsg,
      status: "error",
    })
  }, [])

  // Initialize useChat with AI SDK v6 API
  // Note: We cast between Message and UIMessage types at the boundary
  // because useChat v6 uses UIMessage (no 'data' role, requires 'parts')
  // but our persisted messages use Message (has 'data' role, has 'content')
  const chatResult = useChat({
    transport: new DefaultChatTransport({ api: API_ROUTE_CHAT }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: initialMessages as any,

    // AI SDK v6: Automatically resubmit when all server-side tool results are available
    // This enables multi-step tool execution where the model can use tool results
    // to generate follow-up responses or make additional tool calls
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,

    // Handle client-side tool calls (if any tools need client-side execution)
    // Server-side tools with execute() are handled automatically
    // Note: Server-side tools (Composio) have execute() functions and are handled
    // automatically. This callback is for client-side tools that need browser APIs
    // or user interaction. Currently all our tools are server-side.
    onToolCall: async () => {},

    onFinish: async ({ message }) => {
      // Cast UIMessage back to Message for caching
      cacheAndAddMessage(message as unknown as Message)
      try {
        const effectiveChatId =
          chatId ||
          prevChatIdRef.current ||
          (typeof window !== "undefined"
            ? localStorage.getItem("guestChatId")
            : null)

        if (!effectiveChatId) return

        // Sync message IDs with database
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await syncRecentMessages(effectiveChatId, chatResult.setMessages as any, 2)

        // Cache ALL current messages to IndexedDB so they persist on reload
        // This includes the user message that sendMessage added
        const { writeToIndexedDB } = await import("@/lib/chat-store/persist")
        await writeToIndexedDB("messages", {
          id: effectiveChatId,
          messages: chatResult.messages
        })
      } catch {
        // Message ID reconciliation failed silently
      }
    },
    onError: handleError,
  })

  // Destructure with type casting for compatibility
  const {
    sendMessage,
    regenerate,
    status,
    error,
    stop,
  } = chatResult

  // Cast messages and setMessages for Message compatibility
  const messages = chatResult.messages as unknown as Message[]
  const setMessages = chatResult.setMessages as unknown as React.Dispatch<
    React.SetStateAction<Message[]>
  >

  // Handle search params on mount
  useEffect(() => {
    if (prompt && typeof window !== "undefined") {
      requestAnimationFrame(() => setInput(prompt))
    }
  }, [prompt])

  // Track synced state to avoid re-syncing during active streaming session
  const syncedRef = useRef<{ chatId: string | null; loaded: boolean }>({
    chatId: null,
    loaded: false
  })

  // Sync messages when navigating to a different chat
  // Don't sync during active streaming - the SDK manages its own state
  useEffect(() => {
    // Reset tracking when navigating away
    if (!chatId) {
      syncedRef.current = { chatId: null, loaded: false }
      return
    }

    // If we're actively streaming/submitting, don't sync - SDK is managing messages
    if (status !== "ready") {
      // But track that we're on this chat
      if (syncedRef.current.chatId !== chatId) {
        syncedRef.current = { chatId, loaded: true } // Mark as loaded to skip future syncs
      }
      return
    }

    // If we navigated to a different chat, reset tracking
    if (syncedRef.current.chatId !== chatId) {
      syncedRef.current = { chatId, loaded: false }
    }

    // Sync if we haven't loaded yet AND we have messages to load
    if (!syncedRef.current.loaded && initialMessages.length > 0) {
      setMessages(initialMessages)
      syncedRef.current.loaded = true
    }
  }, [chatId, initialMessages, setMessages, status])

  // Reset messages when navigating from a chat to home
  useEffect(() => {
    if (
      prevChatIdRef.current !== null &&
      chatId === null &&
      messages.length > 0
    ) {
      setMessages([])
    }
    prevChatIdRef.current = chatId
  }, [chatId, messages.length, setMessages])

  // Submit action
  const submit = useCallback(async () => {
    if (!input.trim()) return

    setIsSubmitting(true)

    const uid = await getOrCreateGuestUserId(user)
    if (!uid) {
      setIsSubmitting(false)
      return
    }

    // Store and clear input/files immediately for responsive UX
    const submittedInput = input
    const submittedFiles = [...files]
    setInput("")
    setFiles([])

    const optimisticAttachments =
      submittedFiles.length > 0 ? createOptimisticAttachments(submittedFiles) : []

    try {
      const allowed = await checkLimitsAndNotify(uid)
      if (!allowed) {
        cleanupOptimisticAttachments(optimisticAttachments)
        return
      }

      const currentChatId = await ensureChatExists(uid, submittedInput)
      if (!currentChatId) {
        cleanupOptimisticAttachments(optimisticAttachments)
        return
      }

      prevChatIdRef.current = currentChatId

      if (submittedInput.length > MESSAGE_MAX_LENGTH) {
        toast({
          title: `The message you submitted was too long, please submit something shorter. (Max ${MESSAGE_MAX_LENGTH} characters)`,
          status: "error",
        })
        cleanupOptimisticAttachments(optimisticAttachments)
        return
      }

      let attachments: Attachment[] | null = []
      if (submittedFiles.length > 0) {
        attachments = await handleFileUploads(uid, currentChatId)
        if (attachments === null) {
          cleanupOptimisticAttachments(optimisticAttachments)
          return
        }
      }

      cleanupOptimisticAttachments(optimisticAttachments)

      // Use sendMessage - it handles adding the user message to state
      await sendMessage(
        { text: submittedInput },
        {
          body: {
            chatId: currentChatId,
            userId: uid,
            model: selectedModel,
            isAuthenticated,
            systemPrompt: systemPrompt || SYSTEM_PROMPT_DEFAULT,
            enableSearch,
            selectedConnectionIds,
          },
        }
      )

      clearDraft()
      setHasSentFirstMessage(true)

      if (messages.length > 0) {
        bumpChat(currentChatId)
      }
    } catch {
      cleanupOptimisticAttachments(optimisticAttachments)
      toast({ title: "Failed to send message", status: "error" })
    } finally {
      setIsSubmitting(false)
    }
  }, [
    user,
    files,
    createOptimisticAttachments,
    input,
    setFiles,
    checkLimitsAndNotify,
    cleanupOptimisticAttachments,
    ensureChatExists,
    handleFileUploads,
    selectedModel,
    isAuthenticated,
    systemPrompt,
    enableSearch,
    selectedConnectionIds,
    sendMessage,
    clearDraft,
    messages.length,
    bumpChat,
  ])

  const submitEdit = useCallback(
    async (messageId: string, newContent: string) => {
      // Block edits while sending/streaming
      if (isSubmitting || status === "submitted" || status === "streaming") {
        toast({
          title: "Please wait until the current message finishes sending.",
          status: "error",
        })
        return
      }

      if (!newContent.trim()) return

      if (!chatId) {
        toast({ title: "Missing chat.", status: "error" })
        return
      }

      // Find edited message
      const editIndex = messages.findIndex(
        (m) => String(m.id) === String(messageId)
      )
      if (editIndex === -1) {
        toast({ title: "Message not found", status: "error" })
        return
      }

      const target = messages[editIndex]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const createdAt = (target as any)?.createdAt
      const cutoffIso = createdAt?.toISOString?.()
      if (!cutoffIso) {
        console.error("Unable to locate message timestamp.")
        return
      }

      if (newContent.length > MESSAGE_MAX_LENGTH) {
        toast({
          title: `The message you submitted was too long, please submit something shorter. (Max ${MESSAGE_MAX_LENGTH} characters)`,
          status: "error",
        })
        return
      }

      // Store original messages for potential rollback
      const originalMessages = [...messages]

      const optimisticId = `optimistic-edit-${Date.now().toString()}`
      const optimisticEditedMessage = createUserMessage(optimisticId, newContent)

      try {
        const trimmedMessages = messages.slice(0, editIndex)
        setMessages([...trimmedMessages, optimisticEditedMessage])

        try {
          const { writeToIndexedDB } = await import("@/lib/chat-store/persist")
          await writeToIndexedDB("messages", {
            id: chatId,
            messages: trimmedMessages,
          })
        } catch {}

        // Get user validation
        const uid = await getOrCreateGuestUserId(user)
        if (!uid) {
          setMessages(originalMessages)
          toast({ title: "Please sign in and try again.", status: "error" })
          return
        }

        const allowed = await checkLimitsAndNotify(uid)
        if (!allowed) {
          setMessages(originalMessages)
          return
        }

        const currentChatId = await ensureChatExists(uid, newContent)
        if (!currentChatId) {
          setMessages(originalMessages)
          return
        }

        prevChatIdRef.current = currentChatId

        // If this is an edit of the very first user message, update chat title
        if (editIndex === 0 && target.role === "user") {
          try {
            await updateTitle(currentChatId, newContent)
          } catch {}
        }

        await sendMessage(
          { text: newContent },
          {
            body: {
              chatId: currentChatId,
              userId: uid,
              model: selectedModel,
              isAuthenticated,
              systemPrompt: systemPrompt || SYSTEM_PROMPT_DEFAULT,
              enableSearch,
              editCutoffTimestamp: cutoffIso,
              selectedConnectionIds,
            },
          }
        )

        // Remove optimistic message
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))

        bumpChat(currentChatId)
      } catch (error) {
        console.error("Edit failed:", error)
        setMessages(originalMessages)
        toast({ title: "Failed to apply edit", status: "error" })
      }
    },
    [
      chatId,
      messages,
      user,
      checkLimitsAndNotify,
      ensureChatExists,
      selectedModel,
      isAuthenticated,
      systemPrompt,
      enableSearch,
      selectedConnectionIds,
      sendMessage,
      setMessages,
      bumpChat,
      updateTitle,
      isSubmitting,
      status,
    ]
  )

  // Handle suggestion
  const handleSuggestion = useCallback(
    async (suggestion: string) => {
      setIsSubmitting(true)
      const optimisticId = `optimistic-${Date.now().toString()}`
      const optimisticMessage = createUserMessage(optimisticId, suggestion)

      setMessages((prev) => [...prev, optimisticMessage])

      try {
        const uid = await getOrCreateGuestUserId(user)

        if (!uid) {
          setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
          return
        }

        const allowed = await checkLimitsAndNotify(uid)
        if (!allowed) {
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
          return
        }

        const currentChatId = await ensureChatExists(uid, suggestion)

        if (!currentChatId) {
          setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
          return
        }

        prevChatIdRef.current = currentChatId

        await sendMessage(
          { text: suggestion },
          {
            body: {
              chatId: currentChatId,
              userId: uid,
              model: selectedModel,
              isAuthenticated,
              systemPrompt: SYSTEM_PROMPT_DEFAULT,
              selectedConnectionIds,
            },
          }
        )
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
      } catch {
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
        toast({ title: "Failed to send suggestion", status: "error" })
      } finally {
        setIsSubmitting(false)
      }
    },
    [
      ensureChatExists,
      selectedModel,
      user,
      sendMessage,
      checkLimitsAndNotify,
      isAuthenticated,
      selectedConnectionIds,
      setMessages,
    ]
  )

  // Handle reload (regenerate in v6)
  const handleReload = useCallback(async () => {
    const uid = await getOrCreateGuestUserId(user)
    if (!uid) {
      return
    }

    await regenerate({
      body: {
        chatId,
        userId: uid,
        model: selectedModel,
        isAuthenticated,
        systemPrompt: systemPrompt || SYSTEM_PROMPT_DEFAULT,
        selectedConnectionIds,
      },
    })
  }, [user, chatId, selectedModel, isAuthenticated, systemPrompt, selectedConnectionIds, regenerate])

  // Handle input change
  const { setDraftValue } = useChatDraft(chatId)
  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value)
      setDraftValue(value)
    },
    [setDraftValue]
  )

  // Stub handleSubmit for backwards compatibility
  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault()
      submit()
    },
    [submit]
  )

  // Stub append for backwards compatibility
  const append = useCallback(
    async (message: { role: string; content: string }, options?: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await sendMessage({ text: message.content }, options as any)
    },
    [sendMessage]
  )

  // Stub reload for backwards compatibility (maps to regenerate)
  const reload = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (options?: any) => {
      await regenerate(options)
    },
    [regenerate]
  )

  return {
    // Chat state
    messages,
    input,
    handleSubmit,
    status,
    error,
    reload,
    stop,
    setMessages,
    setInput,
    append,
    isAuthenticated,
    systemPrompt,
    hasSentFirstMessage,

    // Component state
    isSubmitting,
    setIsSubmitting,
    hasDialogAuth,
    setHasDialogAuth,
    enableSearch,
    setEnableSearch,

    // Actions
    submit,
    handleSuggestion,
    handleReload,
    handleInputChange,
    submitEdit,

    // Helper function
    getMessageContent,
  }
}
