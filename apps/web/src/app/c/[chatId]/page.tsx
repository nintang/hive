import { ChatContainer } from "@/app/components/chat/chat-container"
import { LayoutApp } from "@/app/components/layout/layout-app"
import { MessagesProvider } from "@/lib/chat-store/messages/provider"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

export default async function Page() {
  const { userId } = await auth()

  if (!userId) {
    redirect("/")
  }

  return (
    <MessagesProvider>
      <LayoutApp>
        <ChatContainer />
      </LayoutApp>
    </MessagesProvider>
  )
}
