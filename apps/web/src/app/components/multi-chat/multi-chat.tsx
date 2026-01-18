"use client"

import { MultiModelConversation } from "@/app/components/multi-chat/multi-conversation"
import { toast } from "@/components/ui/toast"
import { getOrCreateGuestUserId } from "@/lib/api"
import { useChats } from "@/lib/chat-store/chats/provider"
import { useMessages } from "@/lib/chat-store/messages/provider"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import { useModel } from "@/lib/model-store/provider"
import { useUser } from "@/lib/user-store/provider"
import { cn } from "@/lib/utils"
import type { Message } from "@ai-sdk/ui-utils"
import { AnimatePresence, motion } from "motion/react"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { MultiChatInput } from "./multi-chat-input"
import { useMultiChat } from "./use-multi-chat"

type GroupedMessage = {
  userMessage: Message
  responses: {
    model: string
    message: Message
    isLoading?: boolean
    provider: string
  }[]
  onDelete: (model: string, id: string) => void
  onEdit: (model: string, id: string, newText: string) => void
  onReload: (model: string) => void
}

// Helper to extract text content from AI SDK v6 messages (which may use parts instead of content)
function getMessageContent(message: Message): string {
  if (message.content) return message.content
  if (message.parts) {
    const textPart = message.parts.find((part) => part.type === "text")
    if (textPart && "text" in textPart) return textPart.text
  }
  return ""
}

export function MultiChat() {
  const [prompt, setPrompt] = useState("")
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([])
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>(
    []
  )
  const [files, setFiles] = useState<File[]>([])
  const [multiChatId, setMultiChatId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mounted, setMounted] = useState(false)
  const hasAutosubmitted = useRef(false)
  const searchParams = useSearchParams()

  useEffect(() => {
    setMounted(true)
  }, [])

  const { user } = useUser()
  const { models } = useModel()
  const { chatId } = useChatSession()
  const { messages: persistedMessages, isLoading: messagesLoading } =
    useMessages()
  const { createNewChat } = useChats()

  const availableModels = useMemo(() => {
    return models.map((model) => ({
      id: model.id,
      name: model.name,
      provider: model.provider,
    }))
  }, [models])

  const modelsFromPersisted = useMemo(() => {
    return persistedMessages
      .filter((msg) => (msg as Message & { model?: string }).model)
      .map((msg) => (msg as Message & { model?: string }).model)
  }, [persistedMessages])

  const modelsFromLastGroup = useMemo(() => {
    const userMessages = persistedMessages.filter((msg) => msg.role === "user")
    if (userMessages.length === 0) return []

    const lastUserMessage = userMessages[userMessages.length - 1]
    const lastUserIndex = persistedMessages.indexOf(lastUserMessage)

    const modelsInLastGroup: string[] = []
    for (let i = lastUserIndex + 1; i < persistedMessages.length; i++) {
      const msg = persistedMessages[i]
      if (msg.role === "user") break
      const msgWithModel = msg as Message & { model?: string }
      if (msg.role === "assistant" && msgWithModel.model) {
        modelsInLastGroup.push(msgWithModel.model)
      }
    }
    return modelsInLastGroup
  }, [persistedMessages])

  const allModelsToMaintain = useMemo(() => {
    const combined = [...new Set([...selectedModelIds, ...modelsFromPersisted])]
    return availableModels.filter((model) => combined.includes(model.id))
  }, [availableModels, selectedModelIds, modelsFromPersisted])

  if (selectedModelIds.length === 0 && modelsFromLastGroup.length > 0) {
    setSelectedModelIds(modelsFromLastGroup)
  }

  const modelChats = useMultiChat(allModelsToMaintain)
  const systemPrompt = useMemo(
    () => user?.system_prompt || SYSTEM_PROMPT_DEFAULT,
    [user?.system_prompt]
  )
  const isAuthenticated = useMemo(() => !!user?.id, [user?.id])

  const createPersistedGroups = useCallback(() => {
    const persistedGroups: { [key: string]: GroupedMessage } = {}

    if (persistedMessages.length === 0) return persistedGroups

    const groups: {
      [key: string]: {
        userMessage: Message
        assistantMessages: Message[]
      }
    } = {}

    for (let i = 0; i < persistedMessages.length; i++) {
      const message = persistedMessages[i]

      if (message.role === "user") {
        const groupKey = getMessageContent(message)
        if (groupKey && !groups[groupKey]) {
          groups[groupKey] = {
            userMessage: message,
            assistantMessages: [],
          }
        }
      } else if (message.role === "assistant") {
        let associatedUserMessage = null
        for (let j = i - 1; j >= 0; j--) {
          if (persistedMessages[j].role === "user") {
            associatedUserMessage = persistedMessages[j]
            break
          }
        }

        if (associatedUserMessage) {
          const groupKey = getMessageContent(associatedUserMessage)
          if (groupKey && !groups[groupKey]) {
            groups[groupKey] = {
              userMessage: associatedUserMessage,
              assistantMessages: [],
            }
          }
          if (groupKey && groups[groupKey]) {
            groups[groupKey].assistantMessages.push(message)
          }
        }
      }
    }

    Object.entries(groups).forEach(([groupKey, group]) => {
      if (group.userMessage) {
        persistedGroups[groupKey] = {
          userMessage: group.userMessage,
          responses: group.assistantMessages.map((msg, index) => {
            const msgWithModel = msg as Message & { model?: string }
            const model =
              msgWithModel.model || selectedModelIds[index] || `model-${index}`
            const provider =
              models.find((m) => m.id === model)?.provider || "unknown"

            return {
              model,
              message: msg,
              isLoading: false,
              provider,
            }
          }),
          onDelete: () => {},
          onEdit: () => {},
          onReload: () => {},
        }
      }
    })

    return persistedGroups
  }, [persistedMessages, selectedModelIds, models])

  const messageGroups = useMemo(() => {
    const persistedGroups = createPersistedGroups()
    const liveGroups = { ...persistedGroups }

    modelChats.forEach((chat) => {
      for (let i = 0; i < chat.messages.length; i += 2) {
        const userMsg = chat.messages[i]
        const assistantMsg = chat.messages[i + 1]

        if (userMsg?.role === "user") {
          const groupKey = getMessageContent(userMsg)
          if (!groupKey) continue // Skip messages with no content

          if (!liveGroups[groupKey]) {
            liveGroups[groupKey] = {
              userMessage: userMsg,
              responses: [],
              onDelete: () => {},
              onEdit: () => {},
              onReload: () => {},
            }
          }

          if (assistantMsg?.role === "assistant") {
            const existingResponse = liveGroups[groupKey].responses.find(
              (r) => r.model === chat.model.id
            )

            if (!existingResponse) {
              liveGroups[groupKey].responses.push({
                model: chat.model.id,
                message: assistantMsg,
                isLoading: false,
                provider: chat.model.provider,
              })
            }
          } else if (
            chat.isLoading &&
            getMessageContent(userMsg) === prompt &&
            selectedModelIds.includes(chat.model.id)
          ) {
            const placeholderMessage: Message = {
              id: `loading-${chat.model.id}`,
              role: "assistant",
              content: "",
            }
            liveGroups[groupKey].responses.push({
              model: chat.model.id,
              message: placeholderMessage,
              isLoading: true,
              provider: chat.model.provider,
            })
          }
        }
      }
    })

    return Object.values(liveGroups)
  }, [createPersistedGroups, modelChats, prompt, selectedModelIds])

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim()) return

    if (selectedModelIds.length === 0) {
      toast({
        title: "No models selected",
        description: "Please select at least one model to chat with.",
        status: "error",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const uid = await getOrCreateGuestUserId(user)
      if (!uid) return

      const message_group_id = crypto.randomUUID()

      let chatIdToUse = multiChatId || chatId
      if (!chatIdToUse) {
        const createdChat = await createNewChat(
          uid,
          prompt,
          selectedModelIds[0],
          !!user?.id
        )
        if (!createdChat) {
          throw new Error("Failed to create chat")
        }
        chatIdToUse = createdChat.id
        setMultiChatId(chatIdToUse)
        window.history.pushState(null, "", `/c/${chatIdToUse}`)
      }

      const selectedChats = modelChats.filter((chat) =>
        selectedModelIds.includes(chat.model.id)
      )

      await Promise.all(
        selectedChats.map(async (chat) => {
          const options = {
            body: {
              chatId: chatIdToUse,
              userId: uid,
              model: chat.model.id,
              isAuthenticated: !!user?.id,
              systemPrompt: systemPrompt,
              enableSearch: false,
              message_group_id,
            },
          }

          chat.append({ role: "user", content: prompt }, options)
        })
      )

      setPrompt("")
      setFiles([])
    } catch (error) {
      console.error("Failed to send message:", error)
      toast({
        title: "Failed to send message",
        description: "Please try again.",
        status: "error",
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [
    prompt,
    selectedModelIds,
    user,
    modelChats,
    systemPrompt,
    multiChatId,
    chatId,
    createNewChat,
  ])

  const handleFileUpload = useCallback((newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles])
  }, [])

  const handleFileRemove = useCallback((fileToRemove: File) => {
    setFiles((prev) => prev.filter((file) => file !== fileToRemove))
  }, [])

  const handleStop = useCallback(() => {
    modelChats.forEach((chat) => {
      if (chat.isLoading && selectedModelIds.includes(chat.model.id)) {
        chat.stop()
      }
    })
  }, [modelChats, selectedModelIds])

  const anyLoading = useMemo(
    () =>
      modelChats.some(
        (chat) => chat.isLoading && selectedModelIds.includes(chat.model.id)
      ),
    [modelChats, selectedModelIds]
  )

  // Handle autosubmit from URL params (e.g., coming from project page)
  const urlPrompt = searchParams?.get("prompt")
  const autosubmit = searchParams?.get("autosubmit") === "true"
  const urlConnectionIds = searchParams?.get("connectionIds")

  useEffect(() => {
    if (
      autosubmit &&
      urlPrompt &&
      !hasAutosubmitted.current &&
      selectedModelIds.length > 0 &&
      !isSubmitting
    ) {
      hasAutosubmitted.current = true
      setPrompt(urlPrompt)

      // Parse connection IDs from URL if present
      if (urlConnectionIds) {
        try {
          const parsedIds = JSON.parse(decodeURIComponent(urlConnectionIds))
          if (Array.isArray(parsedIds)) {
            setSelectedConnectionIds(parsedIds)
          }
        } catch {
          // Ignore parse errors
        }
      }

      // Use setTimeout to ensure state is set before submitting
      setTimeout(() => {
        // Clean up URL
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href)
          url.searchParams.delete("prompt")
          url.searchParams.delete("autosubmit")
          url.searchParams.delete("connectionIds")
          window.history.replaceState(null, "", url.toString())
        }
      }, 100)
    }
  }, [autosubmit, urlPrompt, urlConnectionIds, selectedModelIds, isSubmitting])

  const conversationProps = useMemo(() => ({ messageGroups }), [messageGroups])

  const inputProps = useMemo(
    () => ({
      value: prompt,
      onValueChange: setPrompt,
      onSend: handleSubmit,
      isSubmitting,
      files,
      onFileUpload: handleFileUpload,
      onFileRemove: handleFileRemove,
      selectedModelIds,
      onSelectedModelIdsChange: setSelectedModelIds,
      isUserAuthenticated: isAuthenticated,
      stop: handleStop,
      status: anyLoading ? ("streaming" as const) : ("ready" as const),
      anyLoading,
      selectedConnectionIds,
      onSelectedConnectionIdsChange: setSelectedConnectionIds,
    }),
    [
      prompt,
      handleSubmit,
      isSubmitting,
      files,
      handleFileUpload,
      handleFileRemove,
      selectedModelIds,
      isAuthenticated,
      handleStop,
      anyLoading,
      selectedConnectionIds,
    ]
  )

  // Defer showOnboarding calculation until after hydration to prevent mismatch
  const showOnboarding = mounted && messageGroups.length === 0 && !messagesLoading

  return (
    <div
      className={cn(
        "@container/main relative flex h-full flex-col items-center",
        showOnboarding ? "justify-end md:justify-center" : "justify-end"
      )}
      suppressHydrationWarning
    >
      <AnimatePresence initial={false} mode="popLayout">
        {showOnboarding ? (
          <motion.div
            key="onboarding"
            className="absolute bottom-[60%] mx-auto max-w-[50rem] md:relative md:bottom-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            layout="position"
            layoutId="onboarding"
            transition={{ layout: { duration: 0 } }}
          >
            <h1 className="mb-6 text-3xl font-medium tracking-tight">
              What&apos;s on your mind?
            </h1>
          </motion.div>
        ) : (
          <motion.div
            key="conversation"
            className="w-full flex-1 overflow-hidden"
            layout="position"
            layoutId="conversation"
            transition={{
              layout: { duration: messageGroups.length === 1 ? 0.3 : 0 },
            }}
          >
            <MultiModelConversation {...conversationProps} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className={cn(
          "z-50 mx-auto w-full max-w-3xl",
          showOnboarding ? "relative" : "absolute right-0 bottom-0 left-0"
        )}
        layout="position"
        layoutId="multi-chat-input-container"
        transition={{
          layout: { duration: messageGroups.length === 1 ? 0.3 : 0 },
        }}
      >
        <MultiChatInput {...inputProps} />
      </motion.div>
    </div>
  )
}
