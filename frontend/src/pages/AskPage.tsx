import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ApiError, ask, fetchAskStatus, fetchDesktopSettings, type AskEvent, type AskSource } from '../api'
import AnswerText from '../AnswerText'
import { dueLabel } from '../labels'
import { useI18n, type MessageKey } from '../i18n'

interface Exchange {
  question: string
  steps: { kind: 'search' | 'read'; detail: string }[]
  answer?: string
  sources?: AskSource[]
  error?: string
  done: boolean
}

const EXAMPLES: MessageKey[] = ['ask.example1', 'ask.example2', 'ask.example3', 'ask.example4', 'ask.example5']

function Sparkle({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2.5l2.1 5.6a3 3 0 0 0 1.8 1.8l5.6 2.1-5.6 2.1a3 3 0 0 0-1.8 1.8L12 21.5l-2.1-5.6a3 3 0 0 0-1.8-1.8L2.5 12l5.6-2.1a3 3 0 0 0 1.8-1.8z" />
      <path d="M19 2l.7 1.8 1.8.7-1.8.7L19 7l-.7-1.8-1.8-.7 1.8-.7z" opacity=".7" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
      <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
    </svg>
  )
}

/** AI mode: write any question or request; the AI searches and reads the notices and answers with links. */
export default function AskPage() {
  const { t, lang } = useI18n()
  const status = useQuery({ queryKey: ['ask-status'], queryFn: fetchAskStatus, retry: false })
  const desktop = useQuery({ queryKey: ['desktop-settings'], queryFn: fetchDesktopSettings, retry: false })
  const [chat, setChat] = useState<Exchange[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)

  useEffect(() => () => abort.current?.abort(), [])
  useEffect(() => {
    bottom.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' })
  }, [chat])

  const update = (fn: (last: Exchange) => Exchange) => setChat((c) => [...c.slice(0, -1), fn(c[c.length - 1])])

  async function submit(question: string) {
    const q = question.trim()
    if (!q || busy) return
    const history = chat
      .filter((e) => e.answer)
      .map((e) => ({ question: e.question, answer: e.answer! }))
    setChat((c) => [...c, { question: q, steps: [], done: false }])
    setDraft('')
    setBusy(true)
    const controller = new AbortController()
    abort.current = controller
    try {
      await ask(
        q,
        history,
        (e: AskEvent) => {
          if (e.type === 'step') update((x) => ({ ...x, steps: [...x.steps, { kind: e.kind, detail: e.detail }] }))
          else if (e.type === 'answer') update((x) => ({ ...x, answer: e.text, sources: e.sources, done: true }))
          else update((x) => ({ ...x, error: e.message, done: true }))
        },
        controller.signal,
      )
      update((x) => (x.done ? x : { ...x, error: t('ask.stopped'), done: true }))
    } catch (err) {
      const message =
        controller.signal.aborted ? t('ask.stopped') : err instanceof Error ? err.message : String(err)
      update((x) => ({ ...x, error: message, done: true }))
    } finally {
      setBusy(false)
      abort.current = null
      input.current?.focus()
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void submit(draft)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void submit(draft)
    }
  }

  if (status.isPending) return <p className="py-8 text-center text-ink-2">{t('ask.thinking')}</p>

  const signedOut = status.error instanceof ApiError && status.error.status === 401
  if (!status.data?.enabled) {
    return (
      <div className="card mx-auto mt-6 max-w-lg space-y-4 p-8 text-center">
        <span className="ai-orb mx-auto grid size-14 place-items-center rounded-2xl text-white">
          <Sparkle className="size-7" />
        </span>
        <h1 className="text-xl font-semibold">{signedOut ? t('nav.ask') : t('ask.offTitle')}</h1>
        <p className="text-ink-2">{signedOut ? t('ask.signIn') : desktop.isSuccess ? t('ask.offDesktop') : t('ask.offWeb')}</p>
        {signedOut ? (
          <Link to="/sign-in" className="btn-primary inline-block rounded-full px-5 py-2 text-sm font-medium">
            {t('ask.signInButton')}
          </Link>
        ) : (
          desktop.isSuccess && (
            <Link to="/settings" className="btn-primary inline-block rounded-full px-5 py-2 text-sm font-medium">
              {t('ask.openSettings')}
            </Link>
          )
        )}
      </div>
    )
  }

  const empty = chat.length === 0
  const promptBox = (
    <form onSubmit={onSubmit} className={`ai-prompt card relative p-2 ${busy ? 'is-busy' : ''}`}>
      <label htmlFor="ask-input" className="sr-only">
        {t('ask.label')}
      </label>
      <textarea
        id="ask-input"
        ref={input}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        rows={empty ? 3 : 1}
        maxLength={2000}
        autoFocus
        placeholder={empty ? t('ask.placeholder') : t('ask.followUp')}
        className="block w-full resize-none bg-transparent px-3 py-2.5 pr-14 text-base text-ink placeholder:text-muted focus:outline-none"
      />
      {busy ? (
        <button
          type="button"
          onClick={() => abort.current?.abort()}
          aria-label={t('ask.stop')}
          className="absolute right-3 bottom-3 grid size-10 place-items-center rounded-full border border-line bg-surface text-ink-2 transition hover:border-due hover:text-due"
        >
          <span className="size-3 rounded-[3px] bg-current" />
        </button>
      ) : (
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label={t('ask.send')}
          className="btn-primary absolute right-3 bottom-3 grid size-10 place-items-center rounded-full"
        >
          <SendIcon />
        </button>
      )}
    </form>
  )

  return (
    <div className="space-y-6">
      {empty ? (
        <div className="space-y-7 pt-6 text-center">
          <span className="ai-orb mx-auto grid size-16 place-items-center rounded-2xl text-white">
            <Sparkle className="size-8" />
          </span>
          <div className="space-y-2">
            <h1 className="ai-gradient-text text-3xl font-bold tracking-tight sm:text-4xl">{t('ask.title')}</h1>
            <p className="mx-auto max-w-xl text-ink-2">{t('ask.subtitle')}</p>
          </div>
          <div className="text-left">{promptBox}</div>
          <div className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">{t('ask.examples')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLES.map((k, i) => (
                <button
                  key={k}
                  onClick={() => void submit(t(k))}
                  style={{ animationDelay: `${120 + i * 70}ms` }}
                  className="page-enter rounded-full border border-line bg-surface/80 px-3.5 py-1.5 text-sm text-ink-2 shadow-sm transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"
                >
                  {t(k)}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted">{t('ask.disclaimer')}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <span className="ai-orb grid size-7 place-items-center rounded-lg text-white">
                <Sparkle className="size-4" />
              </span>
              {t('nav.ask')}
            </h1>
            <button
              onClick={() => {
                abort.current?.abort()
                setChat([])
              }}
              className="rounded-full border border-line px-3 py-1.5 text-sm text-ink-2 transition hover:border-accent hover:text-accent"
            >
              + {t('ask.newChat')}
            </button>
          </div>

          <ol className="space-y-6" aria-live="polite">
            {chat.map((x, i) => (
              <li key={i} className="space-y-3">
                <div className="flex justify-end">
                  <p className="page-enter max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 whitespace-pre-wrap text-white shadow-sm">
                    <span className="sr-only">{t('ask.you')}: </span>
                    {x.question}
                  </p>
                </div>
                <div className="page-enter card space-y-4 p-5">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted">
                    <span className={`ai-orb grid size-6 place-items-center rounded-md text-white ${x.done ? '' : 'is-thinking'}`}>
                      <Sparkle className="size-3.5" />
                    </span>
                    {t('ask.ai')}
                  </div>

                  {(x.steps.length > 0 || !x.done) && (
                    <ul className="space-y-1.5 text-sm">
                      {x.steps.map((s, j) => (
                        <li key={j} className="page-enter flex items-center gap-2 text-ink-2">
                          <span className="text-accent" aria-hidden="true">
                            {s.kind === 'search' ? '⌕' : '▤'}
                          </span>
                          <span className="truncate">
                            {t(s.kind === 'search' ? 'ask.searching' : 'ask.reading', { detail: s.detail })}
                          </span>
                          {x.done || j < x.steps.length - 1 ? <span className="text-accent">✓</span> : null}
                        </li>
                      ))}
                      {!x.done && (
                        <li className="ai-shimmer flex items-center gap-2 font-medium">
                          <span className="ai-dots" aria-hidden="true">
                            <span />
                            <span />
                            <span />
                          </span>
                          {t('ask.thinking')}
                        </li>
                      )}
                    </ul>
                  )}

                  {x.answer && <AnswerText text={x.answer} />}

                  {x.error && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-due/30 bg-due-soft px-4 py-3 text-sm">
                      <p role="alert" className="text-due">
                        {x.error}
                      </p>
                      {i === chat.length - 1 && !busy && (
                        <button onClick={() => void submit(x.question)} className="font-medium text-due underline-offset-2 hover:underline">
                          {t('ask.retry')}
                        </button>
                      )}
                    </div>
                  )}

                  {x.sources && x.sources.length > 0 && (
                    <div className="space-y-2 border-t border-line pt-4">
                      <p className="text-xs font-medium tracking-wide text-muted uppercase">{t('ask.sources')}</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {x.sources.map((s) => {
                          const due = dueLabel(s.deadline, new Date(), lang)
                          return (
                            <Link
                              key={s.id}
                              to={`/notices/${s.id}`}
                              className="group rounded-xl border border-line bg-bg/60 p-3 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
                            >
                              <span className="line-clamp-2 text-sm font-medium text-ink group-hover:text-accent">
                                {lang === 'en' ? (s.titleEn ?? s.title) : s.title}
                              </span>
                              <span className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted">
                                {s.department && <span>{s.department}</span>}
                                {due && <span className="font-medium text-due">{due}</span>}
                              </span>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <div className="sticky bottom-4 z-10 space-y-1.5">
            {promptBox}
            <p className="text-center text-xs text-muted">
              {t('ask.hint')} · {t('ask.disclaimer')}
            </p>
          </div>
          <div ref={bottom} />
        </>
      )}
    </div>
  )
}
