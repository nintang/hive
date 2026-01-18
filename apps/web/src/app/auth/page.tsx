import { redirect } from "next/navigation"

// Redirect /auth to Clerk's sign-in page
export default function AuthPage() {
  redirect("/sign-in")
}
