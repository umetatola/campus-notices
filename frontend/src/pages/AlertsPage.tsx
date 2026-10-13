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
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t('alerts.title')}</h1>
        <p className="text-ink-2">
          {t('alerts.introBefore')}
          <span className="font-medium text-ink">{me.email}</span>
          {t('alerts.introAfter')}
        </p>
      </div>

      {status.data?.paused && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-due/40 bg-due-soft px-4 py-3">
          <p className="text-sm">
            <span className="font-medium">{t('alerts.pausedTitle')}</span> {t('alerts.pausedText')}
          </p>
          <button
            onClick={() => resume.mutate()}
            disabled={resume.isPending}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-surface disabled:opacity-60"
          >
            {t('alerts.resume')}
          </button>
        </div>
      )}

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
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-4 py-2.5 placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <button
          type="submit"
          disabled={full || add.isPending || !keyword.trim()}
          className="shrink-0 rounded-lg bg-accent px-4 py-2.5 font-medium text-surface disabled:opacity-50"
        >
          {t('alerts.follow')}
        </button>
      </form>
      {add.isError && (
        <p role="alert" className="-mt-4 text-sm text-due">
          {add.error.message}
        </p>
      )}

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-6 text-center text-ink-2">
          {t('alerts.none')}
        </div>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label={t('alerts.listLabel')}>
          {list.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-1 rounded-full border border-accent bg-accent-soft py-1 pr-1 pl-3 text-sm"
            >
              <span>{s.keyword}</span>
              <button
                onClick={() => remove.mutate(s.id)}
                aria-label={t('alerts.unfollow', { keyword: s.keyword })}
                className="rounded-full px-2 text-muted hover:bg-surface hover:text-ink"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {status.data && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-ink-2">{t('alerts.frequency')}</legend>
          <div className="flex flex-wrap gap-2">
            {(['INSTANT', 'DAILY'] as AlertFrequency[]).map((f) => (
              <label
                key={f}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                  status.data.frequency === f ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
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

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-2">{t('alerts.suggestions')}</h2>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.filter((k) => !followed.has(k.toLowerCase())).map((k) => (
            <button
              key={k}
              disabled={full || add.isPending}
              onClick={() => add.mutate(k)}
              className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-2 hover:border-accent hover:text-ink disabled:opacity-50"
            >
              + {k}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted">
        {t('alerts.footnote')}
      </p>
    </div>
  )
}
