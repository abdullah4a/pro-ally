"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, use, useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Role = "user" | "assistant";
interface Message {
  role: Role;
  content: string;
}

interface SessionSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface LimitInfo {
  max: number;
  used: number;
  isAdmin: boolean;
  canCreate: boolean;
}

const SUGGESTIONS = [
  "Review my CV and suggest 3 improvements",
  "What roles am I best suited for right now?",
  "Draft a cover letter opener for a frontend role",
  "How should I negotiate a remote salary offer?",
];

const INTRO_MESSAGE =
  "Hey, I'm **ProAlly AI** — the built-in career assistant for this platform. I already see your uploaded CV and your job pipeline here in ProAlly, so I can give advice grounded in your actual profile.\n\nI stay focused on your job search: reviewing your CV, tailoring applications, prepping for interviews, negotiating offers, and making sense of the roles ProAlly has matched you with. For anything outside that, I'll point you back here.\n\nNot sure where to start? Try one of these:";

export default function ChatSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [limit, setLimit] = useState<LimitInfo | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/sessions");
      const data = await res.json();
      if (!res.ok) {
        setSessionsError(
          typeof data.error === "string" ? data.error : "We couldn't load your chats.",
        );
        return;
      }
      setSessions(data.sessions);
      setLimit(data.limit);
      setSessionsError(null);
    } catch {
      setSessionsError("We couldn't reach the server.");
    }
  }, []);

  const loadSession = useCallback(async () => {
    setPageLoading(true);
    setPageError(null);
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`);
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 404) {
          router.replace("/chat");
          return;
        }
        setPageError(
          typeof data.error === "string" ? data.error : "We couldn't load this chat.",
        );
        return;
      }

      setMessages(
        data.messages.map((m: { role: Role; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      );
    } catch {
      setPageError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setPageLoading(false);
    }
  }, [sessionId, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount is intentional
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on session change is intentional
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function applySuggestion(text: string) {
    setInput(text);
    textareaRef.current?.focus();
  }

  async function startNewChat() {
    if (creatingSession || (limit && !limit.canCreate)) return;
    setCreatingSession(true);
    setSessionsError(null);

    try {
      const res = await fetch("/api/chat/sessions", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setSessionsError(
          typeof data.error === "string" ? data.error : "We couldn't start a new chat.",
        );
        return;
      }

      await loadSessions();
      router.push(`/chat/${data.id}`);
    } catch {
      setSessionsError("We couldn't reach the server.");
    } finally {
      setCreatingSession(false);
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "ProAlly AI is briefly unavailable. Please try again in a moment.",
        );
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      setSessions((prev) => {
        const next = prev.map((s) =>
          s.id === sessionId
            ? { ...s, title: data.title ?? s.title, updatedAt: new Date().toISOString() }
            : s,
        );
        return next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      });
    } catch {
      setError("We couldn't reach ProAlly AI. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    send(input);
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-4">
      <SessionsPanel
        sessions={sessions}
        activeId={sessionId}
        limit={limit}
        error={sessionsError}
        creating={creatingSession}
        onNewChat={startNewChat}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-white">ProAlly AI</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Your platform-specific career copilot — scoped to your job search, CV, and pipeline
            here in ProAlly.
          </p>
        </div>

        {pageLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center text-[var(--text-muted)]">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
            <p>Loading this chat…</p>
          </div>
        ) : pageError ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-sm text-rose-400">{pageError}</p>
          </div>
        ) : (
          <>
            <div
              ref={scrollRef}
              className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5"
            >
              {messages.length === 0 && <ChatBubble message={{ role: "assistant", content: INTRO_MESSAGE }} />}
              {messages.map((message, idx) => (
                <ChatBubble key={idx} message={message} />
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  </div>
                  ProAlly is thinking…
                </div>
              )}

              {messages.length === 0 && !loading && (
                <div className="grid gap-2 pt-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => applySuggestion(s)}
                      className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3 text-left text-sm text-[var(--text-secondary)] transition hover:border-[var(--border-accent)] hover:text-white"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-sm text-rose-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 flex items-end gap-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder="Ask ProAlly about your CV, applications, or interview prep…"
                className="max-h-40 min-h-[52px] flex-1 resize-none rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-[var(--text-dim)] focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-lg shadow-violet-500/20 transition hover:shadow-violet-500/30 hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function SessionsPanel({
  sessions,
  activeId,
  limit,
  error,
  creating,
  onNewChat,
}: {
  sessions: SessionSummary[];
  activeId: string;
  limit: LimitInfo | null;
  error: string | null;
  creating: boolean;
  onNewChat: () => void;
}) {
  const atLimit = limit ? !limit.canCreate : false;

  return (
    <aside className="flex w-[260px] shrink-0 flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
      <button
        type="button"
        onClick={onNewChat}
        disabled={creating || atLimit}
        title={atLimit ? `You've reached your limit of ${limit?.max} chats` : undefined}
        className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:shadow-violet-500/30 hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        New chat
      </button>

      {limit && (
        <p className="mb-3 px-1 text-xs text-[var(--text-muted)]">
          {limit.isAdmin ? "Unlimited chats (admin)" : `${limit.used} of ${limit.max} chats used`}
        </p>
      )}

      {atLimit && !limit?.isAdmin && (
        <p className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 text-xs text-amber-300">
          You&apos;ve reached your chat limit. Continue an existing conversation below.
        </p>
      )}

      {error && <p className="mb-3 px-1 text-xs text-rose-400">{error}</p>}

      <div className="flex-1 space-y-1 overflow-y-auto">
        {sessions.map((s) => (
          <Link
            key={s.id}
            href={`/chat/${s.id}`}
            className={`block rounded-lg px-3 py-2.5 text-sm transition ${
              s.id === activeId
                ? "bg-violet-500/10 text-violet-300 border border-violet-500/15"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-transparent"
            }`}
          >
            <p className="truncate font-medium">{s.title}</p>
            <p className="mt-0.5 truncate text-[11px] text-[var(--text-dim)]">
              <RelativeTime iso={s.updatedAt} />
            </p>
          </Link>
        ))}
      </div>
    </aside>
  );
}

function RelativeTime({ iso }: { iso: string }) {
  // eslint-disable-next-line react-hooks/purity -- display-only relative time, not used for logic
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return <>just now</>;
  if (mins < 60) return <>{mins}m ago</>;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return <>{hrs}h ago</>;
  return <>{Math.floor(hrs / 24)}d ago</>;
}

function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
          isUser
            ? "bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
            : "bg-gradient-to-br from-violet-500 to-cyan-500 text-white"
        }`}
      >
        {isUser ? "You" : "AI"}
      </div>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-gradient-to-r from-violet-600 to-cyan-600 text-white"
            : "border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)]"
        }`}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <AssistantMarkdown content={message.content} />
        )}
      </div>
    </div>
  );
}

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="mb-2 whitespace-pre-wrap last:mb-0">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-white">{children}</strong>
        ),
        ul: ({ children }) => (
          <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>
        ),
        li: ({ children }) => <li className="pl-1">{children}</li>,
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-400 underline underline-offset-2 hover:text-violet-300"
          >
            {children}
          </a>
        ),
        h1: ({ children }) => (
          <h3 className="mb-2 text-base font-semibold text-white">{children}</h3>
        ),
        h2: ({ children }) => (
          <h3 className="mb-2 text-base font-semibold text-white">{children}</h3>
        ),
        h3: ({ children }) => (
          <h4 className="mb-1.5 text-sm font-semibold text-white">{children}</h4>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-2 border-l-2 border-[var(--border-accent)] pl-3 text-[var(--text-muted)] last:mb-0">
            {children}
          </blockquote>
        ),
        pre: ({ children }) => <>{children}</>,
        code(props) {
          const { className, children } = props;
          const isBlock = /language-(\w+)/.test(className ?? "");

          if (isBlock) {
            return (
              <pre className="mb-2 overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-xs last:mb-0">
                <code className="font-mono">{children}</code>
              </pre>
            );
          }

          return (
            <code className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono text-[13px] text-violet-300">
              {children}
            </code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
