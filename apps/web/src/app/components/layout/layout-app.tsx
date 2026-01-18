"use client"

import { Header } from "@/app/components/layout/header"
import { AppSidebar } from "@/app/components/layout/sidebar/app-sidebar"
import { useUserPreferences } from "@/lib/user-preference-store/provider"
import { useSyncExternalStore } from "react"

// Subscribe function that does nothing (we never re-subscribe)
const subscribe = () => () => {}
// Server snapshot always returns false
const getServerSnapshot = () => false
// Client snapshot always returns true
const getClientSnapshot = () => true

export function LayoutApp({ children }: { children: React.ReactNode }) {
  const { preferences } = useUserPreferences()
  // Use useSyncExternalStore to detect client-side rendering without triggering React Compiler warnings
  const mounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)

  const hasSidebar = preferences.layout === "sidebar"

  return (
    <div className="bg-background flex h-dvh w-full overflow-hidden">
      {mounted && hasSidebar && <AppSidebar />}
      <main className="@container relative h-dvh w-0 flex-shrink flex-grow overflow-y-auto">
        <Header hasSidebar={mounted && hasSidebar} />
        {children}
      </main>
    </div>
  )
}
