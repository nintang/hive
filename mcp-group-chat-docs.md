# Hive - Project Documentation

## Overview

Hive is a hackathon project that creates a unified chat interface where users can interact with multiple MCP (Model Context Protocol) servers as if they were members of a group chat. Users can @mention specific agents (MCPs) to delegate tasks, and each agent responds with its own identity in the conversation.

## Core Concept

Instead of switching between different apps (Asana, Gmail, Slack, etc.), users interact with all their tools through a familiar group chat interface. An orchestrator (Claude API) routes messages to the appropriate MCP servers based on @mentions and returns responses attributed to each agent.

```
User: @Asana create a task for Q1 budget review
🔗 Asana: Created "Q1 budget review" in your Tasks project

User: @Mono what's my account balance?
💰 Mono: Your checking account has $4,230.50

User: @Gmail send the Q1 report to john@example.com
📧 Gmail: Email sent to john@example.com with subject "Q1 Report"
```

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                           │
│  ┌─────────────┐  ┌───────────────────────────────────────────┐ │
│  │  Contacts   │  │            Chat Interface                 │ │
│  │  Sidebar    │  │  - Message list with agent avatars        │ │
│  │             │  │  - @mention autocomplete                  │ │
│  │  Groups     │  │  - Input field                            │ │
│  │  Sidebar    │  │                                           │ │
│  └─────────────┘  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ORCHESTRATOR (Claude API)                     │
│                                                                 │
│  - Receives user message with @mentions                        │
│  - Parses which agents are being addressed                     │
│  - Calls Claude API with appropriate MCP servers               │
│  - Returns responses attributed to each agent                  │
│  - Maintains conversation history                              │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
        ┌───────────┐   ┌───────────┐   ┌───────────┐
        │  Asana    │   │   Mono    │   │  Gmail    │
        │  MCP      │   │   MCP     │   │  MCP      │
        └───────────┘   └───────────┘   └───────────┘
              (Composio-hosted MCP servers via SSE)
```

### Component Breakdown

#### 1. Frontend (React)

**Contacts Sidebar**
- Lists all available/connected MCP servers
- Shows connection status (connected/disconnected)
- Allows adding new connections (triggers Composio OAuth)

**Groups Sidebar**
- Lists user-created groups
- Each group has a name and selected members (MCPs)
- "New Group" button to create groups

**Chat Interface**
- Message list showing conversation history
- Each message shows sender (user or agent with icon)
- @mention autocomplete when typing `@`
- Text input with send button

#### 2. Orchestrator (Backend/API)

**Responsibilities:**
1. Parse @mentions from user messages
2. Determine which MCP servers to invoke
3. Call Claude API with `mcp_servers` parameter
4. Process responses and attribute to correct agents
5. Save conversation history
6. Return formatted responses to frontend

#### 3. MCP Servers (Composio)

MCP servers are hosted by Composio and accessed via SSE (Server-Sent Events) URLs. Each connected app (Asana, Gmail, Slack, etc.) has its own MCP server URL.

---

## Data Models

### Contact (MCP Agent)

```typescript
interface Contact {
  id: string;
  name: string;           // Display name: "Asana", "Gmail", "Mono"
  icon: string;           // Emoji or icon URL: "🔗", "📧", "💰"
  mcpUrl: string;         // Composio SSE endpoint
  mcpName: string;        // MCP server name for API calls
  connected: boolean;     // Whether user has authenticated
  description?: string;   // Optional description of capabilities
}
```

**Example:**
```typescript
{
  id: "asana-1",
  name: "Asana",
  icon: "🔗",
  mcpUrl: "https://mcp.composio.dev/asana/sse",
  mcpName: "asana-mcp",
  connected: true,
  description: "Task and project management"
}
```

### Group

```typescript
interface Group {
  id: string;
  name: string;           // User-defined name: "Work Team", "Personal"
  members: Contact[];     // Array of MCPs in this group
  createdAt: Date;
  updatedAt: Date;
}
```

**Example:**
```typescript
{
  id: "group-1",
  name: "Work Stuff",
  members: [asanaContact, gmailContact, slackContact],
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15")
}
```

### Message

```typescript
interface Message {
  id: string;
  groupId: string;
  sender: {
    type: 'user' | 'agent';
    agentId?: string;     // If agent, which one
    name: string;         // "You" or agent name
    icon?: string;        // Agent icon if applicable
  };
  content: string;
  mentions: string[];     // Agent IDs that were @mentioned
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
}
```

**Example (User message):**
```typescript
{
  id: "msg-1",
  groupId: "group-1",
  sender: { type: 'user', name: 'You' },
  content: "@Asana create a task for Q1 review",
  mentions: ["asana-1"],
  timestamp: new Date(),
  status: 'sent'
}
```

**Example (Agent response):**
```typescript
{
  id: "msg-2",
  groupId: "group-1",
  sender: { 
    type: 'agent', 
    agentId: 'asana-1',
    name: 'Asana',
    icon: '🔗'
  },
  content: "Created task 'Q1 review' in your Tasks project",
  mentions: [],
  timestamp: new Date(),
  status: 'sent'
}
```

### Conversation

```typescript
interface Conversation {
  id: string;
  groupId: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}
```

---

## API Integration

### Claude API with MCP Servers

The orchestrator calls the Claude API with MCP servers to route requests to the appropriate agents.

**Request Format:**
```javascript
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01"
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: `You are an orchestrator for a group chat with AI agents. 
             The user has @mentioned specific agents. 
             Route the request to the appropriate agent and return their response.
             Always attribute responses to the correct agent.`,
    messages: [
      { role: "user", content: userMessage }
    ],
    mcp_servers: [
      {
        type: "url",
        url: "https://mcp.composio.dev/asana/sse",
        name: "asana-mcp"
      },
      {
        type: "url", 
        url: "https://mcp.composio.dev/gmail/sse",
        name: "gmail-mcp"
      }
    ]
  })
});
```

**Response Handling:**
```javascript
const data = await response.json();

// Extract text responses
const textResponses = data.content
  .filter(item => item.type === "text")
  .map(item => item.text);

// Extract MCP tool results
const toolResults = data.content
  .filter(item => item.type === "mcp_tool_result")
  .map(item => ({
    content: item.content?.[0]?.text || "",
    toolName: item.name
  }));
```

### Composio MCP Server URLs

Composio provides managed MCP servers for 100+ apps. Each server has an SSE endpoint:

```
https://mcp.composio.dev/{app-name}/sse
```

**Common apps:**
- Gmail: `https://mcp.composio.dev/gmail/sse`
- Asana: `https://mcp.composio.dev/asana/sse`
- Slack: `https://mcp.composio.dev/slack/sse`
- Notion: `https://mcp.composio.dev/notion/sse`
- GitHub: `https://mcp.composio.dev/github/sse`
- Google Calendar: `https://mcp.composio.dev/googlecalendar/sse`
- Google Sheets: `https://mcp.composio.dev/googlesheets/sse`
- Linear: `https://mcp.composio.dev/linear/sse`
- Trello: `https://mcp.composio.dev/trello/sse`

---

## UI/UX Specifications

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  MCP Group Chat                                        [Settings]   │
├──────────────┬──────────────────────────────────────────────────────┤
│              │                                                      │
│  CONTACTS    │  GROUP NAME: Work Team                    [+ Add]    │
│  ──────────  │  Members: 🔗 Asana, 💰 Mono, 📧 Gmail                │
│              │  ────────────────────────────────────────────────    │
│  🔗 Asana ●  │                                                      │
│  💰 Mono  ●  │  ┌─────────────────────────────────────────────┐    │
│  📧 Gmail ●  │  │ You                              10:30 AM   │    │
│  💬 Slack ○  │  │ @Mono what's my account balance?            │    │
│  📄 Notion ○ │  └─────────────────────────────────────────────┘    │
│              │                                                      │
│  ──────────  │  ┌─────────────────────────────────────────────┐    │
│              │  │ 💰 Mono                          10:30 AM   │    │
│  GROUPS      │  │ Your checking account: $4,230.50            │    │
│  ──────────  │  │ Savings: $12,100.00                         │    │
│              │  └─────────────────────────────────────────────┘    │
│  📁 Work     │                                                      │
│  📁 Personal │  ┌─────────────────────────────────────────────┐    │
│  + New Group │  │ You                              10:32 AM   │    │
│              │  │ @Asana create task: Review Q1 budget        │    │
│              │  └─────────────────────────────────────────────┘    │
│              │                                                      │
│              │  ┌─────────────────────────────────────────────┐    │
│              │  │ 🔗 Asana                         10:32 AM   │    │
│              │  │ Created "Review Q1 budget" in Tasks         │    │
│              │  └─────────────────────────────────────────────┘    │
│              │                                                      │
│              │  ────────────────────────────────────────────────    │
│              │  │ @ │ Type a message...              [Send]   │    │
│              │  ────────────────────────────────────────────────    │
└──────────────┴──────────────────────────────────────────────────────┘
```

### @Mention Autocomplete

When user types `@`, show a dropdown of group members:

```
┌──────────────────────────────────────────────────────────────┐
│ @as                                                          │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────────────┐                                     │
│ │ 🔗 Asana            │  ← Filtered results                 │
│ └──────────────────────┘                                     │
└──────────────────────────────────────────────────────────────┘
```

### Message Bubbles

**User messages:** Right-aligned, colored background
**Agent messages:** Left-aligned, with agent icon and name

### States

1. **Empty state:** "Create a group and start chatting with your agents"
2. **Loading:** Show typing indicator when waiting for agent response
3. **Error:** Show error message with retry option
4. **Disconnected agent:** Gray out with "Not connected" label

---

## Orchestrator Logic

### Message Processing Flow

```
1. USER SENDS MESSAGE
   │
   ▼
2. PARSE @MENTIONS
   │ - Extract all @AgentName patterns
   │ - Map to agent IDs
   │ - Validate agents are in the group
   │
   ▼
3. BUILD MCP SERVER LIST
   │ - Get MCP URLs for mentioned agents
   │ - Filter to only connected agents
   │
   ▼
4. CALL CLAUDE API
   │ - Include conversation history for context
   │ - Pass mcp_servers array
   │ - System prompt instructs attribution
   │
   ▼
5. PROCESS RESPONSE
   │ - Parse text and tool_result blocks
   │ - Attribute responses to correct agents
   │ - Handle multi-agent responses
   │
   ▼
6. SAVE & RETURN
   │ - Save messages to conversation history
   │ - Return formatted messages to frontend
```

### System Prompt for Orchestrator

```
You are an orchestrator for a group chat where users interact with AI agents 
(MCP servers). Your job is to:

1. Understand which agent(s) the user is addressing via @mentions
2. Route the request to the appropriate agent's tools
3. Return responses clearly attributed to each agent

RULES:
- Only use tools from agents that were @mentioned
- If multiple agents are mentioned, you may need to call multiple tools
- Always indicate which agent is responding
- Keep responses concise and conversational
- If an agent can't fulfill a request, explain why

RESPONSE FORMAT:
When responding on behalf of an agent, prefix with their name:
[AgentName]: Response content here

If multiple agents respond:
[Asana]: Created the task
[Gmail]: Sent the notification email

CURRENT GROUP MEMBERS:
{group_members_list}

CONVERSATION HISTORY:
{conversation_history}
```

### Handling Multiple @Mentions

When a user mentions multiple agents:

```
User: @Asana create a task for the meeting and @Gmail send invite to john@example.com
```

The orchestrator should:
1. Include both MCP servers in the API call
2. Execute both actions
3. Return separate responses:

```
🔗 Asana: Created task "Meeting" in your Tasks
📧 Gmail: Sent meeting invite to john@example.com
```

### Error Handling

```typescript
// Agent not connected
if (!agent.connected) {
  return {
    sender: { type: 'agent', name: agent.name, icon: agent.icon },
    content: `I'm not connected yet. Please connect ${agent.name} in settings.`,
    status: 'error'
  };
}

// Agent not in group
if (!group.members.includes(agent)) {
  return {
    sender: { type: 'system', name: 'System' },
    content: `${agent.name} is not in this group. Add them first.`,
    status: 'error'
  };
}

// MCP tool error
if (toolResult.error) {
  return {
    sender: { type: 'agent', name: agent.name, icon: agent.icon },
    content: `Sorry, I encountered an error: ${toolResult.error}`,
    status: 'error'
  };
}
```

---

## Persistence

### Storage Strategy

For the hackathon, use browser localStorage or a simple backend store.

**localStorage structure:**
```javascript
{
  "mcp-chat-contacts": [...],      // Available MCP connections
  "mcp-chat-groups": [...],        // User's groups
  "mcp-chat-conversations": {      // Message history by group
    "group-1": [...messages],
    "group-2": [...messages]
  }
}
```

### React State Management

```typescript
// Zustand store example
interface ChatStore {
  // Contacts
  contacts: Contact[];
  addContact: (contact: Contact) => void;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  
  // Groups
  groups: Group[];
  activeGroupId: string | null;
  createGroup: (name: string, memberIds: string[]) => void;
  setActiveGroup: (id: string) => void;
  
  // Messages
  conversations: Record<string, Message[]>;
  sendMessage: (groupId: string, content: string) => Promise<void>;
  
  // Persistence
  loadFromStorage: () => void;
  saveToStorage: () => void;
}
```

---

## Implementation Checklist

### Phase 1: Core UI
- [ ] Basic layout with sidebar and chat area
- [ ] Contacts list component
- [ ] Groups list component
- [ ] Chat message list component
- [ ] Message input with @mention detection
- [ ] @mention autocomplete dropdown

### Phase 2: Group Management
- [ ] Create group modal
- [ ] Select members for group
- [ ] Display group members in chat header
- [ ] Switch between groups

### Phase 3: Orchestrator
- [ ] Parse @mentions from message
- [ ] Build Claude API request with MCP servers
- [ ] Handle API response
- [ ] Attribute responses to agents
- [ ] Display agent responses in chat

### Phase 4: Persistence
- [ ] Save contacts to storage
- [ ] Save groups to storage
- [ ] Save conversation history
- [ ] Load state on app start

### Phase 5: Polish
- [ ] Loading states
- [ ] Error handling
- [ ] Empty states
- [ ] Connection status indicators
- [ ] Responsive design

---

## Tech Stack Recommendations

### Frontend
- **Framework:** React with TypeScript
- **Styling:** Tailwind CSS
- **State:** Zustand or React Context
- **Icons:** Lucide React

### Backend (if needed)
- **Runtime:** Node.js
- **API:** Express or Next.js API routes
- **Storage:** localStorage (hackathon) or SQLite/Postgres (production)

### APIs
- **Orchestrator:** Claude API (Anthropic)
- **MCP Servers:** Composio

---

## Example Interactions

### Basic Task Creation
```
You: @Asana create a task called "Review Q1 financials" due next Friday

🔗 Asana: Created task "Review Q1 financials" 
   📅 Due: Friday, Jan 24
   📁 Project: Tasks
```

### Multi-Agent Query
```
You: @Mono what's my balance? @Asana how many tasks are overdue?

💰 Mono: 
   Checking: $4,230.50
   Savings: $12,100.00

🔗 Asana:
   You have 3 overdue tasks:
   - Budget review (2 days overdue)
   - Team sync notes (1 day overdue)  
   - Client proposal (5 days overdue)
```

### Cross-Agent Workflow
```
You: @Asana what's my next task? Then @Slack remind #team about it

🔗 Asana: Your next task is "Prepare demo for client" due tomorrow at 2pm

💬 Slack: Posted to #team:
   "Reminder: @you has 'Prepare demo for client' due tomorrow at 2pm"
```

---

## Reference: LangChain Multi-Agent Patterns

This project is inspired by LangChain's supervisor pattern for multi-agent systems:

1. **Supervisor Pattern:** A central orchestrator (Claude) coordinates multiple specialized agents (MCP servers)

2. **Tool-based Handoff:** Communication between agents happens through structured tool calls

3. **State Management:** Conversation history is maintained across agent interactions

4. **Flexible Routing:** The supervisor decides which agent(s) to invoke based on user input

Key insight from LangChain docs: "Multi-agent systems are particularly valuable when a single agent has too many tools and makes poor decisions about which to use."

Our @mention system solves this by letting users explicitly direct requests to specific agents.

---

## Composio MCP Reference

Composio provides managed MCP servers with built-in authentication for 100+ apps.

**Key features:**
- SSE (Server-Sent Events) transport
- OAuth, API key, and basic auth support
- Pre-built integrations for popular apps

**Integration pattern:**
```javascript
mcp_servers: [
  {
    type: "url",
    url: "https://mcp.composio.dev/{app}/sse",
    name: "{app}-mcp"
  }
]
```

**Available apps include:**
Gmail, GitHub, Google Calendar, Google Sheets, Notion, Slack, Asana, Linear, Trello, Jira, Salesforce, HubSpot, Zendesk, and many more.

---

## Notes for Development

1. **Start with mock data:** Build the UI first with hardcoded contacts and messages before integrating real APIs

2. **Test with one MCP:** Get the full flow working with a single MCP (like Mono) before adding more

3. **Handle streaming:** Claude API responses may stream, handle partial responses gracefully

4. **Rate limiting:** Be mindful of API rate limits during development

5. **Error boundaries:** Wrap components in error boundaries to prevent full app crashes

6. **Responsive design:** Sidebar should collapse on mobile

7. **Accessibility:** Ensure keyboard navigation works for @mention selection
