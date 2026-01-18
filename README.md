# Hivechat

A unified chat interface for interacting with multiple LLMs and external tool integrations. Chat with OpenAI, Anthropic, Google Gemini, Mistral, and more—all in one place.

## Features

- **Multi-Model Support** - Switch between OpenAI, Anthropic, Google Gemini, Mistral, Perplexity, xAI, OpenRouter, and local Ollama models
- **Tool Integrations** - Connect external services (Asana, Gmail, Slack, etc.) via Composio
- **Projects** - Organize chats and configure model/skill settings per project
- **Skills** - Extensible action registry for custom capabilities
- **Code Execution** - Run code in sandboxed environments with E2B
- **Observability** - Full LLM tracing with Arize Phoenix and OpenTelemetry

## Tech Stack

### Core

- **Next.js 16** with Turbopack
- **React 19**
- **TypeScript 5**
- **Tailwind CSS 4**

### AI & LLM

- **Vercel AI SDK** - Unified interface for multiple LLM providers
- **Model Context Protocol (MCP)** - Tool integration standard

### Database

- **Cloudflare D1** (SQLite) with Drizzle ORM

### Authentication

- **Clerk** - User authentication and management

### Observability

- **Arize Phoenix** - LLM observability and tracing
- **OpenTelemetry** - Distributed tracing infrastructure

Phoenix and Arize provide full visibility into LLM interactions, including:
- Token usage and costs
- Response latency
- Prompt/completion content
- Error tracking and debugging

### UI

- **Radix UI** / **Shadcn** components
- **Lucide** and **Phosphor** icons
- **Motion** for animations

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

1. Clone the repository:

```bash
git clone https://github.com/nintang/hivechat.git
cd hivechat
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp apps/web/.env.example apps/web/.env.local
```

4. Configure your `.env.local` with required values (see [Environment Variables](#environment-variables) below).

5. Run the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with Turbopack |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript type checking |

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE` | Supabase service role key |
| `CSRF_SECRET` | 32-character random string for CSRF protection |

### AI Model API Keys

Configure at least one LLM provider:

| Variable | Provider |
|----------|----------|
| `OPENAI_API_KEY` | OpenAI |
| `ANTHROPIC_API_KEY` | Anthropic (Claude) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Gemini |
| `MISTRAL_API_KEY` | Mistral |
| `XAI_API_KEY` | xAI (Grok) |
| `PERPLEXITY_API_KEY` | Perplexity |
| `OPENROUTER_API_KEY` | OpenRouter |

### Local Models

| Variable | Description |
|----------|-------------|
| `OLLAMA_BASE_URL` | Ollama server URL (default: `http://localhost:11434`) |

### Integrations (Optional)

| Variable | Description |
|----------|-------------|
| `COMPOSIO_API_KEY` | Composio for tool integrations |
| `EXA_API_KEY` | Exa.ai search |
| `GITHUB_TOKEN` | GitHub API access |

### Observability (Optional)

| Variable | Description |
|----------|-------------|
| `ARIZE_SPACE_ID` | Arize workspace ID |
| `ARIZE_API_KEY` | Arize API key |

When configured, all LLM calls are traced to Arize Phoenix for monitoring and debugging.

## Project Structure

```
hivechat/
├── apps/
│   └── web/                 # Next.js application
│       ├── src/
│       │   ├── app/         # App router pages and API routes
│       │   ├── components/  # React components
│       │   ├── lib/         # Utilities and database
│       │   └── instrumentation.ts  # OpenTelemetry setup
│       └── drizzle/         # Database migrations
└── package.json             # Workspace root
```

## License

MIT
