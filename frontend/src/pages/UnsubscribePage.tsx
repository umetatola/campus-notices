import { useMutation } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { ApiError, unsubscribe } from '../api'
import { useI18n } from '../i18n'

/**
 * Opened from the "Unsubscribe" link in an alert email. It asks before acting: mail scanners open links on
 * their own, and a plain visit must not unsubscribe anyone.
 */
export default function UnsubscribePage() {
  const [params] = useSearchParams()
  const { t } = useI18n()
  const token = params.get('token') ?? ''
  const stop = useMutation({ mutationFn: () => unsubscribe(token) })

  if (!token || (stop.error instanceof ApiError && stop.error.status === 404)) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-8">
        <h1 className="text-2xl font-semibold">{t('unsub.badTitle')}</h1>
        <p className="text-ink-2">
          {t('unsub.badBefore')}
          <Link to="/alerts" className="text-accent underline">
            {t('unsub.badLink')}
          </Link>
          {t('unsub.badAfter')}
        </p>
      </div>
    )
  }

  if (stop.isSuccess) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-8">
        <h1 className="text-2xl font-semibold">{t('unsub.doneTitle')}</h1>
        <p className="text-ink-2">
          {t('unsub.doneBefore')}
          <Link to="/alerts" className="text-accent underline">
            {t('unsub.doneLink')}
          </Link>
          {t('unsub.doneAfter')}
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-4 py-8">
      <h1 className="text-2xl font-semibold">{t('unsub.askTitle')}</h1>
      <p className="text-ink-2">{t('unsub.askText')}</p>
      {stop.isError && (
        <p role="alert" className="text-sm text-due">
          {t('signIn.errorSuffix', { message: stop.error.message })}
        </p>
      )}
      <button
        onClick={() => stop.mutate()}
        disabled={stop.isPending}
        className="w-full rounded-lg bg-accent px-4 py-3 font-medium text-surface disabled:opacity-60"
      >
        {stop.isPending ? t('unsub.working') : t('unsub.button')}
      </button>
    </div>
  )
}
