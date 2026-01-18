"use client"

import { ChatInput } from "@/app/components/chat-input/chat-input"
import type { ToolMode } from "@/app/components/chat-input/button-tool-mode"
import { Conversation } from "@/app/components/chat/conversation"
import { useChatOperations } from "@/app/components/chat/use-chat-operations"
import { useConnectionSelection } from "@/app/components/chat/use-connection-selection"
import { useFileUpload } from "@/app/components/chat/use-file-upload"
import { useModel } from "@/app/components/chat/use-model"
import { ProjectChatItem } from "@/app/components/layout/sidebar/project-chat-item"
import { toast } from "@/components/ui/toast"
import { useChats } from "@/lib/chat-store/chats/provider"
import { useMessages } from "@/lib/chat-store/messages/provider"
import { MESSAGE_MAX_LENGTH, SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import { API_ROUTE_CHAT } from "@/lib/routes"
import { useUser } from "@/lib/user-store/provider"
import { cn } from "@/lib/utils"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { ChatCircleIcon } from "@phosphor-icons/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"

type Project = {
  id: string
  name: string
  user_id: string
  last_model_id: string | null
  last_connection_ids: string[] | null
  created_at: string
}

type ProjectViewProps = {
  projectId: string
}

export function ProjectView({ projectId }: ProjectViewProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [enableSearch, setEnableSearch] = useState(false)
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const { user } = useUser()
  const { createNewChat } = useChats()
  useMessages() // Keep provider mounted
  const pathname = usePathname()
  const router = useRouter()
  const {
    files,
    handleFileUpload,
    handleFileRemove,
  } = useFileUpload()

  // Fetch project details
  const { data: project } = useQuery<Project>({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch project")
      }
      return response.json()
    },
  })

  // Get chats from the chat store and filter for this project
  const { chats: allChats } = useChats()

  // Filter chats for this project
  const chats = allChats.filter((chat) => chat.project_id === projectId)

  const isAuthenticated = useMemo(() => !!user?.id, [user?.id])

  // Handle errors directly in onError callback
  const handleError = useCallback((error: Error) => {
    let errorMsg = "Something went wrong."
    try {
      const parsed = JSON.parse(error.message)
      errorMsg = parsed.error || errorMsg
    } catch {
      errorMsg = error.message || errorMsg
    }
    toast({
      title: errorMsg,
      status: "error",
    })
  }, [])

  // AI SDK v6: input state must be managed manually
  const [input, setInput] = useState("")

  const {
    messages,
    status,
    regenerate,
    stop,
    setMessages,
  } = useChat({
    id: `project-${projectId}-${currentChatId}`,
    // AI SDK v6: Use transport instead of api
    transport: new DefaultChatTransport({ api: API_ROUTE_CHAT }),
    // AI SDK v6: Use messages instead of initialMessages
    messages: [],
    onError: handleError,
  })

  const queryClient = useQueryClient()

  // Function to update project settings
  const updateProjectSettings = useCallback(
    async (updates: { lastModelId?: string; lastConnectionIds?: string[] }) => {
      try {
        await fetch(`/api/projects/${projectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        })
        // Invalidate project query to refetch
        queryClient.invalidateQueries({ queryKey: ["project", projectId] })
      } catch (error) {
        console.error("Failed to update project settings:", error)
      }
    },
    [projectId, queryClient]
  )

  // Model selection - use project's lastModelId if available
  const { selectedModel, handleModelChange: baseHandleModelChange } = useModel({
    currentChat: null,
    user,
    updateChatModel: () => Promise.resolve(),
    chatId: null,
    lastModelId: project?.last_model_id ?? undefined,
  })

  // Wrap handleModelChange to persist to project
  const handleModelChange = useCallback(
    (modelId: string) => {
      baseHandleModelChange(modelId)
      updateProjectSettings({ lastModelId: modelId })
    },
    [baseHandleModelChange, updateProjectSettings]
  )

  // Connection selection - use project's lastConnectionIds if available
  const {
    selectedConnectionId,
    setSelectedConnectionId: baseSetSelectedConnectionId,
    selectedConnectionIds,
    setSelectedConnectionIds: baseSetSelectedConnectionIds,
  } = useConnectionSelection({
    initialConnectionIds: project?.last_connection_ids ?? undefined,
  })

  // Wrap connection setters to persist to project
  const setSelectedConnectionId = useCallback(
    (connectionId: string | undefined) => {
      baseSetSelectedConnectionId(connectionId)
      updateProjectSettings({ lastConnectionIds: connectionId ? [connectionId] : [] })
    },
    [baseSetSelectedConnectionId, updateProjectSettings]
  )

  const setSelectedConnectionIds = useCallback(
    (connectionIds: string[]) => {
      baseSetSelectedConnectionIds(connectionIds)
      updateProjectSettings({ lastConnectionIds: connectionIds })
    },
    [baseSetSelectedConnectionIds, updateProjectSettings]
  )

  // Tool mode state
  const [toolMode, setToolMode] = useState<ToolMode>("single")

  // Simplified ensureChatExists for authenticated project context
  const ensureChatExists = useCallback(
    async (userId: string) => {
      // If we already have a current chat ID, return it
      if (currentChatId) {
        return currentChatId
      }

      // Only create a new chat if we haven't started one yet
      if (messages.length === 0) {
        try {
          const newChat = await createNewChat(
            userId,
            input,
            selectedModel,
            true, // Always authenticated in this context
            SYSTEM_PROMPT_DEFAULT,
            projectId
          )

          if (!newChat) return null

          setCurrentChatId(newChat.id)
          // Navigate to the chat page with prompt param - let the chat page send the message
          // This ensures the chat page's useChat instance handles the streaming
          const encodedPrompt = encodeURIComponent(input)
          router.push(`/c/${newChat.id}?prompt=${encodedPrompt}&autosubmit=true`)
          return newChat.id
        } catch (err: unknown) {
          let errorMessage = "Something went wrong."
          try {
            const errorObj = err as { message?: string }
            if (errorObj.message) {
              const parsed = JSON.parse(errorObj.message)
              errorMessage = parsed.error || errorMessage
            }
          } catch {
            const errorObj = err as { message?: string }
            errorMessage = errorObj.message || errorMessage
          }
          toast({
            title: errorMessage,
            status: "error",
          })
          return null
        }
      }

      return currentChatId
    },
    [
      currentChatId,
      messages.length,
      createNewChat,
      input,
      selectedModel,
      projectId,
    ]
  )

  const { handleDelete, handleEdit } = useChatOperations({
    isAuthenticated: true, // Always authenticated in project context
    chatId: null,
    messages,
    selectedModel,
    systemPrompt: SYSTEM_PROMPT_DEFAULT,
    createNewChat,
    setHasDialogAuth: () => {}, // Not used in project context
    setMessages,
    setInput,
  })

  // Simple input change handler for project context (no draft saving needed)
  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value)
    },
    [setInput]
  )

  const submit = useCallback(async () => {
    if (!input.trim()) return

    setIsSubmitting(true)

    if (!user?.id) {
      setIsSubmitting(false)
      return
    }

    if (input.length > MESSAGE_MAX_LENGTH) {
      toast({
        title: `The message you submitted was too long, please submit something shorter. (Max ${MESSAGE_MAX_LENGTH} characters)`,
        status: "error",
      })
      setIsSubmitting(false)
      return
    }

    try {
      // Create the chat and navigate - the chat page will handle sending the message
      // ensureChatExists will navigate to /c/[chatId]?prompt=...&autosubmit=true
      await ensureChatExists(user.id)
    } catch {
      toast({ title: "Failed to create chat", status: "error" })
    } finally {
      setIsSubmitting(false)
    }
  }, [user, input, ensureChatExists])

  const handleReload = useCallback(async () => {
    if (!user?.id) {
      return
    }

    const options = {
      body: {
        chatId: null,
        userId: user.id,
        model: selectedModel,
        isAuthenticated: true,
        systemPrompt: SYSTEM_PROMPT_DEFAULT,
        projectId,
      },
    }

    regenerate(options)
  }, [user, selectedModel, regenerate, projectId])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  // Memoize the conversation props to prevent unnecessary rerenders
  const conversationProps = useMemo(
    () => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: messages as any,
      status,
      onDelete: handleDelete,
      onEdit: handleEdit,
      onReload: handleReload,
    }),
    [messages, status, handleDelete, handleEdit, handleReload]
  )

  // Memoize the chat input props
  const chatInputProps = useMemo(
    () => ({
      value: input,
      onSuggestion: () => {},
      onValueChange: handleInputChange,
      onSend: submit,
      isSubmitting,
      files,
      onFileUpload: handleFileUpload,
      onFileRemove: handleFileRemove,
      hasSuggestions: false,
      onSelectModel: handleModelChange,
      selectedModel,
      isUserAuthenticated: isAuthenticated,
      stop,
      status,
      setEnableSearch,
      enableSearch,
      projectId,
      // Connection selection props
      selectedConnectionId,
      onSelectConnection: setSelectedConnectionId,
      selectedConnectionIds,
      onSelectConnections: setSelectedConnectionIds,
      // Tool mode props
      toolMode,
      onToolModeChange: setToolMode,
      multiSelectConnections: toolMode === "multi",
    }),
    [
      input,
      handleInputChange,
      submit,
      isSubmitting,
      files,
      handleFileUpload,
      handleFileRemove,
      handleModelChange,
      selectedModel,
      isAuthenticated,
      stop,
      status,
      setEnableSearch,
      enableSearch,
      projectId,
      selectedConnectionId,
      setSelectedConnectionId,
      selectedConnectionIds,
      setSelectedConnectionIds,
      toolMode,
    ]
  )

  // Always show onboarding when on project page, regardless of messages
  const showOnboarding = pathname === `/p/${projectId}`

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col items-center overflow-x-hidden overflow-y-auto",
        showOnboarding && chats.length === 0
          ? "justify-center pt-0"
          : showOnboarding && chats.length > 0
            ? "justify-start pt-32"
            : "justify-end"
      )}
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
            transition={{
              layout: {
                duration: 0,
              },
            }}
          >
            <div className="mb-6 flex items-center justify-center gap-2">
              <ChatCircleIcon className="text-muted-foreground" size={24} />
              <h1 className="text-center text-3xl font-medium tracking-tight">
                {project?.name || ""}
              </h1>
            </div>
          </motion.div>
        ) : (
          <Conversation key="conversation" {...conversationProps} />
        )}
      </AnimatePresence>

      <motion.div
        className={cn(
          "relative inset-x-0 bottom-0 z-50 mx-auto w-full max-w-3xl"
        )}
        layout="position"
        layoutId="chat-input-container"
        transition={{
          layout: {
            duration: messages.length === 1 ? 0.3 : 0,
          },
        }}
      >
        <ChatInput {...chatInputProps} />
      </motion.div>

      {showOnboarding && chats.length > 0 ? (
        <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-20">
          <h2 className="text-muted-foreground mb-3 text-sm font-medium">
            Recent chats
          </h2>
          <div className="space-y-2">
            {chats.map((chat) => (
              <ProjectChatItem
                key={chat.id}
                chat={chat}
                formatDate={formatDate}
              />
            ))}
          </div>
        </div>
      ) : showOnboarding && chats.length === 0 ? (
        <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-20">
          <h2 className="text-muted-foreground mb-3 text-sm font-medium">
            No chats yet
          </h2>
        </div>
      ) : null}
    </div>
  )
}
