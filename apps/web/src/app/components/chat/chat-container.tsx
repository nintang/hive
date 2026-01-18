"use client"

import { MultiChat } from "@/app/components/multi-chat/multi-chat"
import { useUserPreferences } from "@/lib/user-preference-store/provider"
import { Suspense } from "react"
import { Chat } from "./chat"

function ChatContent() {
  const { preferences } = useUserPreferences()
  const multiModelEnabled = preferences.multiModelEnabled

  if (multiModelEnabled) {
    return <MultiChat />
  }

  return <Chat />
}

export function ChatContainer() {
  return (
    <Suspense fallback={null}>
      <ChatContent />
    </Suspense>
  )
}
