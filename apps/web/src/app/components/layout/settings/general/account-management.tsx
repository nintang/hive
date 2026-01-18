"use client"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { clearAllIndexedDBStores } from "@/lib/chat-store/persist"
import { useClerk } from "@clerk/nextjs"
import { SignOut } from "@phosphor-icons/react"

export function AccountManagement() {
  const { signOut } = useClerk()

  const handleSignOut = async () => {
    try {
      // Clear local storage before signing out
      await clearAllIndexedDBStores()
      // Use a callback to force a hard navigation after sign out
      // This ensures all React state is cleared
      await signOut(() => {
        window.location.href = "/"
      })
    } catch (e) {
      console.error("Sign out failed:", e)
      toast({ title: "Failed to sign out", status: "error" })
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-sm font-medium">Account</h3>
        <p className="text-muted-foreground text-xs">Log out on this device</p>
      </div>
      <Button
        variant="default"
        size="sm"
        className="flex items-center gap-2"
        onClick={handleSignOut}
      >
        <SignOut className="size-4" />
        <span>Sign out</span>
      </Button>
    </div>
  )
}
