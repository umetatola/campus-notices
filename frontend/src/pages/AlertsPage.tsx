import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate } from 'react-router'
import { addSubscription, fetchSubscriptions, removeSubscription, type Subscription } from '../api'
import { useMe } from '../useMe'

const SUGGESTIONS = ['scholarship', '장학', 'dorm', '기숙사', 'internship', 'visa', 'graduation', '수강']
const MAX_KEYWORDS = 20

export default function AlertsPage() {
  const me = useMe()
  const queryClient = useQueryClient()
  const [keyword, setKeyword] = useState('')

  const subscriptions = useQuery({ queryKey: ['subscriptions'], queryFn: fetchSubscriptions, enabled: !!me })
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
  if (me === undefined || subscriptions.isPending) return <p className="py-8 text-center text-ink-2">Loading…</p>

  const list = subscriptions.data ?? []
  const followed = new Set(list.map((s) => s.keyword.toLowerCase()))
  const full = list.length >= MAX_KEYWORDS

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Your alerts</h1>
        <p className="text-ink-2">
          When a new notice mentions one of these words, in Korean or in its English summary, we email{' '}
          <span className="font-medium text-ink">{me.email}</span>. Several matches arrive together in one email.
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (keyword.trim()) add.mutate(keyword.trim())
        }}
      >
        <label htmlFor="keyword" className="sr-only">
          Keyword to follow
        </label>
        <input
          id="keyword"
          value={keyword}
          maxLength={50}
          disabled={full}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={full ? `You follow ${MAX_KEYWORDS} keywords, the maximum` : 'Add a keyword, e.g. scholarship'}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-4 py-2.5 placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <button
          type="submit"
          disabled={full || add.isPending || !keyword.trim()}
          className="shrink-0 rounded-lg bg-accent px-4 py-2.5 font-medium text-surface disabled:opacity-50"
        >
          Follow
        </button>
      </form>
      {add.isError && (
        <p role="alert" className="-mt-4 text-sm text-due">
          {add.error.message}
        </p>
      )}

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-6 text-center text-ink-2">
          You don't follow any keywords yet. Add one above, or pick a suggestion below.
        </div>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label="Keywords you follow">
          {list.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-1 rounded-full border border-accent bg-accent-soft py-1 pr-1 pl-3 text-sm"
            >
              <span>{s.keyword}</span>
              <button
                onClick={() => remove.mutate(s.id)}
                aria-label={`Stop following ${s.keyword}`}
                className="rounded-full px-2 text-muted hover:bg-surface hover:text-ink"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-2">Suggestions</h2>
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
        You only get notices posted after you follow a keyword. Keywords match anywhere in the text, so "장학" also
        catches "장학금".
      </p>
    </div>
  )
}
