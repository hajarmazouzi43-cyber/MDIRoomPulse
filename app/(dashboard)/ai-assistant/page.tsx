'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const PRIMARY = '#2554E0'

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "👋 Bonjour ! Je suis votre assistant IA, connecté en direct à la base de données.\n\nPosez-moi une question sur les salles, les réservations ou les statistiques — j'irai chercher l'information à jour avant de vous répondre.",
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { t } = useLanguage()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSend = async (overrideText?: string) => {
    const text = overrideText ?? input
    if (!text.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date()
    }

    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages
            .filter((m) => m.id !== 'welcome')
            .map((m) => ({ role: m.role, content: m.content }))
        })
      })

      const data = await res.json()

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.reply || `⚠️ ${data.error || t('aiAssistant.error')}`,
          timestamp: new Date()
        }
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: t('aiAssistant.connectionError'),
          timestamp: new Date()
        }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend()
  }

  const quickQuestions = [
    t('aiAssistant.freeRooms'),
    t('aiAssistant.occupiedRooms'),
    t('aiAssistant.stats'),
    t('aiAssistant.weekBookings'),
    t('aiAssistant.recentHistory'),
  ]

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 dark:bg-[#0a0e1a]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="blob blob-a" />
        <div className="blob blob-b" />
      </div>

      <div className="relative container mx-auto py-8 px-4 max-w-4xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <span className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: PRIMARY }}>
              MDI RoomPulse
            </span>
            <h1 className="text-3xl font-bold gradient-text mt-1">
              {t('aiAssistant.title')}
            </h1>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full bg-white/70 dark:bg-white/5 backdrop-blur-sm border border-emerald-200/60 dark:border-emerald-400/20 text-emerald-700 dark:text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            {t('aiAssistant.connected')}
          </div>
        </div>

        <div className="glow-border rounded-2xl">
          <div className="h-[600px] flex flex-col rounded-2xl bg-white/80 dark:bg-[#0f1420]/80 backdrop-blur-xl overflow-hidden">
            <div className="border-b border-slate-200/70 dark:border-white/10 px-5 py-3">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {t('aiAssistant.naturalLanguage')}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.map((message, i) => (
                <div
                  key={message.id}
                  className={`flex message-in ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  style={{ animationDelay: `${Math.min(i, 3) * 40}ms` }}
                >
                  <div
                    className={`max-w-[80%] px-4 py-3 rounded-2xl whitespace-pre-wrap text-sm leading-relaxed shadow-sm ${
                      message.role === 'user'
                        ? 'text-white rounded-br-md'
                        : 'bg-white dark:bg-white/[0.06] text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-white/10 rounded-bl-md'
                    }`}
                    style={
                      message.role === 'user'
                        ? { background: `linear-gradient(135deg, ${PRIMARY}, #38BDF8)` }
                        : undefined
                    }
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start message-in">
                  <div className="bg-white dark:bg-white/[0.06] border border-slate-200/70 dark:border-white/10 px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-1.5">
                    <span className="typing-dot" style={{ animationDelay: '0ms' }} />
                    <span className="typing-dot" style={{ animationDelay: '150ms' }} />
                    <span className="typing-dot" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-slate-200/70 dark:border-white/10 p-4 flex gap-2">
              <Input
                placeholder={t('aiAssistant.placeholder')}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                className="flex-1 rounded-xl border-slate-200 dark:border-white/10 dark:bg-white/5 dark:text-white focus-visible:ring-2 transition-shadow"
                style={{ '--tw-ring-color': `${PRIMARY}55` } as React.CSSProperties}
              />
              <button
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
                className="px-5 rounded-xl text-white font-medium text-sm shadow-md hover:shadow-lg hover:scale-[1.03] active:scale-95 disabled:opacity-40 disabled:hover:scale-100 transition-all"
                style={{ background: `linear-gradient(135deg, ${PRIMARY}, #38BDF8)` }}
              >
                {t('aiAssistant.send')}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {quickQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => handleSend(q)}
              disabled={isLoading}
              className="text-sm px-4 py-2 rounded-full bg-white/70 dark:bg-white/5 backdrop-blur-sm border border-slate-200/70 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-blue-300 hover:text-blue-600 hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-40 disabled:hover:translate-y-0"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        .gradient-text {
          background: linear-gradient(135deg, ${PRIMARY}, #38bdf8, #a78bfa);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: shine 6s linear infinite;
        }
        @keyframes shine {
          to { background-position: 200% center; }
        }

        .blob {
          position: absolute;
          border-radius: 9999px;
          filter: blur(80px);
          opacity: 0.35;
        }
        .blob-a {
          width: 420px;
          height: 420px;
          top: -120px;
          left: -100px;
          background: radial-gradient(circle, ${PRIMARY}, transparent 70%);
          animation: drift-a 18s ease-in-out infinite;
        }
        .blob-b {
          width: 380px;
          height: 380px;
          bottom: -140px;
          right: -100px;
          background: radial-gradient(circle, #a78bfa, transparent 70%);
          animation: drift-b 22s ease-in-out infinite;
        }
        @keyframes drift-a {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(60px, 40px) scale(1.1); }
        }
        @keyframes drift-b {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-50px, -30px) scale(1.08); }
        }

        .glow-border {
          position: relative;
          padding: 1.5px;
          background: conic-gradient(from 0deg, ${PRIMARY}, #38bdf8, #a78bfa, ${PRIMARY});
          animation: rotate-border 6s linear infinite;
        }
        @keyframes rotate-border {
          to { filter: hue-rotate(360deg); }
        }

        .message-in {
          animation: message-in 0.35s ease-out both;
        }
        @keyframes message-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .typing-dot {
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: ${PRIMARY};
          display: inline-block;
          animation: typing-bounce 1s ease-in-out infinite;
        }
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}