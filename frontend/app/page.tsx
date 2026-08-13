'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Copy,
  Check,
  Loader2,
  Send,
  Sparkles,
  RotateCcw,
  Moon,
  Sun,
  Briefcase,
  MessageSquare,
  Bot,
  User,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/* ── Constants ────────────────────────────────── */

const suggestedQuestions = [
  'Tell me about Krishna',
  'Strongest Skills',
  'Projects',
  'Backend Experience',
  'AI Experience',
  'Certifications',
  'Resume Summary',
  'Contact Information',
]

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

/* ── Types ────────────────────────────────────── */

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  timestamp: number
}

/* ── Helpers ──────────────────────────────────── */

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/* ── Thinking Indicator ──────────────────────── */

function ThinkingIndicator() {
  return (
    <div className="message-enter flex items-start gap-3 px-4 py-3 sm:px-6">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ background: 'var(--accent-subtle)' }}
      >
        <Bot className="h-4 w-4" style={{ color: 'var(--accent)' }} />
      </div>
      <div
        className="flex items-center gap-3 rounded-2xl px-5 py-3"
        style={{ background: 'var(--bg-tertiary)' }}
      >
        <div className="flex items-center gap-1.5">
          <span className="thinking-dot" />
          <span className="thinking-dot" />
          <span className="thinking-dot" />
        </div>
        <span
          className="text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          Krishna's assistant is thinking…
        </span>
      </div>
    </div>
  )
}

/* ── Copy Button ─────────────────────────────── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-all hover:scale-105"
      style={{
        color: 'var(--text-muted)',
        background: 'var(--bg-tertiary)',
      }}
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" style={{ color: '#34d399' }} />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          Copy
        </>
      )}
    </button>
  )
}

/* ── Main Page ───────────────────────────────── */

export default function HomePage() {
  const [query, setQuery] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string>('')
  const [recruiterMode, setRecruiterMode] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeView, setActiveView] = useState<'chat' | 'compare'>('chat')
  const [error, setError] = useState<string | null>(null)
  const [isLightMode, setIsLightMode] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const currentConvIdRef = useRef<string>('')

  useEffect(() => {
    currentConvIdRef.current = currentConversationId
  }, [currentConversationId])

  /* ── Theme & LocalStorage ──────────────────── */

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme-mode')
    if (savedTheme === 'light') {
      setIsLightMode(true)
      document.documentElement.classList.add('light-mode')
    }

    const savedHistory = localStorage.getItem('chat-history')
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory)
        const parsedConvs = parsed.map((c: any) => ({
          ...c,
          messages: c.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }))
        }))
        setConversations(parsedConvs)
      } catch (e) {
        console.error('Failed to load history', e)
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('chat-history', JSON.stringify(conversations))
  }, [conversations])

  const toggleTheme = () => {
    const next = !isLightMode
    setIsLightMode(next)
    document.documentElement.classList.toggle('light-mode', next)
    localStorage.setItem('theme-mode', next ? 'light' : 'dark')
  }

  /* ── Auto-scroll ───────────────────────────── */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  /* ── Auto-resize textarea ──────────────────── */

  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  const updateMessages = (updater: (prev: Message[]) => Message[]) => {
    setMessages(prev => {
      const next = updater(prev)
      const convId = currentConvIdRef.current
      if (convId) {
        setConversations(convs => convs.map(c => 
          c.id === convId ? { ...c, messages: next, timestamp: Date.now() } : c
        ))
      }
      return next
    })
  }

  /* ── Send message ──────────────────────────── */

  const handleAsk = async (question?: string) => {
    const prompt = question || query.trim()
    if (!prompt || isLoading) return

    setError(null)
    setIsLoading(true)
    setIsStreaming(false)
    setQuery('')

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    }
    const assistantMsg: Message = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }

    let convId = currentConvIdRef.current
    if (!convId) {
      convId = generateId()
      setCurrentConversationId(convId)
      currentConvIdRef.current = convId
      setConversations(prev => [{
        id: convId,
        title: prompt.slice(0, 30) + (prompt.length > 30 ? '...' : ''),
        messages: [userMsg, assistantMsg],
        timestamp: Date.now()
      }, ...prev])
    } else {
      setConversations(prev => prev.map(c => 
        c.id === convId ? { ...c, messages: [...c.messages, userMsg, assistantMsg], timestamp: Date.now() } : c
      ))
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])

    try {
      const response = await fetch(`${apiBase}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: prompt, recruiter_mode: recruiterMode }),
      })

      if (!response.ok || !response.body) {
        const body = await response.text()
        throw new Error(body || 'Backend returned an error.')
      }

      setIsStreaming(true)
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        fullContent += chunk
        updateMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = { ...next[next.length - 1], content: fullContent }
          return next
        })
      }
    } catch (err) {
      setError((err as Error).message)
      updateMessages((prev) => prev.slice(0, -1))
    } finally {
      setIsLoading(false)
      setIsStreaming(false)
    }
  }

  /* ── JD Compare ────────────────────────────── */

  const handleCompare = async () => {
    if (!jobDescription.trim()) {
      setError('Paste a job description first.')
      return
    }

    setError(null)
    setIsLoading(true)
    setIsStreaming(false)

    const content = `📋 Compare this JD against Krishna's profile:\n\n${jobDescription.slice(0, 200)}${jobDescription.length > 200 ? '...' : ''}`
    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
    }
    const assistantMsg: Message = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }

    let convId = currentConvIdRef.current
    if (!convId) {
      convId = generateId()
      setCurrentConversationId(convId)
      currentConvIdRef.current = convId
      setConversations(prev => [{
        id: convId,
        title: 'JD Comparison',
        messages: [userMsg, assistantMsg],
        timestamp: Date.now()
      }, ...prev])
    } else {
      setConversations(prev => prev.map(c => 
        c.id === convId ? { ...c, messages: [...c.messages, userMsg, assistantMsg], timestamp: Date.now() } : c
      ))
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])

    try {
      const response = await fetch(`${apiBase}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_description: jobDescription, recruiter_mode: recruiterMode }),
      })

      if (!response.ok || !response.body) {
        const body = await response.text()
        throw new Error(body || 'Comparison failed.')
      }

      setIsStreaming(true)
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        fullContent += chunk
        updateMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = { ...next[next.length - 1], content: fullContent }
          return next
        })
      }
    } catch (err) {
      setError((err as Error).message)
      updateMessages((prev) => prev.slice(0, -1))
    } finally {
      setIsLoading(false)
      setIsStreaming(false)
    }
  }

  /* ── History Actions ───────────────────────── */

  const startNewChat = () => {
    setCurrentConversationId('')
    setMessages([])
    setError(null)
  }

  const loadConversation = (id: string) => {
    const conv = conversations.find(c => c.id === id)
    if (conv) {
      setCurrentConversationId(id)
      setMessages(conv.messages)
      setError(null)
    }
  }

  const clearAllHistory = () => {
    if (confirm('Are you sure you want to delete all chat history?')) {
      setConversations([])
      startNewChat()
      localStorage.removeItem('chat-history')
    }
  }

  const clearConversation = () => {
    setMessages([])
    setError(null)
    if (currentConversationId) {
      setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: [] } : c))
    }
  }

  /* ── Key handler ───────────────────────────── */

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (activeView === 'compare') {
        handleCompare()
      } else {
        handleAsk()
      }
    }
  }

  /* ── Render ────────────────────────────────── */

  const hasMessages = messages.length > 0

  return (
    <div className="flex h-screen w-full" style={{ background: 'var(--bg-primary)' }}>
      {/* ── Sidebar ───────────────────────────── */}
      <aside 
        className="w-64 flex-shrink-0 border-r flex flex-col hidden md:flex"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}
      >
        <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium transition hover:scale-[1.02]"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Sparkles className="h-4 w-4" /> New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.map(c => (
            <button
              key={c.id}
              onClick={() => loadConversation(c.id)}
              className="w-full text-left p-3 rounded-lg mb-1 transition text-sm truncate"
              style={{
                background: currentConversationId === c.id ? 'var(--bg-tertiary)' : 'transparent',
                color: currentConversationId === c.id ? 'var(--text-primary)' : 'var(--text-secondary)'
              }}
            >
              {c.title}
            </button>
          ))}
        </div>
        {conversations.length > 0 && (
          <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={clearAllHistory}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium transition hover:scale-[1.02]"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
            >
              <RotateCcw className="h-4 w-4" /> Clear History
            </button>
          </div>
        )}
      </aside>

      {/* ── Main Chat Area ────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* ── Header ───────────────────────────── */}
        <header
        className="flex shrink-0 items-center justify-between border-b px-4 py-3 sm:px-6"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: 'var(--accent-subtle)' }}
          >
            <Sparkles className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Krishna's Portfolio Assistant
            </h1>
            <div className="flex items-center gap-2">
              <span className="status-dot" />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Online • Powered by AI
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div
            className="flex items-center rounded-xl border p-0.5"
            style={{ borderColor: 'var(--border)' }}
          >
            <button
              type="button"
              onClick={() => setActiveView('chat')}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition"
              style={{
                background: activeView === 'chat' ? 'var(--accent)' : 'transparent',
                color: activeView === 'chat' ? '#fff' : 'var(--text-secondary)',
              }}
            >
              <MessageSquare className="h-3.5 w-3.5" /> Chat
            </button>
            <button
              type="button"
              onClick={() => setActiveView('compare')}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition"
              style={{
                background: activeView === 'compare' ? 'var(--accent)' : 'transparent',
                color: activeView === 'compare' ? '#fff' : 'var(--text-secondary)',
              }}
            >
              <Briefcase className="h-3.5 w-3.5" /> JD Compare
            </button>
          </div>

          {/* Recruiter mode */}
          <button
            type="button"
            onClick={() => setRecruiterMode(!recruiterMode)}
            className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition"
            style={{
              borderColor: recruiterMode ? 'var(--accent)' : 'var(--border)',
              background: recruiterMode ? 'var(--accent-subtle)' : 'transparent',
              color: recruiterMode ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: recruiterMode ? 'var(--accent)' : 'var(--text-muted)' }}
            />
            Recruiter
          </button>

          {/* Clear chat */}
          {hasMessages && (
            <button
              type="button"
              onClick={clearConversation}
              className="flex h-8 w-8 items-center justify-center rounded-xl border transition hover:scale-105"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              title="Clear chat"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-xl border transition hover:scale-105"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            title="Toggle theme"
          >
            {isLightMode ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
          </button>
        </div>
      </header>

      {/* ── Messages Area ────────────────────── */}
      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-primary)' }}>
        {!hasMessages ? (
          /* ── Empty state ─────────────────── */
          <div className="flex h-full flex-col items-center justify-center px-4">
            <div
              className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: 'var(--accent-subtle)' }}
            >
              <Sparkles className="h-8 w-8" style={{ color: 'var(--accent)' }} />
            </div>
            <h2
              className="gradient-text mb-2 text-2xl font-semibold"
            >
              Ask me anything about Krishna
            </h2>
            <p
              className="mb-8 max-w-md text-center text-sm leading-relaxed"
              style={{ color: 'var(--text-muted)' }}
            >
              I'm Krishna's AI portfolio assistant. I only answer from verified documents — 
              no guessing, no hallucination. Try a question below!
            </p>

            <div className="grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4">
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleAsk(q)}
                  disabled={isLoading}
                  className="rounded-xl border px-3 py-2.5 text-left text-xs transition hover:scale-[1.02] disabled:opacity-50"
                  style={{
                    borderColor: 'var(--border)',
                    color: 'var(--text-secondary)',
                    background: 'var(--bg-secondary)',
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ── Chat messages ───────────────── */
          <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user'
              const isLastAssistant =
                msg.role === 'assistant' && idx === messages.length - 1
              const isCurrentlyStreaming = isLastAssistant && isStreaming

              return (
                <div
                  key={msg.id}
                  className="message-enter mb-4 flex items-start gap-3"
                >
                  {/* Avatar */}
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: isUser ? 'var(--accent)' : 'var(--accent-subtle)',
                    }}
                  >
                    {isUser ? (
                      <User className="h-4 w-4 text-white" />
                    ) : (
                      <Bot className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className="text-xs font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {isUser ? 'You' : "Krishna's Assistant"}
                      </span>
                      <span
                        className="text-xs"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>

                    <div
                      className="rounded-2xl px-4 py-3"
                      style={{
                        background: isUser ? 'var(--user-bubble)' : 'var(--assistant-bubble)',
                        borderLeft: !isUser ? '2px solid var(--accent)' : 'none',
                        paddingLeft: !isUser ? '16px' : undefined,
                      }}
                    >
                      <div
                        className={`message-content text-sm leading-relaxed ${
                          isCurrentlyStreaming ? 'streaming-cursor' : ''
                        }`}
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {msg.content || (isLastAssistant && isLoading && !isStreaming ? '' : msg.content) ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        ) : null}
                      </div>
                    </div>

                    {/* Copy button for assistant messages */}
                    {!isUser && msg.content && !isCurrentlyStreaming && (
                      <div className="mt-1.5">
                        <CopyButton text={msg.content} />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* ── Thinking indicator ─────────── */}
            {isLoading && !isStreaming && <ThinkingIndicator />}

            {/* ── Error display ──────────────── */}
            {error && (
              <div
                className="message-enter mx-11 mb-4 rounded-xl border px-4 py-3 text-sm"
                style={{
                  borderColor: '#ef4444',
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: '#fca5a5',
                }}
              >
                ⚠️ {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* ── Input Area ───────────────────────── */}
      <footer
        className="shrink-0 border-t px-4 pb-4 pt-3 sm:px-6"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}
      >
        {/* Error when no messages */}
        {error && !hasMessages && (
          <div
            className="mb-3 rounded-xl border px-4 py-3 text-sm"
            style={{
              borderColor: '#ef4444',
              background: 'rgba(239, 68, 68, 0.08)',
              color: '#fca5a5',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Quick suggestions when there are messages */}
        {hasMessages && !isLoading && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {suggestedQuestions.slice(0, 4).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleAsk(q)}
                className="rounded-lg border px-2.5 py-1 text-xs transition hover:scale-[1.02]"
                style={{
                  borderColor: 'var(--border)',
                  color: 'var(--text-muted)',
                  background: 'var(--bg-tertiary)',
                }}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <div className="mx-auto max-w-3xl">
          <div
            className="flex items-end gap-2 rounded-2xl border p-2"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-tertiary)' }}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={activeView === 'compare' ? jobDescription : query}
              placeholder={
                activeView === 'compare'
                  ? "Paste a job description to compare against Krishna's profile…"
                  : 'Ask something about Krishna…'
              }
              onChange={(e) => {
                activeView === 'compare'
                  ? setJobDescription(e.target.value)
                  : setQuery(e.target.value)
                autoResize()
              }}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:opacity-50 disabled:opacity-50"
              style={{ color: 'var(--text-primary)', maxHeight: '160px' }}
            />
            <button
              type="button"
              disabled={isLoading || (activeView === 'compare' ? !jobDescription.trim() : !query.trim())}
              onClick={activeView === 'compare' ? handleCompare : () => handleAsk()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          <p
            className="mt-2 text-center text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            Answers only from Krishna's verified documents • No hallucination
          </p>
        </div>
      </footer>
      </div>
    </div>
  )
}
