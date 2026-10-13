import { useMutation } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { ApiError, unsubscribe } from '../api'

/**
 * Opened from the "Unsubscribe" link in an alert email. It asks before acting: mail scanners open links on
 * their own, and a plain visit must not unsubscribe anyone.
 */
export default function UnsubscribePage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const stop = useMutation({ mutationFn: () => unsubscribe(token) })

  if (!token || (stop.error instanceof ApiError && stop.error.status === 404)) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-8">
        <h1 className="text-2xl font-semibold">This link doesn't work</h1>
        <p className="text-ink-2">
          Open the newest alert email and use its unsubscribe link, or{' '}
          <Link to="/alerts" className="text-accent underline">
            manage your alerts
          </Link>{' '}
          after signing in.
        </p>
      </div>
    )
  }

  if (stop.isSuccess) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-8">
        <h1 className="text-2xl font-semibold">You're unsubscribed</h1>
        <p className="text-ink-2">
          You won't get alert emails anymore. Your keywords are kept, so you can turn alerts back on any time from{' '}
          <Link to="/alerts" className="text-accent underline">
            your alerts
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-4 py-8">
      <h1 className="text-2xl font-semibold">Stop alert emails?</h1>
      <p className="text-ink-2">We'll stop emailing you about new notices. You can turn alerts back on later.</p>
      {stop.isError && (
        <p role="alert" className="text-sm text-due">
          {stop.error.message}. Please try again.
        </p>
      )}
      <button
        onClick={() => stop.mutate()}
        disabled={stop.isPending}
        className="w-full rounded-lg bg-accent px-4 py-3 font-medium text-surface disabled:opacity-60"
      >
        {stop.isPending ? 'Unsubscribing…' : 'Unsubscribe'}
      </button>
    </div>
  )
}
