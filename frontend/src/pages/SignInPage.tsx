import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Navigate } from 'react-router'
import { requestSignInLink } from '../api'
import { useMe } from '../useMe'
import { useI18n } from '../i18n'

export default function SignInPage() {
  const me = useMe()
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const request = useMutation({ mutationFn: (address: string) => requestSignInLink(address) })

  if (me) return <Navigate to="/alerts" replace />

  if (request.isSuccess) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-8">
        <h1 className="text-2xl font-semibold">{t('signIn.checkTitle')}</h1>
        <p className="text-ink-2">
          {t('signIn.checkBefore')}
          <span className="font-medium text-ink">{request.variables}</span>
          {t('signIn.checkAfter')}
        </p>
        <p className="text-sm text-muted">
          {t('signIn.nothingArrived')}
          <button className="text-accent underline" onClick={() => request.reset()}>
            {t('signIn.tryAgainLink')}
          </button>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-5 py-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t('signIn.title')}</h1>
        <p className="text-ink-2">
          {t('signIn.intro')}
        </p>
      </div>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          request.mutate(email.trim())
        }}
      >
        <label htmlFor="email" className="block text-sm font-medium">
          {t('signIn.email')}
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@ajou.ac.kr"
          className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-base placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        {request.isError && (
          <p role="alert" className="text-sm text-due">
            {t('signIn.errorSuffix', { message: request.error.message })}
          </p>
        )}
        <button
          type="submit"
          disabled={request.isPending}
          className="w-full rounded-lg bg-accent px-4 py-3 font-medium text-surface disabled:opacity-60"
        >
          {request.isPending ? t('signIn.sending') : t('signIn.submit')}
        </button>
      </form>
    </div>
  )
}
