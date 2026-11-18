import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchDesktopSettings, restartApp, saveApiKey, setKeepRunning } from '../api'
import { useI18n } from '../i18n'

const RESTART_CHECK_MS = 1000

/** Icon tile shown beside each card's heading. */
function CardIcon({ children, tone = 'accent' }: { children: ReactNode; tone?: 'accent' | 'pin' }) {
  return (
    <span
      className={`grid size-10 shrink-0 place-items-center rounded-xl ${
        tone === 'accent' ? 'bg-accent-soft text-accent' : 'bg-pin-soft text-pin'
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        {children}
      </svg>
    </span>
  )
}

/** Desktop app only: the Claude API key that turns on English summaries, and a restart to apply it. */
export default function SettingsPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const settings = useQuery({ queryKey: ['desktop-settings'], queryFn: fetchDesktopSettings, retry: false })
  const [apiKey, setApiKey] = useState('')
  // startedAt of the copy being restarted; everything is fetched again once a newer copy answers
  const [restartingFrom, setRestartingFrom] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: saveApiKey,
    onSuccess: (next) => {
      queryClient.setQueryData(['desktop-settings'], next)
      setApiKey('')
    },
  })
  const background = useMutation({
    mutationFn: setKeepRunning,
    onSuccess: (next) => queryClient.setQueryData(['desktop-settings'], next),
  })
  const restart = useMutation({
    mutationFn: restartApp,
    onSuccess: () => setRestartingFrom(settings.data?.startedAt ?? ''),
  })

  useEffect(() => {
    if (restartingFrom === null) return
    const timer = setInterval(() => {
      fetchDesktopSettings().then(
        (now) => {
          if (now.startedAt === restartingFrom) return
          setRestartingFrom(null)
          queryClient.resetQueries()
        },
        () => {}, // the old copy has stopped and the new one isn't answering yet
      )
    }, RESTART_CHECK_MS)
    return () => clearInterval(timer)
  }, [restartingFrom, queryClient])

  if (settings.isPending) return <p className="py-8 text-center text-ink-2">{t('settings.loading')}</p>
  if (settings.isError) return <p className="py-8 text-center text-ink-2">{t('settings.desktopOnly')}</p>

  const { apiKeySet, apiKeyHint, summariesOn, backgroundAvailable, keepRunning } = settings.data
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (apiKey.trim()) save.mutate(apiKey.trim())
  }

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold tracking-tight">{t('settings.title')}</h1>

      {apiKeySet !== summariesOn && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent bg-accent-soft px-4 py-3">
          <p className="text-ink">{restartingFrom !== null ? t('settings.restarting') : t('settings.restartNeeded')}</p>
          {restartingFrom === null && (
            <button
              onClick={() => restart.mutate()}
              disabled={restart.isPending}
              className="btn-primary rounded-full px-4 py-1.5 text-sm font-medium"
            >
              {t('settings.restartNow')}
            </button>
          )}
          {restart.isError && (
            <p role="alert" className="w-full text-sm text-due">
              {restart.error.message}
            </p>
          )}
        </div>
      )}

      <section className="card space-y-4 p-6" aria-labelledby="summaries-heading">
        <div className="flex items-start gap-4">
          <CardIcon>
            <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
            <path d="M19 15l.8 1.9 1.9.8-1.9.8L19 20.4l-.8-1.9-1.9-.8 1.9-.8z" />
          </CardIcon>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="summaries-heading" className="text-lg font-semibold">
                {t('settings.summaries')}
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  summariesOn ? 'bg-accent-soft text-accent' : 'bg-line/60 text-muted'
                }`}
                aria-hidden="true"
              >
                <span className={`size-1.5 rounded-full ${summariesOn ? 'animate-pulse bg-accent' : 'bg-muted'}`} />
                {summariesOn ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className={summariesOn ? 'text-accent' : 'text-ink-2'}>
              {t(summariesOn ? 'settings.summariesOn' : 'settings.summariesOff')}
            </p>
          </div>
        </div>

        {apiKeySet && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-ink-2">{t('settings.keySaved', { hint: apiKeyHint ?? '' })}</span>
            <button
              onClick={() => save.mutate('')}
              disabled={save.isPending}
              className="text-due underline-offset-2 hover:underline disabled:opacity-60"
            >
              {t('settings.removeKey')}
            </button>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-2">
          <label htmlFor="api-key" className="block text-sm font-medium">
            {t(apiKeySet ? 'settings.replaceKey' : 'settings.apiKey')}
          </label>
          <div className="flex gap-2">
            <input
              id="api-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-…"
              className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-4 py-2.5 font-mono text-sm transition focus:border-accent focus:bg-surface focus:outline-none focus:ring-4 focus:ring-accent/15"
            />
            <button
              type="submit"
              disabled={!apiKey.trim() || save.isPending}
              className="btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold"
            >
              {t('settings.save')}
            </button>
          </div>
          {save.isError && (
            <p role="alert" className="text-sm text-due">
              {save.error.message}
            </p>
          )}
          <p className="text-sm text-muted">
            {t('settings.keyHelp')}{' '}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-accent underline-offset-2 hover:underline">
              console.anthropic.com
            </a>
          </p>
        </form>
      </section>

      {backgroundAvailable && (
        <section className="card space-y-4 p-6" aria-labelledby="background-heading">
          <div className="flex items-start gap-4">
            <CardIcon tone="pin">
              <rect x="3" y="4" width="18" height="13" rx="2" />
              <path d="M8 21h8M12 17v4" />
              <path d="M16 11.5l1.5 1.5L20 10.5" />
            </CardIcon>
            <h2 id="background-heading" className="pt-2 text-lg font-semibold">
              {t('settings.background')}
            </h2>
          </div>
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-line bg-bg/60 p-4 transition hover:border-accent/50">
            <span>
              <span className="block font-medium">{t('settings.keepRunning')}</span>
              <span className="mt-0.5 block text-sm text-muted">{t('settings.keepRunningHelp')}</span>
            </span>
            {/* a real checkbox (keyboard, screen readers), drawn as an on/off switch */}
            <span className="relative inline-flex shrink-0">
              <input
                type="checkbox"
                role="switch"
                checked={keepRunning}
                disabled={background.isPending}
                onChange={(e) => background.mutate(e.target.checked)}
                className="peer absolute inset-0 z-10 cursor-pointer opacity-0"
              />
              <span className="h-7 w-12 rounded-full bg-line transition peer-checked:bg-accent peer-focus-visible:ring-4 peer-focus-visible:ring-accent/25 peer-disabled:opacity-60" />
              <span className="pointer-events-none absolute top-1 left-1 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
            </span>
          </label>
          {background.isError && (
            <p role="alert" className="text-sm text-due">
              {background.error.message}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
