/**
 * Client-safe Skills exports
 *
 * This module exports only types and functions that can run in the browser.
 * It does NOT export e2b-related functions which require Node.js.
 *
 * Use this in client components ("use client") instead of the main index.
 */

// Types (safe for client)
export * from "./types"

// Registry functions (safe for client - no Node.js dependencies)
export { SKILLS, getSkill, getAllSkills, getSkillsByCategory } from "./registry"
