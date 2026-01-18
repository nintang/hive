import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core"
import { relations } from "drizzle-orm"

// Users table
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  profileImage: text("profile_image"),
  anonymous: integer("anonymous", { mode: "boolean" }).default(false),
  premium: integer("premium", { mode: "boolean" }).default(false),
  messageCount: integer("message_count").default(0),
  dailyMessageCount: integer("daily_message_count").default(0),
  dailyReset: text("daily_reset"),
  dailyProMessageCount: integer("daily_pro_message_count").default(0),
  dailyProReset: text("daily_pro_reset"),
  favoriteModels: text("favorite_models"),
  systemPrompt: text("system_prompt"),
  createdAt: text("created_at"),
  lastActiveAt: text("last_active_at"),
})

// Projects table
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  lastModelId: text("last_model_id"),
  lastConnectionIds: text("last_connection_ids"), // JSON array of toolkit slugs
  createdAt: text("created_at"),
})

// Project skills table (junction table - skills are defined in code registry)
export const projectSkills = sqliteTable("project_skills", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  skillId: text("skill_id").notNull(), // References built-in skill registry
  enabled: integer("enabled", { mode: "boolean" }).default(true),
  createdAt: text("created_at"),
})

// Chats table
export const chats = sqliteTable("chats", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  projectId: text("project_id").references(() => projects.id),
  title: text("title"),
  model: text("model"),
  public: integer("public", { mode: "boolean" }).default(false),
  pinned: integer("pinned", { mode: "boolean" }).default(false),
  pinnedAt: text("pinned_at"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
})

// Messages table
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id),
  userId: text("user_id").references(() => users.id),
  role: text("role", { enum: ["system", "user", "assistant", "data"] }).notNull(),
  content: text("content"),
  parts: text("parts", { mode: "json" }),
  experimentalAttachments: text("experimental_attachments", { mode: "json" }),
  messageGroupId: text("message_group_id"),
  model: text("model"),
  createdAt: text("created_at"),
})

// Chat attachments table
export const chatAttachments = sqliteTable("chat_attachments", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  createdAt: text("created_at").notNull(),
})

// User keys table (for encrypted API keys)
export const userKeys = sqliteTable(
  "user_keys",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    provider: text("provider").notNull(),
    encryptedKey: text("encrypted_key").notNull(),
    iv: text("iv").notNull(),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
  },
  (table) => [primaryKey({ columns: [table.userId, table.provider] })]
)

// User preferences table (one-to-one with users)
export const userPreferences = sqliteTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  layout: text("layout"),
  promptSuggestions: integer("prompt_suggestions", { mode: "boolean" }),
  showToolInvocations: integer("show_tool_invocations", { mode: "boolean" }),
  showConversationPreviews: integer("show_conversation_previews", { mode: "boolean" }),
  multiModelEnabled: integer("multi_model_enabled", { mode: "boolean" }),
  hiddenModels: text("hidden_models"),
  // Persisted chat settings
  lastModelId: text("last_model_id"),
  lastConnectionIds: text("last_connection_ids"), // JSON array of toolkit slugs
  toolMode: text("tool_mode"), // "single" or "multi"
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
})

// Feedback table
export const feedback = sqliteTable("feedback", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  message: text("message").notNull(),
  createdAt: text("created_at"),
})

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  chats: many(chats),
  messages: many(messages),
  projects: many(projects),
  chatAttachments: many(chatAttachments),
  userKeys: many(userKeys),
  preferences: one(userPreferences),
  feedback: many(feedback),
  connectedAccounts: many(connectedAccounts),
  connectionRequests: many(connectionRequests),
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  chats: many(chats),
  skills: many(projectSkills),
}))

export const projectSkillsRelations = relations(projectSkills, ({ one }) => ({
  project: one(projects, {
    fields: [projectSkills.projectId],
    references: [projects.id],
  }),
}))

export const chatsRelations = relations(chats, ({ one, many }) => ({
  user: one(users, {
    fields: [chats.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [chats.projectId],
    references: [projects.id],
  }),
  messages: many(messages),
  attachments: many(chatAttachments),
}))

export const messagesRelations = relations(messages, ({ one }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id],
  }),
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
}))

export const chatAttachmentsRelations = relations(chatAttachments, ({ one }) => ({
  chat: one(chats, {
    fields: [chatAttachments.chatId],
    references: [chats.id],
  }),
  user: one(users, {
    fields: [chatAttachments.userId],
    references: [users.id],
  }),
}))

export const userKeysRelations = relations(userKeys, ({ one }) => ({
  user: one(users, {
    fields: [userKeys.userId],
    references: [users.id],
  }),
}))

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
  }),
}))

export const feedbackRelations = relations(feedback, ({ one }) => ({
  user: one(users, {
    fields: [feedback.userId],
    references: [users.id],
  }),
}))

// Connected accounts table for Composio integrations
export const connectedAccounts = sqliteTable("connected_accounts", {
  id: text("id").primaryKey(), // Composio connection ID
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  toolkitSlug: text("toolkit_slug").notNull(),
  toolkitName: text("toolkit_name").notNull(),
  toolkitLogo: text("toolkit_logo"),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})

// Pending connection requests (for OAuth flow tracking)
export const connectionRequests = sqliteTable("connection_requests", {
  id: text("id").primaryKey(), // Connection request ID from Composio
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  toolkitSlug: text("toolkit_slug").notNull(),
  status: text("status").notNull().default("PENDING"),
  createdAt: text("created_at").notNull(),
})

export const connectedAccountsRelations = relations(connectedAccounts, ({ one }) => ({
  user: one(users, {
    fields: [connectedAccounts.userId],
    references: [users.id],
  }),
}))

export const connectionRequestsRelations = relations(connectionRequests, ({ one }) => ({
  user: one(users, {
    fields: [connectionRequests.userId],
    references: [users.id],
  }),
}))

// Type exports for use in the application
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Chat = typeof chats.$inferSelect
export type NewChat = typeof chats.$inferInsert
export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert
export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
export type ProjectSkill = typeof projectSkills.$inferSelect
export type NewProjectSkill = typeof projectSkills.$inferInsert
export type ChatAttachment = typeof chatAttachments.$inferSelect
export type NewChatAttachment = typeof chatAttachments.$inferInsert
export type UserKey = typeof userKeys.$inferSelect
export type NewUserKey = typeof userKeys.$inferInsert
export type UserPreference = typeof userPreferences.$inferSelect
export type NewUserPreference = typeof userPreferences.$inferInsert
export type Feedback = typeof feedback.$inferSelect
export type NewFeedback = typeof feedback.$inferInsert
export type ConnectedAccount = typeof connectedAccounts.$inferSelect
export type NewConnectedAccount = typeof connectedAccounts.$inferInsert
export type ConnectionRequest = typeof connectionRequests.$inferSelect
export type NewConnectionRequest = typeof connectionRequests.$inferInsert
