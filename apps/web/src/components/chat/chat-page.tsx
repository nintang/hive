"use client";

import * as React from "react";
import {
  Menu,
  Plus,
  Search,
  SendHorizontal,
  Settings,
  Trash2,
  User,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type MessageRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
};

type ChatThread = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
};

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getThreadPreview(thread: ChatThread) {
  const last = thread.messages.at(-1);
  return last?.content ?? "No messages yet";
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const initialThreads: ChatThread[] = [
  {
    id: "t-1",
    title: "Product ideas",
    updatedAt: Date.now() - 1000 * 60 * 12,
    messages: [
      {
        id: "m-1",
        role: "assistant",
        content:
          "Tell me what you’re building and who it’s for. I’ll help shape the MVP.",
        createdAt: Date.now() - 1000 * 60 * 12,
      },
      {
        id: "m-2",
        role: "user",
        content: "A lightweight chat app UI with a clean sidebar layout.",
        createdAt: Date.now() - 1000 * 60 * 11,
      },
    ],
  },
  {
    id: "t-2",
    title: "Design feedback",
    updatedAt: Date.now() - 1000 * 60 * 60 * 5,
    messages: [
      {
        id: "m-3",
        role: "user",
        content: "Make it feel like a modern AI chat.",
        createdAt: Date.now() - 1000 * 60 * 60 * 5,
      },
      {
        id: "m-4",
        role: "assistant",
        content:
          "Use a left sidebar for threads, a sticky header, and a composer with a primary send button.",
        createdAt: Date.now() - 1000 * 60 * 60 * 5 + 1000 * 45,
      },
    ],
  },
];

export function ChatPage() {
  const [threads, setThreads] = React.useState<ChatThread[]>(initialThreads);
  const [activeThreadId, setActiveThreadId] = React.useState<string>(
    initialThreads[0]?.id ?? "",
  );
  const [search, setSearch] = React.useState("");
  const [composer, setComposer] = React.useState("");

  const activeThread = React.useMemo(
    () => threads.find((t) => t.id === activeThreadId) ?? threads[0],
    [threads, activeThreadId],
  );

  const filteredThreads = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return threads;
    return threads.filter((t) => {
      if (t.title.toLowerCase().includes(term)) return true;
      return getThreadPreview(t).toLowerCase().includes(term);
    });
  }, [threads, search]);

  const createThread = React.useCallback(() => {
    const now = Date.now();
    const newThread: ChatThread = {
      id: createId(),
      title: "New chat",
      messages: [],
      updatedAt: now,
    };
    setThreads((prev) => [newThread, ...prev]);
    setActiveThreadId(newThread.id);
    setComposer("");
  }, []);

  const deleteThread = React.useCallback((threadId: string) => {
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
    setActiveThreadId((prevActive) => {
      if (prevActive !== threadId) return prevActive;
      return threads.find((t) => t.id !== threadId)?.id ?? "";
    });
  }, [threads]);

  const sendMessage = React.useCallback(() => {
    const content = composer.trim();
    if (!content || !activeThread) return;

    const now = Date.now();
    const userMsg: ChatMessage = {
      id: createId(),
      role: "user",
      content,
      createdAt: now,
    };

    const assistantMsg: ChatMessage = {
      id: createId(),
      role: "assistant",
      content: `Got it. Next, I can help you wire this to an API route and streaming responses.`,
      createdAt: now + 200,
    };

    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== activeThread.id) return t;
        return {
          ...t,
          updatedAt: now,
          title: t.messages.length === 0 ? content.slice(0, 32) : t.title,
          messages: [...t.messages, userMsg, assistantMsg],
        };
      }),
    );
    setComposer("");
  }, [composer, activeThread]);

  const onComposerKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== "Enter") return;
      if (e.shiftKey) return;
      e.preventDefault();
      sendMessage();
    },
    [sendMessage],
  );

  if (!activeThread) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Button onClick={createThread}>Create your first chat</Button>
      </div>
    );
  }

  const Sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">HiveChat</div>
          <div className="truncate text-xs text-muted-foreground">
            Chat UI (shadcn only)
          </div>
        </div>
        <Button variant="secondary" size="icon" onClick={createThread}>
          <Plus />
          <span className="sr-only">New chat</span>
        </Button>
      </div>

      <div className="px-3 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats"
            className="pl-9"
          />
        </div>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 p-2">
          {filteredThreads.map((thread) => {
            const isActive = thread.id === activeThread.id;
            return (
              <div
                key={thread.id}
                className={cn(
                  "group flex items-start gap-2 rounded-md px-2 py-2",
                  isActive ? "bg-accent" : "hover:bg-accent/60",
                )}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setActiveThreadId(thread.id)}
                >
                  <div className="truncate text-sm font-medium">
                    {thread.title}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {getThreadPreview(thread)}
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100"
                  onClick={() => deleteThread(thread.id)}
                >
                  <Trash2 />
                  <span className="sr-only">Delete chat</span>
                </Button>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <Separator />

      <div className="p-3">
        <div className="flex items-center gap-2 rounded-md border bg-card p-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback>DN</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">Demo User</div>
            <div className="truncate text-xs text-muted-foreground">
              local-only UI
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings />
                <span className="sr-only">User menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 size-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 size-4" />
                Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-dvh bg-background">
      <div className="grid h-full md:grid-cols-[320px_1fr]">
        <aside className="hidden border-r bg-card md:block">{Sidebar}</aside>

        <div className="flex min-w-0 flex-col">
          <header className="flex h-14 items-center gap-2 border-b bg-card px-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu />
                  <span className="sr-only">Open sidebar</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0">
                <SheetHeader className="px-3 pt-3">
                  <SheetTitle>Chats</SheetTitle>
                </SheetHeader>
                <div className="h-[calc(100%-3.25rem)]">{Sidebar}</div>
              </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {activeThread.title}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {activeThread.messages.length} messages
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <User />
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Chat</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => createThread()}>
                  <Plus className="mr-2 size-4" />
                  New chat
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <ScrollArea className="flex-1">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
              {activeThread.messages.map((m) => {
                const isUser = m.role === "user";
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex gap-3",
                      isUser ? "justify-end" : "justify-start",
                    )}
                  >
                    {!isUser ? (
                      <Avatar className="mt-0.5 h-8 w-8">
                        <AvatarFallback>AI</AvatarFallback>
                      </Avatar>
                    ) : null}

                    <div className="max-w-[80%]">
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-xs",
                          isUser
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground",
                        )}
                      >
                        {m.content}
                      </div>
                      <div
                        className={cn(
                          "mt-1 text-xs text-muted-foreground",
                          isUser ? "text-right" : "text-left",
                        )}
                      >
                        {formatTime(m.createdAt)}
                      </div>
                    </div>

                    {isUser ? (
                      <Avatar className="mt-0.5 h-8 w-8">
                        <AvatarFallback>DN</AvatarFallback>
                      </Avatar>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <div className="border-t bg-card">
            <div className="mx-auto w-full max-w-3xl p-4">
              <div className="flex items-end gap-2">
                <Textarea
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  onKeyDown={onComposerKeyDown}
                  placeholder="Message HiveChat… (Enter to send, Shift+Enter for newline)"
                  className="min-h-[44px] resize-none"
                />
                <Button
                  className="h-11 w-11 rounded-full"
                  size="icon"
                  onClick={sendMessage}
                  disabled={!composer.trim()}
                >
                  <SendHorizontal />
                  <span className="sr-only">Send</span>
                </Button>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                UI inspired by prompt-kit patterns, implemented with shadcn/ui primitives.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

