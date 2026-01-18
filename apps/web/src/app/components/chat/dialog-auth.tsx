"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SignInButton } from "@clerk/nextjs"

type DialogAuthProps = {
  open: boolean
  setOpen: (open: boolean) => void
}

export function DialogAuth({ open, setOpen }: DialogAuthProps) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">
            You&apos;ve reached the limit for today
          </DialogTitle>
          <DialogDescription className="pt-2 text-base">
            Sign in below to increase your message limits.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-6 sm:justify-center">
          <SignInButton mode="modal">
            <Button
              variant="secondary"
              className="w-full text-base"
              size="lg"
            >
              <img
                src="https://www.google.com/favicon.ico"
                alt="Google logo"
                width={20}
                height={20}
                className="mr-2 size-4"
              />
              <span>Sign in</span>
            </Button>
          </SignInButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
