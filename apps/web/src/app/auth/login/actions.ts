"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function signOut() {
  const { userId } = await auth()

  if (!userId) {
    // Not signed in, just redirect
    redirect("/")
    return
  }

  // Clerk handles sign out through its own middleware and components
  // Redirect to Clerk's sign-out route
  revalidatePath("/", "layout")
  redirect("/sign-out")
}
