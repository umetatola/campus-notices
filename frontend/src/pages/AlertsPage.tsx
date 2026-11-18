import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate } from 'react-router'
import {
  addSubscription,
  fetchAlertStatus,
  fetchSubscriptions,
  removeSubscription,
  resumeAlerts,
  setAlertFrequency,
  type AlertFrequency,
  type Subscription,
} from '../api'
import { useMe } from '../useMe'
import { useI18n } from '../i18n'
import { PageHeader } from '../PageHeader'

const SUGGESTIONS = ['scholarship', '장학', 'dorm', '기숙사', 'internship', 'visa', 'graduation', '수강']
const MAX_KEYWORDS = 20

export default function AlertsPage() {
  const me = useMe()
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [keyword, setKeyword] = useState('')

  const subscriptions = useQuery({ queryKey: ['subscriptions'], queryFn: fetchSubscriptions, enabled: !!me })
  const status = useQuery({ queryKey: ['alert-status'], queryFn: fetchAlertStatus, enabled: !!me })
  const resume = useMutation({
    mutationFn: resumeAlerts,
    onSuccess: (next) => queryClient.setQueryData(['alert-status'], next),
  })
  const frequency = useMutation({
    mutationFn: setAlertFrequency,
    onSuccess: (next) => queryClient.setQueryData(['alert-status'], next),
  })
  const add = useMutation({
    mutationFn: addSubscription,
    onSuccess: (created) => {
      queryClient.setQueryData<Subscription[]>(['subscriptions'], (old = []) => [...old, created])
      setKeyword('')
    },
  })
  const remove = useMutation({
    mutationFn: (id: number) => removeSubscription(id),
    onSuccess: (_, id) =>
      queryClient.setQueryData<Subscription[]>(['subscriptions'], (old = []) => old.filter((s) => s.id !== id)),
  })

  if (me === null) return <Navigate to="/sign-in" replace />
  if (me === undefined || subscriptions.isPending) return <p className="py-8 text-center text-ink-2">{t('alerts.loading')}</p>

  const list = subscriptions.data ?? []
  const followed = new Set(list.map((s) => s.keyword.toLowerCase()))
  const full = list.length >= MAX_KEYWORDS

  return (
    <div className="space-y-6">
      <PageHeader icon="alerts" title={t('alerts.title')}>
        <p>
          {t('alerts.introBefore')}
          <span className="font-medium text-ink">{me.email}</span>
          {t('alerts.introAfter')}
        </p>
      </PageHeader>

      {status.data?.paused && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-due/40 bg-due-soft px-4 py-3">
          <p className="text-sm">
            <span className="font-medium">{t('alerts.pausedTitle')}</span> {t('alerts.pausedText')}
          </p>
          <button
            onClick={() => resume.mutate()}
            disabled={resume.isPending}
            className="btn-primary rounded-full px-4 py-1.5 text-sm font-medium"
          >
            {t('alerts.resume')}
          </button>
        </div>
      )}

      <section className="card space-y-5 p-5 hover:transform-none sm:p-6">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (keyword.trim()) add.mutate(keyword.trim())
        }}
      >
        <label htmlFor="keyword" className="sr-only">
          {t('alerts.keywordLabel')}
        </label>
        <input
          id="keyword"
          value={keyword}
          maxLength={50}
          disabled={full}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={full ? t('alerts.full', { max: MAX_KEYWORDS }) : t('alerts.placeholder')}
          className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-4 py-2.5 placeholder:text-muted focus:border-accent focus:bg-surface focus:outline-none focus:ring-4 focus:ring-accent/15"
        />
        <button
          type="submit"
          disabled={full || add.isPending || !keyword.trim()}
          className="btn-primary shrink-0 rounded-xl px-5 py-2.5 font-medium"
        >
          {t('alerts.follow')}
        </button>
      </form>
      {add.isError && (
        <p role="alert" className="-mt-3 text-sm text-due">
          {add.error.message}
        </p>
      )}

      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-sm text-ink-2">{t('alerts.none')}</p>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label={t('alerts.listLabel')}>
          {list.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-1 rounded-full bg-accent-soft py-1 pr-1 pl-3 text-sm font-medium text-accent ring-1 ring-accent/30"
            >
              <span>{s.keyword}</span>
              <button
                onClick={() => remove.mutate(s.id)}
                aria-label={t('alerts.unfollow', { keyword: s.keyword })}
                className="grid size-6 place-items-center rounded-full text-accent/70 transition hover:bg-surface hover:text-due"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="size-3" aria-hidden="true">
                  <path d="m5 5 10 10M15 5 5 15" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 border-t border-line pt-4">
        <h2 className="text-sm font-semibold text-ink-2">{t('alerts.suggestions')}</h2>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.filter((k) => !followed.has(k.toLowerCase())).map((k) => (
            <button
              key={k}
              disabled={full || add.isPending}
              onClick={() => add.mutate(k)}
              className="rounded-full border border-dashed border-line bg-surface px-3 py-1 text-sm text-ink-2 transition hover:border-accent hover:text-accent disabled:opacity-50"
            >
              + {k}
            </button>
          ))}
        </div>
      </div>
      </section>

      {status.data && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-ink-2">{t('alerts.frequency')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['INSTANT', 'DAILY'] as AlertFrequency[]).map((f) => (
              <label
                key={f}
                className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-4 py-3 text-sm transition ${
                  status.data.frequency === f
                    ? 'border-accent bg-accent-soft ring-1 ring-accent/40'
                    : 'border-line bg-surface hover:border-accent/50'
                }`}
              >
                <input
                  type="radio"
                  name="frequency"
                  value={f}
                  checked={status.data.frequency === f}
                  disabled={frequency.isPending}
                  onChange={() => frequency.mutate(f)}
                  className="mt-1 accent-accent"
                />
                <span>
                  <span className="block font-medium">{t(f === 'INSTANT' ? 'alerts.instant' : 'alerts.daily')}</span>
                  <span className="block text-ink-2">{t(f === 'INSTANT' ? 'alerts.instantHint' : 'alerts.dailyHint')}</span>
                </span>
              </label>
            ))}
          </div>
          {frequency.isError && (
            <p role="alert" className="text-sm text-due">
              {frequency.error.message}
            </p>
          )}
        </fieldset>
      )}

      <p className="text-xs text-muted">
        {t('alerts.footnote')}
      </p>
    </div>
  )
}
